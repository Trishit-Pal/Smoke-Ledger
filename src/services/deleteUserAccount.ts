import { getSupabase } from '@/lib/supabase';
import { useSession } from '@/store/session';
import { invalidateAnalyticsConsentCache } from '@/services/analytics';
import { AppError, classifyError } from '@/lib/errors';
import { parseEdgeFunctionError, parseEdgeResponse } from '@/lib/edgeFunctionError';

interface DeleteOptions {
  /**
   * If provided, the user will be redirected to re-authenticate when the
   * server reports `reauth_required`. The caller can use this to surface a
   * "Please sign in again to confirm account deletion" UI.
   */
  onReauthRequired?: () => void;
  /**
   * The deletion ends a consent withdrawal. The server writes the `consent_revoked`
   * row itself, only once the deletion succeeded (a failed delete leaves none): after the
   * account is gone no client can authenticate an audit write. Omitted (web) sends no body.
   */
  withdraw?: boolean;
}

export async function deleteUserAccount(options: DeleteOptions = {}): Promise<void> {
  const supabase = getSupabase();

  // Use getUser() (not getSession()) so we hit the auth server and refuse a
  // revoked session. We still need the access token from the live session for
  // the bearer header.
  const [{ data: userData, error: userErr }, { data: sessionData }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.auth.getSession(),
  ]);
  if (userErr || !userData?.user) {
    throw new AppError('authentication_error', 'Not signed in');
  }
  const accessToken = sessionData.session?.access_token;
  if (!accessToken) {
    throw new AppError('authentication_error', 'Not signed in');
  }

  const { data, error } = await supabase.functions.invoke('delete-account', {
    headers: { Authorization: `Bearer ${accessToken}` },
    ...(options.withdraw === undefined ? {} : { body: { withdraw: options.withdraw } }),
  });

  if (error) {
    // supabase-js v2: non-2xx responses set data=null and error=FunctionsHttpError.
    // The structured body lives in error.context (a native Response object).
    const body = await parseEdgeResponse(error);
    const { code, serverCode } = parseEdgeFunctionError(body);

    if (serverCode === 'reauth_required') {
      options.onReauthRequired?.();
      throw new AppError('authentication_error', 'Please sign in again to confirm account deletion.');
    }
    if (serverCode === 'rate_limited') {
      throw new AppError('rate_limited', 'Too many delete attempts. Please wait and try again.');
    }
    if (body !== null) {
      throw new AppError(code, serverCode ?? error.message);
    }
    // No structured body (network error, HTML 524, etc.) — fall back to message heuristics.
    throw new AppError(classifyError(error), error.message);
  }

  // Legacy fallback: supabase-js never puts error body in data for non-2xx,
  // but this branch is kept for SDK compatibility.
  if (data && typeof data === 'object' && 'error' in data) {
    const code = String((data as { error: string }).error);
    if (code === 'reauth_required') {
      options.onReauthRequired?.();
      throw new AppError('authentication_error', 'Please sign in again to confirm account deletion.');
    }
    if (code === 'rate_limited') {
      throw new AppError('rate_limited', 'Too many delete attempts. Try again later.');
    }
    throw new AppError('dependency_failure', code);
  }

  // The auth user is already deleted server-side, so a global revoke is a
  // doomed round-trip. Local scope clears the client session instantly and
  // lets the caller navigate to the homepage without waiting on the network.
  await supabase.auth.signOut({ scope: 'local' });
  try {
    useSession.getState().reset();
  } catch {
    // The session store may not be hydrated in some test contexts; safe to ignore.
  }
  invalidateAnalyticsConsentCache();
}

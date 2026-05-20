import { getSupabase } from '@/lib/supabase';
import { useSession } from '@/store/session';
import { invalidateAnalyticsConsentCache } from '@/services/analytics';
import { AppError, classifyError } from '@/lib/errors';

interface DeleteOptions {
  /**
   * If provided, the user will be redirected to re-authenticate when the
   * server reports `reauth_required`. The caller can use this to surface a
   * "Please sign in again to confirm account deletion" UI.
   */
  onReauthRequired?: () => void;
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
  });
  if (error) throw new AppError(classifyError(error), error.message);
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

  await supabase.auth.signOut();
  try {
    useSession.getState().reset();
  } catch {
    // The session store may not be hydrated in some test contexts; safe to ignore.
  }
  invalidateAnalyticsConsentCache();
}

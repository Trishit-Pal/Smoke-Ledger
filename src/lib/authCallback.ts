import { readAuthLink } from '@/lib/authLink';
import { getSupabase } from '@/lib/supabase';

// 'signed_up' is a first-time signup confirmation (type=signup) — callers use it
// to fire the one-time welcome celebration. All other sign-ins are 'signed_in'.
type SessionResult = 'recovery' | 'signed_in' | 'signed_up' | 'none';

/** Map a Supabase email OTP `type` to the session outcome the app cares about. */
function resultForType(type: string | null | undefined): SessionResult {
  if (type === 'recovery') return 'recovery';
  if (type === 'signup') return 'signed_up';
  return 'signed_in';
}

/**
 * Redeem a Supabase auth deep link and establish a session.
 *   - `token_hash` + `type` → verifyOtp. Not bound to this device, so the
 *     callback screen asks the person to confirm BEFORE calling this.
 *   - PKCE `code` → exchangeCodeForSession (same-device only).
 * Raw `#access_token`/`#refresh_token` fragments (the old implicit flow) are
 * never accepted: anyone could hand the app a link that signs it into their
 * own account (security scan F3). Returns the flow type so callers can route
 * recovery links to the reset screen and celebrate first-time signups.
 */
export async function createSessionFromUrl(url: string): Promise<SessionResult> {
  const supabase = getSupabase();

  try {
    const parsed = new URL(url);
    const link = readAuthLink(parsed.searchParams);

    if (link.kind === 'confirm') {
      const { error } = await supabase.auth.verifyOtp({ token_hash: link.tokenHash, type: link.type });
      if (error) throw error;
      return resultForType(link.type);
    }

    if (link.kind === 'exchange') {
      const { error } = await supabase.auth.exchangeCodeForSession(link.code);
      if (error) throw error;
      return resultForType(parsed.searchParams.get('type'));
    }
  } catch {
    return 'none';
  }

  return 'none';
}

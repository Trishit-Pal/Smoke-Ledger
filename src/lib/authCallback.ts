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
 * Parse a Supabase auth deep link and establish a session. Supports all three
 * link shapes so a link works regardless of which device opened it:
 *   - `token_hash` + `type` → verifyOtp (cross-device safe; preferred template)
 *   - PKCE `code` → exchangeCodeForSession (same-device fallback)
 *   - implicit `#access_token`/`#refresh_token` → setSession (legacy)
 * Returns the flow type so callers can route recovery links to the reset screen
 * and celebrate first-time signups.
 */
export async function createSessionFromUrl(url: string): Promise<SessionResult> {
  const supabase = getSupabase();

  try {
    const parsed = new URL(url);
    const type = parsed.searchParams.get('type');

    // 1. token_hash + type → verifyOtp (cross-device safe; preferred template)
    const tokenHash = parsed.searchParams.get('token_hash');
    if (tokenHash && type) {
      const { error } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type: type as 'recovery' | 'signup' | 'invite' | 'magiclink' | 'email_change' | 'email',
      });
      if (error) throw error;
      return resultForType(type);
    }

    // 2. code → exchangeCodeForSession (PKCE; same-device only)
    const code = parsed.searchParams.get('code');
    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) throw error;
      return resultForType(type);
    }

    // 3. #access_token/#refresh_token → setSession (legacy implicit flow)
    const hash = parsed.hash.startsWith('#') ? parsed.hash.slice(1) : parsed.hash;
    const hashParams = new URLSearchParams(hash);
    const accessToken = hashParams.get('access_token');
    const refreshToken = hashParams.get('refresh_token');
    const hashType = hashParams.get('type');

    if (accessToken && refreshToken) {
      const { error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });
      if (error) throw error;
      return resultForType(hashType);
    }
  } catch {
    return 'none';
  }

  return 'none';
}

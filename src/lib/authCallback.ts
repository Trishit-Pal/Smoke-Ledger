import { getSupabase } from '@/lib/supabase';

type SessionResult = 'recovery' | 'signed_in' | 'none';

/**
 * Parse a Supabase auth deep link (PKCE code or implicit hash tokens) and
 * establish a session. Returns the flow type so callers can route recovery
 * links to the password reset screen.
 */
export async function createSessionFromUrl(url: string): Promise<SessionResult> {
  const supabase = getSupabase();

  try {
    const parsed = new URL(url);
    const code = parsed.searchParams.get('code');
    const type = parsed.searchParams.get('type');

    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) throw error;
      return type === 'recovery' ? 'recovery' : 'signed_in';
    }

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
      return hashType === 'recovery' ? 'recovery' : 'signed_in';
    }

    const tokenHash = parsed.searchParams.get('token_hash');
    const otpType = parsed.searchParams.get('type');
    if (tokenHash && otpType) {
      const { error } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type: otpType as 'recovery' | 'signup' | 'invite' | 'magiclink' | 'email_change' | 'email',
      });
      if (error) throw error;
      return otpType === 'recovery' ? 'recovery' : 'signed_in';
    }
  } catch {
    return 'none';
  }

  return 'none';
}

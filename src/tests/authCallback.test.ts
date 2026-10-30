import { getSupabase } from '@/lib/supabase';
import { createSessionFromUrl } from '@/lib/authCallback';

jest.mock('@/lib/supabase', () => ({
  getSupabase: jest.fn(),
}));

const mockGetSupabase = getSupabase as jest.Mock;

function buildAuth() {
  return {
    exchangeCodeForSession: jest.fn().mockResolvedValue({ error: null }),
    setSession: jest.fn().mockResolvedValue({ error: null }),
    verifyOtp: jest.fn().mockResolvedValue({ error: null }),
  };
}

const WEB = 'https://app.example.com/auth/callback';
const DEEP = 'smokeledger://auth/callback';

describe('createSessionFromUrl', () => {
  let auth: ReturnType<typeof buildAuth>;

  beforeEach(() => {
    auth = buildAuth();
    mockGetSupabase.mockReturnValue({ auth });
  });

  describe('token_hash path (cross-device safe)', () => {
    it('verifies a recovery link and reports recovery', async () => {
      const result = await createSessionFromUrl(
        `${WEB}?next=/reset-password&token_hash=abc&type=recovery`,
      );
      expect(auth.verifyOtp).toHaveBeenCalledWith({ token_hash: 'abc', type: 'recovery' });
      expect(result).toBe('recovery');
    });

    it('reports signed_up for a first-time signup confirmation', async () => {
      const result = await createSessionFromUrl(`${WEB}?token_hash=abc&type=signup`);
      expect(auth.verifyOtp).toHaveBeenCalledWith({ token_hash: 'abc', type: 'signup' });
      expect(result).toBe('signed_up');
    });

    it('reports signed_in for a magic-link sign-in', async () => {
      const result = await createSessionFromUrl(`${WEB}?token_hash=abc&type=magiclink`);
      expect(result).toBe('signed_in');
    });

    it('returns none when verifyOtp fails', async () => {
      auth.verifyOtp.mockResolvedValueOnce({ error: { message: 'expired' } });
      const result = await createSessionFromUrl(`${WEB}?token_hash=abc&type=recovery`);
      expect(result).toBe('none');
    });
  });

  describe('PKCE code path (same-device)', () => {
    it('exchanges the code and reports recovery', async () => {
      const result = await createSessionFromUrl(`${WEB}?code=xyz&type=recovery`);
      expect(auth.exchangeCodeForSession).toHaveBeenCalledWith('xyz');
      expect(result).toBe('recovery');
    });

    it('reports signed_up when the code link is a signup confirmation', async () => {
      const result = await createSessionFromUrl(`${WEB}?code=xyz&type=signup`);
      expect(result).toBe('signed_up');
    });

    it('reports signed_in for a plain code link', async () => {
      const result = await createSessionFromUrl(`${WEB}?code=xyz`);
      expect(result).toBe('signed_in');
    });

    it('returns none when the exchange fails', async () => {
      auth.exchangeCodeForSession.mockResolvedValueOnce({ error: { message: 'bad code' } });
      const result = await createSessionFromUrl(`${WEB}?code=xyz`);
      expect(result).toBe('none');
    });
  });

  // Security scan F3: anyone could send `smokeledger://auth/callback#access_token=…`
  // minted for THEIR account and silently sign the victim's app into it.
  describe('implicit hash path (tokens in URL fragment) is rejected', () => {
    it.each([
      `${DEEP}#access_token=AAA&refresh_token=BBB&type=recovery`,
      `${DEEP}#access_token=AAA&refresh_token=BBB&type=signup`,
      `${DEEP}#access_token=AAA&refresh_token=BBB`,
    ])('never sets a session from %s', async (url) => {
      expect(await createSessionFromUrl(url)).toBe('none');
      expect(auth.setSession).not.toHaveBeenCalled();
    });
  });

  describe('no recognizable parameters', () => {
    it('returns none for a bare callback url', async () => {
      expect(await createSessionFromUrl(WEB)).toBe('none');
    });

    it('returns none for a malformed url', async () => {
      expect(await createSessionFromUrl('not a url')).toBe('none');
    });
  });
});

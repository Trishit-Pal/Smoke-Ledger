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

  describe('implicit hash path (tokens in URL fragment)', () => {
    it('sets the session and reports recovery', async () => {
      const result = await createSessionFromUrl(
        `${DEEP}#access_token=AAA&refresh_token=BBB&type=recovery`,
      );
      expect(auth.setSession).toHaveBeenCalledWith({ access_token: 'AAA', refresh_token: 'BBB' });
      expect(result).toBe('recovery');
    });

    it('reports signed_up when the hash link is a signup confirmation', async () => {
      const result = await createSessionFromUrl(
        `${DEEP}#access_token=AAA&refresh_token=BBB&type=signup`,
      );
      expect(result).toBe('signed_up');
    });

    it('reports signed_in for a plain token hash', async () => {
      const result = await createSessionFromUrl(`${DEEP}#access_token=AAA&refresh_token=BBB`);
      expect(result).toBe('signed_in');
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

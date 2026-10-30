/**
 * Security scan F2 (CWE-863): the delete-account re-auth gate read the
 * account-wide `last_sign_in_at`, so a stale stolen session passed whenever the
 * owner had signed in anywhere recently. The gate must look at the presenting
 * token's own `amr` claim: when THIS session last proved a credential.
 */
import * as fs from 'fs';
import * as path from 'path';
import { hasRecentSignIn } from '../../supabase/functions/_shared/recentAuth';

const NOW = 1_800_000_000_000; // ms
const minAgo = (m: number): number => Math.floor((NOW - m * 60_000) / 1000);

function bearer(payload: unknown): string {
  const b64url = (s: string) => Buffer.from(s).toString('base64url');
  return `Bearer ${b64url('{"alg":"HS256"}')}.${b64url(JSON.stringify(payload))}.sig`;
}

describe('hasRecentSignIn', () => {
  it.each(['password', 'otp', 'magiclink', 'recovery', 'email/signup'])(
    'accepts a %s sign-in inside the window',
    (method) => {
      expect(hasRecentSignIn(bearer({ amr: [{ method, timestamp: minAgo(5) }] }), NOW, 15)).toBe(true);
    },
  );

  it('rejects a sign-in older than the window', () => {
    expect(hasRecentSignIn(bearer({ amr: [{ method: 'password', timestamp: minAgo(20) }] }), NOW, 15)).toBe(false);
  });

  it('never counts a token refresh, so a stolen refresh token cannot refresh into the window', () => {
    const amr = [
      { method: 'token_refresh', timestamp: minAgo(1) },
      { method: 'password', timestamp: minAgo(60) },
    ];
    expect(hasRecentSignIn(bearer({ amr }), NOW, 15)).toBe(false);
  });

  it('accepts when any real sign-in entry is fresh', () => {
    const amr = [
      { method: 'token_refresh', timestamp: minAgo(1) },
      { method: 'otp', timestamp: minAgo(3) },
    ];
    expect(hasRecentSignIn(bearer({ amr }), NOW, 15)).toBe(true);
  });

  it.each(['anonymous', 'token_refresh', 'something_new'])('does not count method %j', (method) => {
    expect(hasRecentSignIn(bearer({ amr: [{ method, timestamp: minAgo(1) }] }), NOW, 15)).toBe(false);
  });

  it('rejects a timestamp claimed to be in the future', () => {
    expect(hasRecentSignIn(bearer({ amr: [{ method: 'password', timestamp: minAgo(-10) }] }), NOW, 15)).toBe(false);
  });

  it.each([
    ['no header', null],
    ['no Bearer prefix', 'abc.def.ghi'],
    ['not a JWT', 'Bearer nonsense'],
    ['payload not JSON', 'Bearer aaa.%%%.sig'],
    ['no amr claim', bearer({ sub: 'u1' })],
    ['amr not an array', bearer({ amr: 'password' })],
    ['entry without timestamp', bearer({ amr: [{ method: 'password' }] })],
  ])('fails closed on %s', (_label, header) => {
    expect(hasRecentSignIn(header as string | null, NOW, 15)).toBe(false);
  });

  it('fails closed on a nonsensical window', () => {
    const header = bearer({ amr: [{ method: 'password', timestamp: minAgo(1) }] });
    expect(hasRecentSignIn(header, NOW, Number.NaN)).toBe(false);
    expect(hasRecentSignIn(header, NOW, 0)).toBe(false);
  });
});

describe('delete-account uses the session-bound gate', () => {
  const source = fs.readFileSync(
    path.resolve(__dirname, '../../supabase/functions/delete-account/index.ts'),
    'utf8',
  );

  it('checks the presenting token, not the account-wide last_sign_in_at', () => {
    expect(source).toContain('hasRecentSignIn(authHeader, Date.now(), REAUTH_WINDOW_MIN)');
    expect(source).not.toContain('last_sign_in_at');
  });
});

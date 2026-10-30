/**
 * rate_limit_counters must not hold raw emails, phone numbers or IPs, and must
 * never be purgeable by sending the same key to a different bucket kind.
 */
const rpc = jest.fn();

jest.mock('next/headers', () => ({ headers: jest.fn() }), { virtual: true });
jest.mock('@web/lib/supabase/admin', () => ({ createAdminClient: () => ({ rpc }) }));

import { checkRateLimits } from '@web/lib/auth/rateLimit';

const SECRET = 'test-service-role-secret';

function sentKeys(): string[] {
  return rpc.mock.calls.map(([, args]) => (args as { p_key: string }).p_key);
}

describe('checkRateLimits key hashing', () => {
  const original = process.env.SUPABASE_SERVICE_ROLE_KEY;

  beforeEach(() => {
    rpc.mockReset().mockResolvedValue({ data: true, error: null });
    process.env.SUPABASE_SERVICE_ROLE_KEY = SECRET;
  });

  afterAll(() => {
    process.env.SUPABASE_SERVICE_ROLE_KEY = original;
  });

  it('sends a keyed hash instead of the raw identity', async () => {
    await checkRateLimits([
      { kind: 'pw_login_email', key: 'victim@example.com', max: 5, windowSec: 900 },
      { kind: 'otp_phone', key: '+919876543210', max: 3, windowSec: 600 },
      { kind: 'pw_login_ip', key: '203.0.113.7', max: 10, windowSec: 600 },
    ]);
    const keys = sentKeys();
    expect(keys).toHaveLength(3);
    for (const key of keys) expect(key).toMatch(/^[0-9a-f]{64}$/);
    expect(keys.join('')).not.toMatch(/victim|example|9876543210|203\.0\.113/);
  });

  it('is stable for the same identity and distinct across identities', async () => {
    const bucket = { kind: 'k', max: 1, windowSec: 60 };
    await checkRateLimits([{ ...bucket, key: 'a@b.co' }]);
    await checkRateLimits([{ ...bucket, key: 'a@b.co' }]);
    await checkRateLimits([{ ...bucket, key: 'c@d.co' }]);
    const [first, second, third] = sentKeys();
    expect(first).toBe(second);
    expect(first).not.toBe(third);
  });

  it('depends on the server secret, so the hash cannot be recomputed from the identity alone', async () => {
    await checkRateLimits([{ kind: 'k', key: 'a@b.co', max: 1, windowSec: 60 }]);
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'a-different-secret';
    await checkRateLimits([{ kind: 'k', key: 'a@b.co', max: 1, windowSec: 60 }]);
    const [first, second] = sentKeys();
    expect(first).not.toBe(second);
  });

  it('still reports an exhausted bucket', async () => {
    rpc.mockResolvedValueOnce({ data: false, error: null });
    await expect(
      checkRateLimits([{ kind: 'k', key: 'a@b.co', max: 1, windowSec: 60 }]),
    ).resolves.toBe(false);
  });
});

/**
 * TDD for web/lib/auth/withTimeout.ts — a small promise-timeout race used to
 * fast-fail auth calls so a slow/unreachable Supabase host shows a clear error
 * in ~15s instead of hanging the form for 30–60s. Written RED first.
 */
import { withTimeout, TimeoutError, DEFAULT_AUTH_TIMEOUT_MS } from '../../web/lib/auth/withTimeout';

describe('withTimeout', () => {
  it('resolves with the value when the promise settles before the timeout', async () => {
    const result = await withTimeout(Promise.resolve('ok'), 50);
    expect(result).toBe('ok');
  });

  it('rejects with TimeoutError when the promise exceeds the timeout', async () => {
    const slow = new Promise<string>((resolve) => setTimeout(() => resolve('late'), 100));
    await expect(withTimeout(slow, 20)).rejects.toBeInstanceOf(TimeoutError);
  });

  it('propagates the original rejection when the promise rejects before timeout', async () => {
    const failing = Promise.reject(new Error('boom'));
    await expect(withTimeout(failing, 50)).rejects.toThrow('boom');
  });

  it('accepts a Supabase-style thenable (PromiseLike), not just a Promise', async () => {
    const thenable: PromiseLike<number> = {
      then(onfulfilled) {
        return Promise.resolve(7).then(onfulfilled);
      },
    };
    await expect(withTimeout(thenable, 50)).resolves.toBe(7);
  });

  it('exposes a sane default auth timeout in the 10–20s range', () => {
    expect(DEFAULT_AUTH_TIMEOUT_MS).toBeGreaterThanOrEqual(10_000);
    expect(DEFAULT_AUTH_TIMEOUT_MS).toBeLessThanOrEqual(20_000);
  });
});

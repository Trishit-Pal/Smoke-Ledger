/**
 * TDD for web/lib/auth/authCatch.ts — the shared catch helpers used by the auth
 * Server Actions. Two jobs:
 *   1. isNextRedirectError — never swallow Next's redirect() signal.
 *   2. safeAuthCatchState — return a GENERIC message on unexpected errors so we
 *      stop leaking raw internal error text to the client (the TEMPORARY
 *      `diagnostic_error` branch in login/actions.ts returned `err.message`).
 * Written RED first.
 */
import { isNextRedirectError, safeAuthCatchState } from '../../web/lib/auth/authCatch';

describe('isNextRedirectError', () => {
  it('returns true for a NEXT_REDIRECT digest error', () => {
    expect(isNextRedirectError({ digest: 'NEXT_REDIRECT;replace;/dashboard;303;' })).toBe(true);
  });

  it('returns false for an ordinary Error', () => {
    expect(isNextRedirectError(new Error('db down'))).toBe(false);
  });

  it('returns false for null and for a non-redirect digest', () => {
    expect(isNextRedirectError(null)).toBe(false);
    expect(isNextRedirectError({ digest: 'NEXT_NOT_FOUND' })).toBe(false);
  });
});

describe('safeAuthCatchState (information-disclosure guard)', () => {
  it('does not leak the raw error text into the client-facing message', () => {
    const state = safeAuthCatchState(
      new Error('postgres://user:pw@db.internal/prod connection refused'),
    );
    expect(state.code).toBe('dependency_failure');
    expect(state.message).not.toMatch(/postgres|connection refused|pw@db|internal/i);
  });

  it('returns the same generic message regardless of the underlying error', () => {
    const a = safeAuthCatchState(new Error('secret-A'));
    const b = safeAuthCatchState('weird string carrying TOKEN abc123');
    expect(a.message).toBe(b.message);
    expect(a.message).not.toContain('secret-A');
    expect(b.message).not.toContain('abc123');
  });

  it('produces a non-empty, user-friendly message', () => {
    const { message } = safeAuthCatchState(new Error('x'));
    expect(typeof message).toBe('string');
    expect(message.length).toBeGreaterThan(10);
  });
});

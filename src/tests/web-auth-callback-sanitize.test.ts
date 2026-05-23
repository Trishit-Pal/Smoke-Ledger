/**
 * Tests for the callback-side sanitizeNextPath logic in
 * web/app/auth/callback/route.ts.
 *
 * TDD note: the `?ref=widget` querystring preservation test was written FIRST
 * as a failing test (Important #2 from code review). The old implementation
 * returned the normalised `pathname` (stripping query/hash), not the original
 * `raw` value — causing `?ref=widget` to be silently dropped on redirect.
 *
 * The fix: `_sanitizeCallbackNextPath` returns `raw` when the normalised
 * pathname is allowed, matching the contract of the shared
 * `sanitizeNextPath` in web/lib/auth/redirect.ts.
 */
import { _sanitizeCallbackNextPath } from '../../web/lib/auth/callbackNextPath';

describe('_sanitizeCallbackNextPath (callback-side allowlist)', () => {
  // -------------------------------------------------------------------------
  // SHARED allowlist (ALLOWED_NEXT_PATHS)
  // -------------------------------------------------------------------------
  describe('shared post-auth paths', () => {
    it.each([
      '/dashboard',
      '/log',
      '/log/new',
      '/history',
      '/trends',
      '/settings',
    ])('returns %s unchanged', (path) => {
      expect(_sanitizeCallbackNextPath(path)).toBe(path);
    });

    it('preserves querystring on an allowed path (Important #2 regression guard)', () => {
      // This was the failing case before the fix: the old implementation
      // returned pathname ('/log') instead of raw ('/log?ref=widget').
      expect(_sanitizeCallbackNextPath('/log?ref=widget')).toBe('/log?ref=widget');
    });

    it('preserves hash on an allowed path', () => {
      expect(_sanitizeCallbackNextPath('/dashboard#section')).toBe('/dashboard#section');
    });

    it('preserves querystring AND hash together', () => {
      expect(_sanitizeCallbackNextPath('/history?page=2#entry-5')).toBe('/history?page=2#entry-5');
    });
  });

  // -------------------------------------------------------------------------
  // CALLBACK-ONLY paths (CALLBACK_ONLY_PATHS)
  // -------------------------------------------------------------------------
  describe('callback-only paths', () => {
    it('returns /reset-password unchanged', () => {
      expect(_sanitizeCallbackNextPath('/reset-password')).toBe('/reset-password');
    });
  });

  // -------------------------------------------------------------------------
  // ONBOARDING explicit allowlist (F2 — was a startsWith('/onboarding/')
  // prefix wildcard; tightened to an explicit Set of the 7 real onboarding
  // routes so an unrecognised /onboarding/<x> can't slip through.)
  // -------------------------------------------------------------------------
  describe('onboarding explicit allowlist (F2)', () => {
    it.each([
      '/onboarding',
      '/onboarding/baseline',
      '/onboarding/brands',
      '/onboarding/goal',
      '/onboarding/privacy',
      '/onboarding/setup',
      '/onboarding/usage',
    ])('returns %s unchanged', (path) => {
      expect(_sanitizeCallbackNextPath(path)).toBe(path);
    });

    it('preserves querystring on an onboarding path', () => {
      expect(_sanitizeCallbackNextPath('/onboarding/setup?step=2')).toBe('/onboarding/setup?step=2');
    });

    it.each([
      '/onboarding/evil',
      '/onboarding/admin',
      '/onboarding/baseline/extra',
      '/onboarding/setup/../../etc',
      '/onboarding/PRIVACY',
    ])('returns null for unrecognised onboarding path %s', (path) => {
      expect(_sanitizeCallbackNextPath(path)).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // REJECTED inputs (must return null)
  // -------------------------------------------------------------------------
  describe('rejected inputs', () => {
    it('returns null for null', () => {
      expect(_sanitizeCallbackNextPath(null)).toBeNull();
    });

    it('returns null for empty string', () => {
      expect(_sanitizeCallbackNextPath('')).toBeNull();
    });

    it('returns null for protocol-relative URL', () => {
      expect(_sanitizeCallbackNextPath('//evil.com')).toBeNull();
    });

    it('returns null for absolute URL with https scheme', () => {
      expect(_sanitizeCallbackNextPath('https://evil.com')).toBeNull();
    });

    it('returns null for a path not in any allowlist', () => {
      expect(_sanitizeCallbackNextPath('/admin')).toBeNull();
    });

    it('returns null for path traversal disguised as allowed prefix', () => {
      // /dashboard/../admin normalises to /admin — not in any allowlist.
      expect(_sanitizeCallbackNextPath('/dashboard/../admin')).toBeNull();
    });

    it('returns null for an embedded newline (response-splitting guard)', () => {
      expect(_sanitizeCallbackNextPath('/dashboard\n')).toBeNull();
    });

    it('returns raw for onboarding path with nested ?next= (onboarding page sanitizes its own params)', () => {
      // The callback allows the onboarding hop including its query string —
      // /onboarding/privacy is in the explicit F2 allowlist. The querystring
      // (including any nested `?next=`) is preserved. The onboarding page is
      // responsible for sanitizing its own ?next= param using the shared
      // sanitizeNextPath from web/lib/auth/redirect.ts, which rejects absolute
      // URLs. This is NOT an open redirect at the callback level.
      //
      // F2 narrows the threat envelope: even if a future onboarding page does
      // consume `?next=` without sanitization, an attacker can no longer
      // pivot through /onboarding/<arbitrary> — only through one of the 7
      // explicitly allowlisted onboarding paths. New onboarding routes must
      // be added to ONBOARDING_PATHS in callback/route.ts.
      expect(_sanitizeCallbackNextPath('/onboarding/privacy?next=https://evil.com')).toBe(
        '/onboarding/privacy?next=https://evil.com',
      );
    });
  });
});

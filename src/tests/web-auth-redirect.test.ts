/**
 * Tests for web/lib/auth/redirect.ts
 *
 * These run under the root Jest config (same glob as other src/tests files)
 * and import from web/lib via a relative path — same pattern as
 * web-cookieOptions.test.ts.
 *
 * TDD: tests were written before the implementation and initially failed
 * against the old, permissive sanitizer in login/page.tsx.
 */
import {
  ALLOWED_NEXT_PATHS,
  sanitizeNextPath,
  isAllowedNextPath,
} from '../../web/lib/auth/redirect';

// ---------------------------------------------------------------------------
// ALLOWED_NEXT_PATHS set
// ---------------------------------------------------------------------------
describe('ALLOWED_NEXT_PATHS', () => {
  it('contains all expected post-auth destinations', () => {
    expect(ALLOWED_NEXT_PATHS.has('/dashboard')).toBe(true);
    expect(ALLOWED_NEXT_PATHS.has('/log')).toBe(true);
    expect(ALLOWED_NEXT_PATHS.has('/log/new')).toBe(true);
    expect(ALLOWED_NEXT_PATHS.has('/history')).toBe(true);
    expect(ALLOWED_NEXT_PATHS.has('/trends')).toBe(true);
    expect(ALLOWED_NEXT_PATHS.has('/settings')).toBe(true);
  });

  it('does NOT contain onboarding paths', () => {
    expect(ALLOWED_NEXT_PATHS.has('/onboarding/privacy')).toBe(false);
    expect(ALLOWED_NEXT_PATHS.has('/onboarding/setup')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// sanitizeNextPath
// ---------------------------------------------------------------------------
describe('sanitizeNextPath', () => {
  // --- allowed paths ---
  it('passes /dashboard through unchanged', () => {
    expect(sanitizeNextPath('/dashboard')).toBe('/dashboard');
  });

  it('passes /log through unchanged', () => {
    expect(sanitizeNextPath('/log')).toBe('/log');
  });

  it('passes /history through unchanged', () => {
    expect(sanitizeNextPath('/history')).toBe('/history');
  });

  it('passes /trends through unchanged', () => {
    expect(sanitizeNextPath('/trends')).toBe('/trends');
  });

  it('passes /settings through unchanged', () => {
    expect(sanitizeNextPath('/settings')).toBe('/settings');
  });

  it('passes /log/new through unchanged', () => {
    expect(sanitizeNextPath('/log/new')).toBe('/log/new');
  });

  it('preserves querystring on an allowed path', () => {
    // The path /log is in the allowlist; the ?ref= querystring is preserved.
    expect(sanitizeNextPath('/log?ref=widget')).toBe('/log?ref=widget');
  });

  it('preserves hash on an allowed path', () => {
    expect(sanitizeNextPath('/dashboard#section')).toBe('/dashboard#section');
  });

  // --- fallback cases ---
  it('returns fallback for null', () => {
    expect(sanitizeNextPath(null)).toBe('/dashboard');
  });

  it('returns fallback for empty string', () => {
    expect(sanitizeNextPath('')).toBe('/dashboard');
  });

  it('returns fallback for protocol-relative URL', () => {
    expect(sanitizeNextPath('//evil.com')).toBe('/dashboard');
  });

  it('returns fallback for absolute URL with https scheme', () => {
    expect(sanitizeNextPath('https://evil.com')).toBe('/dashboard');
  });

  it('returns fallback for absolute URL with http scheme', () => {
    expect(sanitizeNextPath('http://evil.com/dashboard')).toBe('/dashboard');
  });

  it('returns fallback for path not in allowlist', () => {
    expect(sanitizeNextPath('/admin')).toBe('/dashboard');
  });

  it('returns fallback for /onboarding/privacy (not in post-auth allowlist)', () => {
    // Core phishing vector from the audit: attacker embeds a redirect chain
    // by using an onboarding path with a nested ?next= pointing outward.
    expect(sanitizeNextPath('/onboarding/privacy?next=https://evil.com')).toBe('/dashboard');
  });

  it('returns fallback for path traversal disguised as allowed prefix', () => {
    // /dashboard/../admin — the pathname extracted via URL parsing normalises
    // to /admin which is not in the allowlist.
    expect(sanitizeNextPath('/dashboard/../admin')).toBe('/dashboard');
  });

  it('is case-sensitive (wrong case returns fallback)', () => {
    // The allowlist uses exact lowercase paths.
    expect(sanitizeNextPath('/Dashboard')).toBe('/dashboard');
    expect(sanitizeNextPath('/DASHBOARD')).toBe('/dashboard');
  });

  it('returns fallback for a path with an embedded newline', () => {
    expect(sanitizeNextPath('/dashboard\n')).toBe('/dashboard');
  });

  // --- custom fallback ---
  it('respects a custom fallback argument', () => {
    expect(sanitizeNextPath(null, '/log')).toBe('/log');
    expect(sanitizeNextPath('//evil.com', '/history')).toBe('/history');
  });
});

// ---------------------------------------------------------------------------
// isAllowedNextPath
// ---------------------------------------------------------------------------
describe('isAllowedNextPath', () => {
  it('returns true for an allowed path', () => {
    expect(isAllowedNextPath('/dashboard')).toBe(true);
    expect(isAllowedNextPath('/log?ref=widget')).toBe(true);
  });

  it('returns false for null', () => {
    expect(isAllowedNextPath(null)).toBe(false);
  });

  it('returns false for a disallowed path', () => {
    expect(isAllowedNextPath('//evil.com')).toBe(false);
    expect(isAllowedNextPath('/onboarding/privacy?next=https://evil.com')).toBe(false);
    expect(isAllowedNextPath('/Dashboard')).toBe(false);
  });
});

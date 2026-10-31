/**
 * Security scan F1 / F5 (CWE-601): both `next=` sanitizers checked the parsed
 * pathname of `new URL(raw, 'https://x')` but returned the RAW string. WHATWG
 * parsing treats `\` as `/`, so `/\evil.com/dashboard` parses to host evil.com
 * with an allowlisted pathname, passes, and the caller then resolves the raw
 * value against the real origin and redirects off-site.
 *
 * The property that matters: whatever a sanitizer returns resolves to the
 * app's own origin.
 */
import { isAllowedNextPath, sanitizeNextPath } from '../../web/lib/auth/redirect';
import { sanitizeCallbackNextPath } from '../../web/lib/auth/callbackNextPath';

const APP = 'https://app.example';

// The query string has already been percent-decoded by searchParams.get(), so
// `next=%2F%5Cevil.com%2Fdashboard` arrives as `/\evil.com/dashboard`.
const BACKSLASH_BYPASSES = [
  '/\\evil.com/dashboard',
  '/\\evil.com/reset-password',
  '/\\/evil.com/dashboard',
  '/\\\\evil.com/dashboard',
  '\\\\evil.com/dashboard',
  '/%5cevil.com/dashboard',
  '/%5Cevil.com/reset-password',
  '/dashboard\\..\\..\\evil',
];

describe('next= sanitizers reject backslash host smuggling', () => {
  it.each(BACKSLASH_BYPASSES)('sanitizeNextPath(%j) falls back', (raw) => {
    expect(sanitizeNextPath(raw)).toBe('/dashboard');
    expect(isAllowedNextPath(raw)).toBe(false);
  });

  it.each(BACKSLASH_BYPASSES)('sanitizeCallbackNextPath(%j) is null', (raw) => {
    expect(sanitizeCallbackNextPath(raw)).toBeNull();
  });
});

describe('whatever a sanitizer returns stays on the app origin', () => {
  const inputs = [
    ...BACKSLASH_BYPASSES,
    '/dashboard',
    '/log?ref=widget',
    '/dashboard#section',
    '/reset-password?hint=x',
    '/onboarding/privacy?next=https://evil.com',
    '//evil.com/dashboard',
    'https://evil.com/dashboard',
  ];

  it.each(inputs)('%j', (raw) => {
    expect(new URL(sanitizeNextPath(raw), APP).origin).toBe(APP);
    const callback = sanitizeCallbackNextPath(raw);
    if (callback !== null) expect(new URL(callback, APP).origin).toBe(APP);
  });
});

describe('legitimate destinations are unchanged', () => {
  it.each(['/log?ref=widget', '/dashboard#section', '/settings'])('sanitizeNextPath keeps %j', (raw) => {
    expect(sanitizeNextPath(raw)).toBe(raw);
  });

  it.each(['/reset-password?hint=x', '/onboarding/privacy?next=https://evil.com', '/log/new'])(
    'sanitizeCallbackNextPath keeps %j',
    (raw) => {
      expect(sanitizeCallbackNextPath(raw)).toBe(raw);
    },
  );
});

/**
 * Shared post-auth redirect helper.
 *
 * Strict allowlist approach: only paths explicitly listed here are permitted
 * as ?next= destinations after login. Anything else falls back to /dashboard.
 *
 * Onboarding paths are intentionally excluded — the auth callback route
 * handles onboarding routing as an internal server-side concern, not as a
 * user-controlled ?next= destination.
 *
 * Security properties:
 *   - Absolute URLs are rejected (no http/https/data schemes).
 *   - Protocol-relative paths (//evil.com) are rejected.
 *   - Path traversal sequences normalise via URL parsing; only exact
 *     allowlisted pathnames pass.
 *   - Case-sensitive: /Dashboard does not match /dashboard.
 *   - Query strings and hashes are preserved when the *path* is allowed
 *     (legitimate use-case: /log?ref=widget), but the path itself must be
 *     in the allowlist.
 */

/** Hard-coded set of permitted post-auth redirect destinations. */
export const ALLOWED_NEXT_PATHS: ReadonlySet<string> = new Set([
  '/dashboard',
  '/log',
  '/log/new',
  '/history',
  '/trends',
  '/settings',
]);

/**
 * Returns true when `raw` resolves to an allowed post-auth path.
 *
 * Uses the same logic as `sanitizeNextPath` so the two are always in sync.
 */
export function isAllowedNextPath(raw: string | null): boolean {
  return sanitizeNextPath(raw, '') !== '';
}

/**
 * Sanitizes a ?next= parameter value for safe post-auth redirection.
 *
 * Algorithm:
 *   1. Reject null / empty → fallback.
 *   2. Reject anything that doesn't start with '/' (absolute URLs, etc.) → fallback.
 *   3. Reject protocol-relative paths starting with '//' → fallback.
 *   4. Parse the value as a relative URL against a synthetic origin so that
 *      path traversal sequences (e.g. /dashboard/../admin) are normalised.
 *   5. Extract the normalised pathname and check it against ALLOWED_NEXT_PATHS.
 *      If the pathname is not in the allowlist → fallback.
 *   6. Return the ORIGINAL `raw` value (with any query string / hash intact)
 *      so that legitimate deep-links like /log?ref=widget are preserved.
 *
 * @param raw      The raw ?next= parameter value from the URL.
 * @param fallback The destination to return when `raw` is not allowed.
 *                 Defaults to '/dashboard'.
 */
export function sanitizeNextPath(
  raw: string | null,
  fallback: string = '/dashboard',
): string {
  if (!raw) return fallback;

  // Reject anything that doesn't open with a single slash.
  if (!raw.startsWith('/')) return fallback;

  // Reject protocol-relative URLs (//evil.com).
  if (raw.startsWith('//')) return fallback;

  // Reject values containing ASCII control characters (CR, LF, NUL, etc.).
  // These can be used for HTTP response splitting when the path is placed in
  // a Location header.
  // eslint-disable-next-line no-control-regex
  if (/[\x00-\x1f\x7f]/.test(raw)) return fallback;

  // Normalise path traversal sequences by parsing as a relative URL.
  // We use a dummy origin so the URL constructor accepts relative paths.
  let normalizedPathname: string;
  try {
    const parsed = new URL(raw, 'https://x');
    normalizedPathname = parsed.pathname;
  } catch {
    return fallback;
  }

  if (!ALLOWED_NEXT_PATHS.has(normalizedPathname)) return fallback;

  // The path is safe — return the original value so query/hash are preserved.
  return raw;
}

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

const PARSE_BASE = 'https://x';

/**
 * Parses a `?next=` value as a path on our own origin, or returns null.
 *
 * This is the one place both post-auth sanitizers (this file and
 * callbackNextPath.ts) decide "same origin". Callers must redirect to the
 * value built from the parsed URL (`toRelativePath`), never to `raw`: WHATWG
 * parsing treats `\` as `/`, so `/\evil.com/dashboard` has an allowlisted
 * pathname but host evil.com, and resolving the raw string redirects off-site.
 */
export function parseSameOriginPath(raw: string | null): URL | null {
  if (!raw) return null;

  // Only a single leading slash: no absolute URLs, no protocol-relative //host.
  if (!raw.startsWith('/') || raw.startsWith('//')) return null;

  // ASCII control characters (CR, LF, NUL…) enable header splitting in Location.
  // eslint-disable-next-line no-control-regex
  if (/[\x00-\x1f\x7f]/.test(raw)) return null;

  // A backslash, raw or percent-encoded, can smuggle a host (see above).
  if (/\\|%5c/i.test(raw)) return null;

  let parsed: URL;
  try {
    parsed = new URL(raw, PARSE_BASE);
  } catch {
    return null;
  }
  return parsed.origin === PARSE_BASE ? parsed : null;
}

/** The redirect target for a parsed path: path, query and hash, no host. */
export function toRelativePath(url: URL): string {
  return url.pathname + url.search + url.hash;
}

/**
 * Returns true when `raw` resolves to an allowed post-auth path.
 */
export function isAllowedNextPath(raw: string | null): boolean {
  const parsed = parseSameOriginPath(raw);
  return parsed !== null && ALLOWED_NEXT_PATHS.has(parsed.pathname);
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
  const parsed = parseSameOriginPath(raw);
  if (parsed === null || !ALLOWED_NEXT_PATHS.has(parsed.pathname)) return fallback;
  // Rebuilt from the parsed URL (query and hash kept), never the raw input.
  return toRelativePath(parsed);
}

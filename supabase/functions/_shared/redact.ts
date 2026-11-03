// Redaction for error_events text. Single source: Deno edge functions import it
// directly and src/lib/logger.ts (web + mobile) imports it by relative path.
// Pure, dependency-free, no lookbehind (Hermes-safe). Over-redacting a
// diagnostic is acceptable; storing personal data is not.

// The input is capped first (MAX_INPUT) and the rest are bounded where a bound loses nothing: unbounded runs made
// these patterns quadratic (100 KB of 'a-' took ~46 s).
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]{1,63}(?:\.[A-Za-z0-9-]{1,63}){0,8}\.[A-Za-z]{2,24}/g;
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
const BEARER = /\bBearer\s{1,8}[A-Za-z0-9._~+/=-]{1,2048}/gi;
const JWT = /\b[A-Za-z0-9_-]{10,2048}\.[A-Za-z0-9_-]{10,2048}\.[A-Za-z0-9_-]{10,2048}/g;
// 24+ char secret-looking run that contains a digit (keeps long plain words).
const SECRET = /\b(?=[A-Za-z0-9_-]*\d)[A-Za-z0-9_-]{24,}\b/g;
// Digits with optional single spaces/dashes/parentheses between; kept only if it has 10+ digits.
const PHONE_RUN = /\+?\(?\d[\d ()-]{8,40}\d/g;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}/; // timestamps are not phones
const LONG_DIGITS = /\d{6,}/g;
const DYNAMIC_SEGMENT = new RegExp(`^(?:${UUID.source}|${JWT.source}|${SECRET.source})$`, 'i');
const MIN_ID_DIGITS = 6;

const MIN_PHONE_DIGITS = 10;
const MAX_INPUT = 2000;
const MAX_ROUTE = 120;

export function redactText(input: string, max?: number): string {
  // Cap before scanning. A cut token loses its TLD / third segment so cannot
  // match as a fragment, and the final `max` cut still happens after redaction.
  const out = input
    .slice(0, MAX_INPUT)
    .replace(EMAIL, '[email]')
    .replace(UUID, '[id]')
    .replace(BEARER, 'Bearer [token]')
    .replace(JWT, '[token]')
    .replace(SECRET, '[token]')
    .replace(PHONE_RUN, (m) =>
      !ISO_DATE.test(m) && m.replace(/\D/g, '').length >= MIN_PHONE_DIGITS ? '[phone]' : m,
    )
    .replace(LONG_DIGITS, '[n]');
  // Redact first, then cut: truncating first could leave a token fragment.
  return max === undefined ? out : out.slice(0, max);
}

function isDynamicSegment(seg: string): boolean {
  return (
    /^\d+$/.test(seg) ||
    seg.replace(/\D/g, '').length >= MIN_ID_DIGITS ||
    DYNAMIC_SEGMENT.test(seg) ||
    seg.includes('@')
  );
}

/** Path only: drops query + fragment, replaces dynamic segments with `:id`. */
export function redactRoute(route: string): string {
  const path = route.slice(0, MAX_INPUT).split(/[?#]/, 1)[0];
  return path
    .split('/')
    .map((seg) => (isDynamicSegment(seg) ? ':id' : seg))
    .join('/')
    .slice(0, MAX_ROUTE);
}

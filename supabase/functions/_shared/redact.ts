// Redaction for error_events text. Single source: Deno edge functions import it
// directly and src/lib/logger.ts (web + mobile) imports it by relative path.
// Pure, dependency-free, no lookbehind (Hermes-safe). Over-redacting a
// diagnostic is acceptable; storing personal data is not.

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g;
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
const BEARER = /\bBearer\s+[A-Za-z0-9._~+/=-]+/gi;
const JWT = /\b[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g;
// 24+ char secret-looking run that contains a digit (keeps long plain words).
const SECRET = /\b(?=[A-Za-z0-9_-]*\d)[A-Za-z0-9_-]{24,}\b/g;
// Digits with optional single spaces/dashes between; kept only if it has 10+ digits.
const PHONE_RUN = /\+?\d[\d \-]{8,}\d/g;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}/; // timestamps are not phones
const LONG_DIGITS = /\d{6,}/g;

const MIN_PHONE_DIGITS = 10;
const MAX_ROUTE = 120;

export function redactText(input: string, max?: number): string {
  const out = input
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
  if (/^\d+$/.test(seg)) return true;
  const probe = new RegExp(`^(?:${UUID.source}|${JWT.source}|${SECRET.source})$`, 'i');
  return probe.test(seg) || seg.includes('@');
}

/** Path only: drops query + fragment, replaces dynamic segments with `:id`. */
export function redactRoute(route: string): string {
  const path = route.split(/[?#]/, 1)[0];
  return path
    .split('/')
    .map((seg) => (isDynamicSegment(seg) ? ':id' : seg))
    .join('/')
    .slice(0, MAX_ROUTE);
}

// Pure helpers for the optional profile mobile number.
// Stored as E.164 (e.g. +919876543210). India (+91) is the default country code
// for bare 10-digit input. No I/O — safe to unit test and share web/mobile.

const E164_RE = /^\+[1-9]\d{7,14}$/;
const SEPARATORS_RE = /[\s\-()]/g;

/**
 * Normalize loosely-typed input to E.164, or null if it can't be made valid.
 * - "+91 98765 43210" / "+919876543210" → "+919876543210"
 * - "9876543210" (10-digit local) → "+919876543210"
 * - "919876543210" (cc + number, no +) → "+919876543210"
 * - garbage / wrong length → null
 */
export function normalizeToE164(raw: string, defaultCountryCode = '91'): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith('+')) {
    const compact = '+' + trimmed.slice(1).replace(SEPARATORS_RE, '');
    return E164_RE.test(compact) ? compact : null;
  }

  const digits = trimmed.replace(SEPARATORS_RE, '');
  if (!/^\d+$/.test(digits)) return null;

  // Bare 10-digit local number → prefix the default country code.
  if (digits.length === 10) {
    const candidate = `+${defaultCountryCode}${digits}`;
    return E164_RE.test(candidate) ? candidate : null;
  }

  // Otherwise assume it already carries a country code, just missing the '+'.
  const candidate = `+${digits}`;
  return E164_RE.test(candidate) ? candidate : null;
}

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * The earliest date the mobile number may change again, or null if it has never
 * been set (changeable now). Mirrors the DB trigger's 30-day window.
 */
export function nextMobileChangeDate(mobileChangedAt: string | null | undefined): Date | null {
  if (!mobileChangedAt) return null;
  const changed = new Date(mobileChangedAt);
  if (Number.isNaN(changed.getTime())) return null;
  return new Date(changed.getTime() + THIRTY_DAYS_MS);
}

/** True when the mobile number may be changed at `now`. */
export function canChangeMobile(
  mobileChangedAt: string | null | undefined,
  now: Date = new Date(),
): boolean {
  const next = nextMobileChangeDate(mobileChangedAt);
  return next === null || now.getTime() >= next.getTime();
}

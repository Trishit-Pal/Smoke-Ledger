// Pure helpers for the optional profile mobile number.
// Stored as E.164 (e.g. +919876543210). India (+91) is the default country code
// for bare 10-digit input. No I/O — safe to unit test and share web/mobile.

const E164_RE = /^\+[1-9]\d{7,14}$/;
const SEPARATORS_RE = /[\s\-()]/g;

// India-only mobile: +91 followed by exactly 10 digits, first digit 6-9
// (the valid first-digit range for Indian mobile numbers).
export const INDIA_MOBILE_RE = /^\+91[6-9]\d{9}$/;

/**
 * Normalize loosely-typed input to a valid Indian mobile in E.164, or null.
 * - "9876543210" (bare 10-digit, lead 6-9) → "+919876543210"
 * - "+91 98765 43210" / "919876543210" → "+919876543210"
 * - non-+91 country code, lead digit 0-5, or wrong length → null
 */
export function normalizeIndianMobile(raw: string): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  let candidate: string;
  if (trimmed.startsWith('+')) {
    candidate = '+' + trimmed.slice(1).replace(SEPARATORS_RE, '');
  } else {
    const digits = trimmed.replace(SEPARATORS_RE, '');
    if (!/^\d+$/.test(digits)) return null;
    // Bare 10-digit local number → prefix +91; otherwise assume it already
    // carries the 91 country code, just missing the '+'.
    candidate = digits.length === 10 ? `+91${digits}` : `+${digits}`;
  }

  return INDIA_MOBILE_RE.test(candidate) ? candidate : null;
}

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

/**
 * Reduce loosely-typed input to the 10 local digits for the fixed-`+91` field.
 * Tolerates a pasted country code and separators so the input never silently
 * mangles a full number:
 * - "+91 98765 43210" / "919876543210" → "9876543210" (drops the 91 prefix)
 * - "09876543210" → "9876543210" (drops a leading 0 trunk prefix)
 * - "9198765432" (a real 10-digit number starting 91) → unchanged
 * - partial input ("98765") is preserved for as-you-type editing
 * Always clamps to the first 10 digits.
 */
export function toLocalMobileDigits(raw: string): string {
  if (typeof raw !== 'string') return '';
  let digits = raw.replace(/\D/g, '');
  // Only treat a leading 91 as a country code when there are extra digits
  // beyond the 10-digit local number; never strip it from a genuine 10-digit
  // number that happens to start with 91.
  if (digits.length > 10 && digits.startsWith('91')) {
    digits = digits.slice(2);
  } else if (digits.length > 10 && digits.startsWith('0')) {
    digits = digits.replace(/^0+/, '');
  }
  return digits.slice(0, 10);
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

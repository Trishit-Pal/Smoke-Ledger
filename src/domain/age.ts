// Pure domain logic for age + the 18+ eligibility gate.
// Input: a 'YYYY-MM-DD' date of birth + a reference "today" Date. No I/O.
//
// Age is derived from date of birth (never stored as a stale integer) and the
// gate compares calendar parts, not millisecond deltas, so leap years and DST
// can't shift the boundary. Someone born on Feb 29 is treated as turning 18 on
// Mar 1 in a non-leap year — the conservative, age-gate-safe choice.

/** Minimum age to create an account (tobacco-tracking app). */
export const MIN_AGE = 18;

interface DateParts {
  y: number;
  m: number; // 1-12
  d: number; // 1-31
}

/** Parse a strict 'YYYY-MM-DD' string, rejecting impossible calendar dates. */
function parseYmd(iso: string): DateParts | null {
  if (typeof iso !== 'string') return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!match) return null;
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  // Round-trip through Date to reject e.g. 2021-02-30 / 2021-04-31.
  const probe = new Date(Date.UTC(y, m - 1, d));
  if (probe.getUTCFullYear() !== y || probe.getUTCMonth() !== m - 1 || probe.getUTCDate() !== d) {
    return null;
  }
  return { y, m, d };
}

function localParts(ref: Date): DateParts {
  return { y: ref.getFullYear(), m: ref.getMonth() + 1, d: ref.getDate() };
}

/**
 * Integer age in completed years, or null if `dobIso` is not a valid date.
 */
export function computeAge(dobIso: string, today: Date = new Date()): number | null {
  const dob = parseYmd(dobIso);
  if (!dob) return null;
  const t = localParts(today);
  let age = t.y - dob.y;
  if (t.m < dob.m || (t.m === dob.m && t.d < dob.d)) {
    age -= 1;
  }
  return age;
}

/**
 * True when the date of birth implies an age >= MIN_AGE. Invalid or future
 * dates return false (fail closed — never let an unparseable DOB through the gate).
 */
export function isAdult(dobIso: string, today: Date = new Date()): boolean {
  const age = computeAge(dobIso, today);
  return age !== null && age >= MIN_AGE;
}

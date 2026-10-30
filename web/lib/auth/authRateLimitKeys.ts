// DB-backed token-bucket thresholds for the email-sending auth surfaces.
//
// signup / reset / resend each call a public GoTrue endpoint that sends an
// email. These builders encode the per-IP and per-email limits consumed via
// `checkRateLimits` (the same `consume_rate_limit` RPC that guards login/OTP).
// Pure + side-effect-free so the thresholds are unit-testable without the
// server runtime (next/headers, the admin client).
//
// NOTE: this guards the in-app path and prevents accidental self-DoS (e.g. a
// user mashing "resend"). It is NOT a substitute for Supabase-side captcha
// (Turnstile) + native auth rate limits, which are the authoritative control
// against direct calls to the anon-reachable GoTrue endpoints. See SCALING_PLAN
// and the deployment ops checklist.

import type { RateLimitKey } from '@web/lib/auth/rateLimit';

const HOUR_SEC = 3600;

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * The tight email bucket is per (email, IP) pair: keyed on the email alone, anyone
 * who knew a victim's address could burn its 5 attempts and lock the owner out.
 * The looser per-email bucket caps distributed guessing against one account: the
 * sign-in runs server-side, so GoTrue's per-IP limits only ever see Vercel's IPs.
 * Its price is that a determined stranger can lock an address out for up to an hour.
 */
export function loginRateLimitKeys(ip: string, email: string): RateLimitKey[] {
  const normalized = normalizeEmail(email);
  return [
    { kind: 'pw_login_ip', key: ip, max: 10, windowSec: 600 },
    { kind: 'pw_login_email', key: `${normalized}|${ip}`, max: 5, windowSec: 900 },
    { kind: 'pw_login_email_global', key: normalized, max: 30, windowSec: HOUR_SEC },
  ];
}

export function signupRateLimitKeys(ip: string, email: string): RateLimitKey[] {
  return [
    { kind: 'signup_ip', key: ip, max: 5, windowSec: HOUR_SEC },
    { kind: 'signup_email', key: normalizeEmail(email), max: 3, windowSec: HOUR_SEC },
  ];
}

export function resetRateLimitKeys(ip: string, email: string): RateLimitKey[] {
  return [
    { kind: 'reset_ip', key: ip, max: 10, windowSec: HOUR_SEC },
    { kind: 'reset_email', key: normalizeEmail(email), max: 3, windowSec: HOUR_SEC },
  ];
}

export function resendConfirmationRateLimitKeys(email: string): RateLimitKey[] {
  return [{ kind: 'resend_email', key: normalizeEmail(email), max: 3, windowSec: HOUR_SEC }];
}

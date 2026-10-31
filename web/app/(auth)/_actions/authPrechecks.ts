'use server';

// DB-backed rate-limit gates for the email-sending auth surfaces (signup,
// password reset, resend confirmation). The client awaits the relevant gate
// before calling the public GoTrue endpoint, so abuse-through-the-app and
// accidental self-DoS (e.g. mashing "resend") are throttled.
//
// All gates are FAIL-OPEN: a missing/unconfigured service-role key must never
// block a legitimate signup or reset. The authoritative control against direct
// (non-UI) calls to the anon-reachable GoTrue endpoints is Supabase-side
// captcha (Turnstile) + native auth rate limits — see the deployment ops
// checklist and SCALING_PLAN.

import { checkRateLimits, getClientIp } from '@web/lib/auth/rateLimit';
import {
  signupRateLimitKeys,
  resetRateLimitKeys,
  resendConfirmationRateLimitKeys,
} from '@web/lib/auth/authRateLimitKeys';
import { RATE_LIMITED_MESSAGE, type PrecheckResult } from '@web/lib/auth/precheck';

export async function precheckSignupAction(email: string): Promise<PrecheckResult> {
  const ok = await checkRateLimits(signupRateLimitKeys(await getClientIp(), email), { failOpen: true });
  return ok ? { ok: true } : { ok: false, message: RATE_LIMITED_MESSAGE };
}

export async function precheckResetAction(email: string): Promise<PrecheckResult> {
  const ok = await checkRateLimits(resetRateLimitKeys(await getClientIp(), email), { failOpen: true });
  return ok ? { ok: true } : { ok: false, message: RATE_LIMITED_MESSAGE };
}

export async function precheckResendAction(email: string): Promise<PrecheckResult> {
  const ok = await checkRateLimits(resendConfirmationRateLimitKeys(email), { failOpen: true });
  return ok ? { ok: true } : { ok: false, message: RATE_LIMITED_MESSAGE };
}

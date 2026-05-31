// Shared DB-backed token-bucket rate limiting for auth Server Actions.
//
// Extracted from the phone-OTP flow so the password login (and, optionally,
// signup/reset) paths reuse the same `consume_rate_limit` RPC — an atomic
// per-(kind,key) window counter in `rate_limit_counters`, called via the
// service-role admin client. No new dependency: this is the exact mechanism
// that already guards OTP send/verify.

import { headers } from 'next/headers';
import { createAdminClient } from '@web/lib/supabase/admin';

export interface RateLimitKey {
  kind: string;
  key: string;
  max: number;
  windowSec: number;
}

/** Best-effort client IP from the proxy headers Vercel sets in front of the app. */
export function getClientIp(): string {
  const h = headers();
  const xff = h.get('x-forwarded-for');
  if (xff) {
    const first = xff.split(',')[0]?.trim();
    if (first) return first;
  }
  return h.get('x-real-ip') ?? 'unknown';
}

/**
 * Consume one token from each bucket. Returns false if ANY bucket is exhausted.
 *
 * `failOpen` controls behaviour when the service-role client is unavailable
 * (e.g. SUPABASE_SERVICE_ROLE_KEY unset) or the RPC errors:
 *   - false (default): fail CLOSED — used by OTP send/verify, where letting an
 *     unmetered request through can cost real money (SMS).
 *   - true: fail OPEN — used by password login, so a backend misconfiguration
 *     can't lock every user out of sign-in (Supabase's native auth rate limits
 *     remain as a backstop).
 */
export async function checkRateLimits(
  keys: RateLimitKey[],
  opts?: { failOpen?: boolean },
): Promise<boolean> {
  const admin = createAdminClient();
  if (!admin) return opts?.failOpen ?? false;
  for (const k of keys) {
    const { data, error } = await admin.rpc('consume_rate_limit', {
      p_kind: k.kind,
      p_key: k.key,
      p_max: k.max,
      p_window_sec: k.windowSec,
    });
    if (error) return opts?.failOpen ?? false;
    if (data === false) return false;
  }
  return true;
}

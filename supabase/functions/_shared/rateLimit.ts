// Shared Postgres-backed rate-limit helper for Edge Functions.
//
// History: this previously used Deno KV (`Deno.openKv()`). Deno KV is NOT
// supported on Supabase's hosted Edge Runtime, so `openKv()` threw, the helper
// fail-closed, and EVERY audit-record / delete-account call returned 429. This
// version backs the limiter with the `public.consume_rate_limit` Postgres RPC
// (supabase/migrations/20260523092236_add_rate_limit_counters.sql), which is
// always reachable from an Edge Function via the service-role client.
//
// Each caller passes its own `kind` namespace, max, and windowSec so per-function
// tuning still lives at the call site — only the storage protocol is shared.
//
// Module-instance note: each Supabase Edge Function is a separate isolate, so the
// module-level client cache below is one-per-function (not shared across
// functions at runtime). Within a single function it amortises client
// construction across invocations in the same isolate.

import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

export interface RateLimitOpts {
  /**
   * Logical namespace for the counter — typically the function name
   * (e.g. `'delete-account'`, `'audit-record'`). MUST be unique per function
   * so counters from different functions don't collide on the same identity.
   */
  kind: string;

  /**
   * Per-identity key within the namespace (e.g. `ip:${hash}`, `user:${id}`).
   * Use a hashed identity if the underlying value is sensitive.
   */
  key: string;

  /** Maximum requests permitted in `windowSec`. */
  max: number;

  /** Window length in seconds. Counter resets after this elapses. */
  windowSec: number;
}

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
}

let client: SupabaseClient | null = null;

function warn(kind: string, event: string, error: string): void {
  // Same JSON shape as createLogger() in _shared/log.ts so ops dashboards can
  // pivot on `event`. We don't import createLogger here to keep this helper's
  // dependency direction shallow (rateLimit.ts shouldn't depend on log.ts).
  console.warn(JSON.stringify({ level: 'warn', function: kind, event, error }));
}

function getClient(kind: string): SupabaseClient | null {
  if (client) return client;
  const url = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!url || !serviceKey) {
    warn(kind, 'rate_limit_misconfigured', 'SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing');
    return null;
  }
  client = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}

/**
 * Check and increment the rate-limit counter for `opts.key` within `opts.kind`.
 *
 * Fail-closed: when the service-role client can't be built or the RPC errors,
 * returns `{ ok: false, remaining: 0 }` so callers return 429/503 rather than
 * silently disabling abuse protection (defense in depth). Unlike the old Deno KV
 * backing, Postgres is the function's core dependency, so this only trips on a
 * genuine DB outage — not on a runtime that never supported the store.
 */
export async function checkRateLimit(opts: RateLimitOpts): Promise<RateLimitResult> {
  const store = getClient(opts.kind);
  if (!store) return { ok: false, remaining: 0 };
  try {
    const { data, error } = await store.rpc('consume_rate_limit', {
      p_kind: opts.kind,
      p_key: opts.key,
      p_max: opts.max,
      p_window_sec: opts.windowSec,
    });
    if (error) {
      warn(opts.kind, 'rate_limit_rpc_failed', String(error.message).slice(0, 200));
      return { ok: false, remaining: 0 };
    }
    // The RPC returns a boolean (allowed). `remaining` is best-effort — no
    // caller reads it — so we report a coarse value rather than an extra query.
    const ok = data === true;
    return { ok, remaining: ok ? Math.max(0, opts.max - 1) : 0 };
  } catch (e) {
    warn(
      opts.kind,
      'rate_limit_rpc_failed',
      e instanceof Error ? String(e.message).slice(0, 200) : 'unknown',
    );
    return { ok: false, remaining: 0 };
  }
}

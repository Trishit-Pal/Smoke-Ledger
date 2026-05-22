// Shared Deno KV rate-limit helper for Edge Functions.
//
// Before this module existed, `delete-account` and `audit-record` each carried
// an inline copy of identical KV rate-limit logic with subtly different return
// shapes (one returned `{ ok, remaining }`, the other a bare `boolean`). F3
// audit consolidates both into this helper. Each caller passes its own
// `kind` namespace, max, and windowSec so the per-function tuning still lives
// at the call-site — only the storage protocol is shared.
//
// Module-instance note: each Supabase Edge Function is a separate isolate, so
// the module-level `kv` cache below is one-per-function (not shared across
// functions at runtime). Within a single function the cache amortises
// `Deno.openKv()` across invocations within the same isolate.

export interface RateLimitOpts {
  /**
   * Logical namespace for the KV key — typically the function name
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

type Kv = Awaited<ReturnType<typeof Deno.openKv>>;

let kv: Kv | null = null;

async function getKv(kind: string): Promise<Kv | null> {
  if (kv) return kv;
  try {
    kv = await Deno.openKv();
    return kv;
  } catch (e) {
    console.warn(`${kind}: rate-limit failing closed — KV unavailable`, e);
    return null;
  }
}

/**
 * Check and increment the rate-limit counter for `opts.key` within `opts.kind`.
 *
 * Fail-closed: when Deno KV is unreachable returns `{ ok: false, remaining: 0 }`
 * so callers return 429/503 rather than silently disabling abuse protection
 * (defense in depth — an engineered KV outage must not unlock the function).
 */
export async function checkRateLimit(opts: RateLimitOpts): Promise<RateLimitResult> {
  const store = await getKv(opts.kind);
  if (!store) return { ok: false, remaining: 0 };
  const k = [opts.kind, opts.key];
  const entry = await store.get<{ count: number; resetAt: number }>(k);
  const now = Date.now();
  if (!entry.value || entry.value.resetAt <= now) {
    await store.set(
      k,
      { count: 1, resetAt: now + opts.windowSec * 1000 },
      { expireIn: opts.windowSec * 1000 },
    );
    return { ok: true, remaining: opts.max - 1 };
  }
  if (entry.value.count >= opts.max) {
    return { ok: false, remaining: 0 };
  }
  await store.set(
    k,
    { count: entry.value.count + 1, resetAt: entry.value.resetAt },
    { expireIn: Math.max(1, entry.value.resetAt - now) },
  );
  return { ok: true, remaining: opts.max - entry.value.count - 1 };
}

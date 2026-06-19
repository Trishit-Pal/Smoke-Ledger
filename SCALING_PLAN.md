  # Smoke Ledger — Scaling Plan

> **Status:** Audit complete; verified against the live `Smoke-Ledger` production DB
> (`tvcwrsglceahkjnfuzkn`) on 2026-05-31, not just the repo migrations.
> **Scope:** Supabase Postgres backend, Next.js 14 (`web/`), shared data layer (`src/`).
> **Author:** Architecture audit (Principal-Staff level).

---

## Implementation status — 2026-05-31

All four follow-up groups are implemented and verified (web `tsc --noEmit` + `next build` green;
204 mobile tests pass). What landed:

- **DB security (zero-risk):** migration `20260531075255_lockdown_secdef_execute` — `anon` EXECUTE
  revoked on all 15 SECURITY DEFINER RPCs (advisor lint 0028 cleared 17 → 0). ✅ live
- **DB indexes (1d):** migration `20260531080049_scale_forward_indexes` — `idx_logs_user_ts_brand`,
  `idx_logs_user_ts_trigger`. The `((local_date)::date)` expression index was **dropped** — the
  `text::date` cast is STABLE (DateStyle-dependent), not IMMUTABLE, so Postgres rejects it in an
  index expression; the existing `idx_logs_user_local_date` already covers date-window scans. ✅ live
- **Login rate limiting (2a):** new `web/lib/auth/rateLimit.ts` (extracted from OTP; `phoneOtp.ts`
  imports it now); `signInWithPasswordAction` gated — 10/IP/10 min, 5/email/15 min, **fail-open**. ✅
- **Caching (2b):** `getServerBrandsWithVariants` now uses a per-user `unstable_cache` (service-role
  read, user-scoped key + tag, 600 s TTL) with `revalidateBrands()` tag-busting wired into the
  Settings brand-create path; variants query gained `.order('name')`; legal pages are now
  `force-static` (build confirms `○ Static`). ✅
- **Mobile catalog sync (3a/3b):** `maybeSyncDefaultBrandCatalog` is timeout-guarded (6 s); web
  persists its marker in `localStorage`; native boot hydrates the marker from AsyncStorage via the
  new web-shimmed `catalogStorageNative` module — so the catalog RPC no longer re-runs on every
  cold boot. ✅

**Still manual (1 click, not doable via SQL/MCP):** enable Auth leaked-password protection in the
Supabase Dashboard.

**Deliberately deferred (documented, not applied):** DB-backed rate limiting for signup/reset — they
run client-side and would need Server-Action wrappers; left on Supabase's native limits + Turnstile.

---

## 0. Executive summary

Smoke Ledger is **pre-launch with near-zero data** (live: **4 users, 11 logs, 225 brands,
442 variants, 120 catalog rows**). The architecture is already disciplined for scale, so this
plan deliberately **does not** chase imaginary CPU/query bottlenecks. The honest priority order is:

1. **Security hardening** — real, live-flagged, and the ideal thing to fix before users arrive.
2. **Egress reduction (caching)** — the Supabase **free-tier egress** ceiling (5 GB/mo) is the
   first cliff this app will hit, long before DB size (500 MB) or CPU. Every avoidable repeated
   read is the thing that actually costs money here.
3. **Forward-looking indexes & rate-limits** — cheap insurance that pays off after growth.

**Already solved — do not redo:**

- **RLS is fully initplan-optimized** to `(select auth.uid())` across all 17 policies
  (migration `20260602000000`). This is the #1 Supabase scaling footgun and it is closed.
- **`v_daily_summary_user` RLS-bypass is fixed** (`security_invoker = true`).
- **Keyset pagination everywhere** — `list_logs_page` and `export_account_data` page on
  `(ts_utc, id) DESC`, backed by `idx_logs_user_ts (user_id, ts_utc DESC)` (verified live).
  No `OFFSET` scans.
- **No N+1.** `listBrandsWithVariants` issues two parallel queries + an in-memory join; reads
  are bounded (200-row caps, date windows).
- **Inserts are funneled** through `create_log_with_rate_limit` (50/rolling-hour cap), so the
  RLS `INSERT` path can't be abused directly.

Two original-brief assumptions did **not** match reality and are corrected here:

- **No direct Postgres connections exist** — the app is 100% PostgREST (HTTP). PostgREST pools
  server-side, so a "connection pooler string swap" is a no-op today (documented as optional/future).
- **No `/api/auth/login` route exists** — login is a Next.js **Server Action**. OTP already has
  DB-backed rate limiting; we extend the same mechanism to password auth.

---

## 1. Confirmed findings (live-verified)

| # | Finding | Today | At scale | Status |
|---|---|---|---|---|
| 1 | **17 SECURITY DEFINER RPCs are `anon`-executable** (advisor lints 0028/0029) — incl. `erase_account_data`, `export_account_data`, `create_log_with_rate_limit`, `list_logs_page`. `record_audit_event` was revoked from `authenticated` but is **still anon-executable**. | High | High | **Applied (this change)** |
| 2 | **Leaked-password protection disabled** (advisor: `auth_leaked_password_protection`). | Med | High | Manual toggle |
| 3 | **Mobile re-syncs the whole brand catalog on every cold boot** — `getSessionStorage()` is `null` on React Native, so `shouldSyncCatalog` is always `true`. Latency + egress on every launch. | Med | Med | Planned |
| 4 | **Static-ish reads refetched per navigation** — `getServerBrandsWithVariants` (~110 rows/user) runs on dashboard/settings/new-log with no cross-request cache. | Low | Med | Planned |
| 5 | **No app-level rate limit on password login/signup/reset** (OTP has it). | Low | Med | Planned |
| 6 | **`cigarette_logs` lacks filter-covering composite indexes** for `list_logs_page` brand/trigger/date filters. | None | Med | Planned (for-scale) |
| 7 | `getServerBrandsWithVariants` omits `.order('name')` on variants (inconsistent w/ mobile). | Trivial | Trivial | Planned (cosmetic) |
| 8 | `rate_limit_counters` RLS-enabled-no-policy (advisor INFO). | None | None | **Intentional** (service-role only) — leave |

---

## 2. Part 1 — Supabase & Postgres hardening

### 1a. Connection strategy (PostgREST today; pooler optional/future)

All DB access is PostgREST over HTTP via `@supabase/ssr` (`createServerClient` per request,
`createBrowserClient` singleton) and a `createClient` service-role singleton in
`web/lib/supabase/admin.ts`. Supabase fronts Postgres with its own pooler, so Vercel serverless
fan-out does **not** exhaust Postgres connections. **No action required now.**

Use a pooler connection string **only if** a future direct-Postgres path is introduced (a cron
worker, an analytics job, or a `pg`/Drizzle/Prisma migration runner):

```bash
# OPTIONAL — only for a future direct-Postgres (non-PostgREST) path.
# Serverless / Edge (Transaction pooler, port 6543 — disable prepared statements):
DATABASE_URL="postgres://postgres.<ref>:<pwd>@aws-0-<region>.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1"
# Persistent workers / one-off migrations (Session pooler, port 5432):
DIRECT_URL="postgres://postgres.<ref>:<pwd>@aws-0-<region>.pooler.supabase.com:5432/postgres"
```

Rule of thumb: **Transaction mode (6543)** for stateless serverless invocations,
**Session mode (5432)** for anything holding a connection or running migrations.

### 1b. Security lockdown — revoke `anon`/`PUBLIC` EXECUTE (APPLIED)

Migration `supabase/migrations/20260607000000_lockdown_secdef_execute.sql`. Closes advisor lints
0028 (`anon`) and 0029 (`authenticated`) for the internal set, keeping `authenticated` only on
the RPCs clients legitimately call.

```sql
-- User-facing RPCs: keep `authenticated`, drop `anon` + PUBLIC.
do $$
declare fn text;
begin
  for fn in
    select format('%I(%s)', p.proname, pg_get_function_identity_arguments(p.oid))
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prosecdef and p.proname in (
      'create_log_with_rate_limit','list_logs_page','get_daily_summary','get_random_facts',
      'get_health_milestones','mark_fact_seen','export_account_data','erase_account_data',
      'sync_default_brand_catalog','refresh_seed_prices_from_catalog','seed_default_brands_if_empty')
  loop
    execute format('revoke execute on function public.%s from anon, public;', fn);
    execute format('grant  execute on function public.%s to authenticated;', fn);
  end loop;
end $$;

-- Internal / trigger / service-only: drop anon + authenticated + PUBLIC (service_role grant stays).
do $$
declare fn text;
begin
  for fn in
    select format('%I(%s)', p.proname, pg_get_function_identity_arguments(p.oid))
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prosecdef and p.proname in (
      'handle_new_user','rls_auto_enable','consume_rate_limit','record_audit_event')
  loop
    execute format('revoke execute on function public.%s from anon, authenticated, public;', fn);
  end loop;
end $$;
```

**Why signup still works:** `handle_new_user` runs via the `on_auth_user_created` trigger as the
table owner; trigger firing does not check the caller's `EXECUTE` privilege. Verified post-apply
(see §6).

### 1c. Enable leaked-password protection (manual — 1 click)

Not reachable via SQL/MCP (it's GoTrue auth config). In the Supabase Dashboard:
**Authentication → Policies (Password) → enable "Leaked password protection" (HaveIBeenPwned).**
Clears the `auth_leaked_password_protection` advisor.

### 1d. Forward-looking indexes (create-now, marked for-scale)

Migration `supabase/migrations/20260607010000_scale_forward_indexes.sql`. These won't be chosen
by the planner until a user accumulates thousands of logs (expect temporary `unused_index`
advisor INFOs until then) — that's acceptable insurance.

```sql
-- Backs list_logs_page's brand/trigger filters on top of the existing ts_utc keyset index.
create index if not exists idx_logs_user_ts_brand
  on public.cigarette_logs (user_id, ts_utc desc, brand_id);
create index if not exists idx_logs_user_ts_trigger
  on public.cigarette_logs (user_id, ts_utc desc, trigger_tag);
-- NOTE: an expression index on ((local_date)::date) was attempted but Postgres rejects it
-- ("functions in index expression must be marked IMMUTABLE") — the text::date cast is STABLE.
-- The existing idx_logs_user_local_date (user_id, local_date DESC) already covers date scans.
```

### 1e. RLS optimization — COMPLETE (no action)

All 17 policies already use `(select auth.uid())` (initplan form), verified live. Documented for
completeness; nothing to change. This is the highest-impact Postgres scaling fix and it is done.

---

## 3. Part 2 — Vercel & Edge layer

### 2a. API protection — extend the existing DB token-bucket (no new deps)

The OTP flow already rate-limits via the `consume_rate_limit` RPC + service-role admin client
(`web/app/(auth)/login/_actions/phoneOtp.ts`, lines 51–82). Extract that helper into a shared
module and reuse it for password login (then re-import it back into `phoneOtp.ts` — DRY):

```ts
// web/lib/auth/rateLimit.ts  (new — lifted from phoneOtp.ts)
import 'server-only';
import { headers } from 'next/headers';
import { createAdminClient } from '@web/lib/supabase/admin';

export interface RateLimitKey { kind: string; key: string; max: number; windowSec: number; }

export function getClientIp(): string {
  const h = headers();
  const xff = h.get('x-forwarded-for');
  if (xff) { const first = xff.split(',')[0]?.trim(); if (first) return first; }
  return h.get('x-real-ip') ?? 'unknown';
}

// fail-OPEN if the service-role client is unconfigured, so a missing key can't lock
// everyone out of password login (OTP keeps fail-closed — SMS costs real money).
export async function checkRateLimits(
  keys: RateLimitKey[],
  opts?: { failOpen?: boolean },
): Promise<boolean> {
  const admin = createAdminClient();
  if (!admin) return opts?.failOpen ?? false;
  for (const k of keys) {
    const { data, error } = await admin.rpc('consume_rate_limit', {
      p_kind: k.kind, p_key: k.key, p_max: k.max, p_window_sec: k.windowSec,
    });
    if (error) return opts?.failOpen ?? false;
    if (data === false) return false;
  }
  return true;
}
```

Gate `signInWithPasswordAction` (`web/app/(auth)/login/actions.ts`, after the Zod parse at
line 70, before `supabase.auth.signInWithPassword`). Add `'rate_limited'` to `LoginActionState`
if it isn't already present:

```ts
const okLimit = await checkRateLimits([
  { kind: 'pw_login_ip',    key: getClientIp(),               max: 10, windowSec: 600 },
  { kind: 'pw_login_email', key: email.trim().toLowerCase(),  max: 5,  windowSec: 900 },
], { failOpen: true });
if (!okLimit) {
  return { code: 'rate_limited', message: 'Too many sign-in attempts. Please wait a few minutes and try again.' };
}
```

**Signup & reset** currently run **client-side** via `getSupabase()` (`signup/page.tsx`,
`reset/page.tsx`). To apply DB-backed limits they need thin Server-Action wrappers (same pattern
as login). Either do that, or rely on Supabase's native limits + the existing Turnstile captcha
for those two surfaces. Recommended limits if wrapped: signup — 5/IP/hour; reset — 3/email/hour.

### 2b. Caching — cut egress on static-ish reads

**Before** (`web/lib/server/data.ts` — only request-scoped dedup):

```ts
export const getServerBrandsWithVariants = cache(async () => {
  const supabase = createClient();
  const userId = await requireServerUserId();
  const { data: brands }   = await supabase.from('brands').select('*').eq('user_id', userId)
    .order('is_favorite', { ascending: false }).order('name', { ascending: true });
  const { data: variants } = await supabase.from('brand_variants').select('*').eq('user_id', userId);
  // …in-memory join…
});
```

**After** — persist across requests in Next's Data Cache, keyed by user, tag-invalidated:

```ts
import { unstable_cache, revalidateTag } from 'next/cache';

export const getServerBrandsWithVariants = cache(async () => {
  const userId = await requireServerUserId();
  return unstable_cache(
    async () => {
      const supabase = createClient();
      const [{ data: brands }, { data: variants }] = await Promise.all([
        supabase.from('brands').select('*').eq('user_id', userId)
          .order('is_favorite', { ascending: false }).order('name', { ascending: true }),
        supabase.from('brand_variants').select('*').eq('user_id', userId)
          .order('name', { ascending: true }),               // ← fixes finding #7
      ]);
      // …in-memory join (unchanged)…
    },
    ['brands-with-variants', userId],
    { tags: [`brands:${userId}`], revalidate: 3600 },
  )();
});
```

Invalidate on mutation — add to `web/app/(app)/_actions/revalidate.ts` and to brand
create/favorite/delete:

```ts
revalidateTag(`brands:${userId}`);
```

Apply the same `unstable_cache` treatment (long TTL, no per-user tag) to the globally-static
`get_health_milestones` and facts catalog reads.

**Static legal pages** (`/privacy`, `/terms`, `/support`): mark `export const dynamic =
'force-static'` and add an immutable `Cache-Control` header in `next.config.mjs` `headers()`:

```js
{ source: '/(privacy|terms|support)', headers: [
  { key: 'Cache-Control', value: 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800' },
]},
```

---

## 4. Part 3 — Repository / shared-layer refactors

### 3a. Fix mobile catalog re-sync + add a boot timeout

Root cause (`src/lib/catalogSync.ts`): `getSessionStorage()` returns `null` when `window` is
undefined — always true on React Native — so the version marker is never read or written and the
`sync_default_brand_catalog` RPC fires on **every** boot.

Fix: inject a real `CatalogSyncStorage` adapter (AsyncStorage-backed) on mobile so the once-per-
version gate works, and race the RPC with a timeout so a slow network can't stall boot:

```ts
// src/lib/catalogSync.ts — maybeSyncDefaultBrandCatalog()
const SYNC_TIMEOUT_MS = 6000;
await Promise.race([
  syncDefaultBrandCatalog(),
  new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('catalog_sync_timeout')), SYNC_TIMEOUT_MS)),
]);
markCatalogSynced(storage); // only on success; transient failure retries next boot
```

```ts
// src/store/session.ts — boot(): pass an AsyncStorage-backed adapter
import AsyncStorage from '@react-native-async-storage/async-storage';

const nativeCatalogStorage: CatalogSyncStorage = {
  // AsyncStorage is async; wrap a tiny in-memory mirror hydrated at boot, or
  // gate sync behind a settings_kv flag read in the same Promise.all.
  getItem: (k) => memoryMirror.get(k) ?? null,
  setItem: (k, v) => { memoryMirror.set(k, v); void AsyncStorage.setItem(k, v); },
};
await maybeSyncDefaultBrandCatalog(nativeCatalogStorage).catch(() => undefined);
```

For **web**, switch the marker from `sessionStorage` → `localStorage` so opening a new tab
doesn't force a re-sync.

### 3b. Cosmetic consistency

Add `.order('name', { ascending: true })` to the variants query in `getServerBrandsWithVariants`
(folded into the §2b rewrite above) to match mobile's `listBrandsWithVariants`.

### 3c. Preventive note — keep it N+1-free (no live issue)

The brief asked for an "inefficient query → batched join" side-by-side, but **no live N+1
exists**. The one latent risk: `inferUnitPriceForVariant` (`src/db/repositories/logs.ts`) issues
1–3 bounded queries per call — perfectly fine for single-log entry, but a future **bulk-log**
feature must batch price inference (one query over all variants), not call it per row. The
canonical good pattern already in the codebase to copy is `listBrandsWithVariants`:

```ts
// GOOD (existing): 2 parallel queries + in-memory join — O(1) round-trips, not O(n).
const [brands, variants] = await Promise.all([
  supabase.from('brands').select('*').eq('user_id', userId),
  supabase.from('brand_variants').select('*').eq('user_id', userId),
]);
// group variants by brand_id in memory; attach.
```

```ts
// BAD (anti-pattern to avoid): fan-out per brand.
for (const brand of brands) {
  const { data } = await supabase.from('brand_variants').select('*').eq('brand_id', brand.id); // N+1
}
```

---

## 5. Rollout sequence & risk

| Step | Change | Risk | Reversible? |
|---|---|---|---|
| 1 | **1b** revoke migration (applied) | Low — clients use `authenticated`; trigger unaffected | Yes (re-grant) |
| 2 | **1c** leaked-password toggle | None | Yes (toggle off) |
| 3 | **1d** forward indexes | None (additive, `IF NOT EXISTS`) | Yes (`drop index`) |
| 4 | **2a** login rate limit (fail-open) | Low — fail-open can't lock users out | Yes |
| 5 | **2b / 3a / 3b** caching + mobile sync | Low — tag invalidation on every mutation; verify staleness | Yes |

Steps 3–5 are **gated** behind a separate go-ahead (only 1b is applied in this pass; 1c is a
manual toggle).

---

## 6. Verification

- **Security migration (1b):** re-run `get_advisors(security)` → the `anon_security_definer_*`
  WARNs are gone; live grant check —
  `select proname, has_function_privilege('anon', oid,'EXECUTE') from pg_proc where prosecdef` —
  must show `anon = false` for all 15, `authenticated = true` for the 11 user-facing ones.
  Functional smoke: a fresh **signup succeeds** (trigger path intact) and an authenticated client
  can still call `list_logs_page` / `create_log_with_rate_limit`.
- **Leaked-password (1c):** re-run `get_advisors(security)` → WARN cleared.
- **Web changes (2a/2b/3b):** `cd web && npm run typecheck && npm run build`; run the Playwright
  smoke (`web/e2e/auth-smoke.spec.ts`, `web/e2e/security.spec.ts`).
- **Mobile sync (3a):** launch twice — `sync_default_brand_catalog` fires once, then is skipped
  on the second cold boot.
- **Indexes (1d):** `EXPLAIN ANALYZE` a filtered `list_logs_page` call once a test user has many
  logs; until then the `unused_index` INFO is expected and benign.

---

## Appendix A — Live evidence (2026-05-31, `tvcwrsglceahkjnfuzkn`)

- **Volume:** users 4 · cigarette_logs 11 · brands 225 · brand_variants 442 · goals 2 · catalog 120.
- **Performance advisors:** only 2 INFOs — `idx_logs_brand_id` and `idx_logs_user_created`
  reported **unused** (confirms low data volume).
- **Security advisors:** 17× `anon_security_definer_function_executable` (WARN) +
  matching `authenticated_*` (WARN) + `auth_leaked_password_protection` (WARN) +
  `rate_limit_counters` `rls_enabled_no_policy` (INFO, intentional).
- **`cigarette_logs` indexes (live):** `cigarette_logs_pkey`, `idx_logs_brand_id`,
  `idx_logs_user_brand (user_id, brand_id)`, `idx_logs_user_created (user_id, created_at DESC)`,
  `idx_logs_user_local_date (user_id, local_date DESC)`, `idx_logs_user_ts (user_id, ts_utc DESC)`,
  `uq_logs_user_client_op (user_id, client_op_id) WHERE client_op_id IS NOT NULL`.

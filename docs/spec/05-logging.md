---
section: logging
sources:
  - src/domain/calc.ts
  - src/db/repositories/logs.ts
  - src/db/repositories/brands.ts
  - app/(tabs)/log.tsx
  - app/log/new.tsx
  - src/types/index.ts
  - src/lib/validation.ts
  - supabase/migrations/20250426120000_initial_schema.sql
  - supabase/migrations/20260520000000_security_correctness.sql
  - supabase/migrations/20260523092053_add_list_logs_page.sql
  - supabase/migrations/20260523092236_add_rate_limit_counters.sql
  - supabase/migrations/20260524050357_add_daily_summary.sql
  - supabase/migrations/20260602000000_perf_rls_initplan_indexes.sql
  - src/tests/calculations.test.ts
last_verified_commit: fcabb85
status: current
---

# Logging

## Purpose

A cigarette log is the atom of this whole app. Every number you see elsewhere —
savings, baseline, streak, insights — is an aggregation of individual log
entries. This section covers how an entry is created, what it can hold, the
guard that prevents runaway inserts, and the brand and variant catalogue that
backs the mandatory brand field.

## What the user experiences

From the Log tab (`app/(tabs)/log.tsx`), you can add an entry in three ways:

- **Quick-add (+1, +2, +3)** — one tap, no form. Inherits brand, variant, and
  unit price from the most recent log in the session. If there is no prior log,
  brand and price are null and the entry is saved that way.
- **Repeat last** — duplicates the most recent entry (same brand, variant,
  quantity, moods, context) except that the price source is demoted from
  `'exact'` to `'inferred'`, and craving and notes are cleared, because those
  are in-the-moment and you did not re-observe them.
- **Log with full details** — opens `app/log/new.tsx`, a form that lets you set
  brand, variant, quantity, price, purchase mode, trigger, mood before, mood
  after, craving (0–10), context, and a free-text note up to 500 characters.

The log tab also shows today's entries (capped at 12 for display) with their
brand name, variant, quantity, purchase mode, price, and timestamp. Everything
is masked if discreet mode is on.

If you hit the rate limit, the save fails with a visible error message. The app
does not silently drop the entry.

## How it works

### The data shape

The canonical type is `CigaretteLog` in `src/types/index.ts:51`. The required
fields per the database are `id`, `user_id`, `ts_utc`, `local_date`,
`local_hour`, `quantity`, `purchase_mode`, `price_source`, `created_at`, and
`updated_at`. Everything else is nullable.

**Brand is the only required application-level field.** The database column
`brand_id` is nullable (because the brand row can later be deleted and the FK
is `ON DELETE SET NULL`), but `createLog` in `src/db/repositories/logs.ts:208`
throws a `validation_error` AppError before even reaching the RPC if
`draft.brandId` is absent. The log form's Save button is disabled until a brand
is selected. These are two independent guards; either one alone would be
sufficient, but both are needed for defense-in-depth.

The `Row` type at `src/db/repositories/logs.ts:18` is the internal
representation of a raw Postgres row (snake_case). The public `CigaretteLog`
type (camelCase) is what everything outside the repository sees. Two mapper
functions handle the translation: `rowToLog` at line 100 (for direct table
queries) and `rpcRowToLog` at line 74 (for the `list_logs_page` RPC, which
serialises through `jsonb_build_object` with explicit camelCase keys).

### Creating a log: `createLog` and the rate-limit RPC

All creates go through `createLog` (`src/db/repositories/logs.ts:203`). It
never does a raw `INSERT`. Instead it calls the `create_log_with_rate_limit`
Postgres function (`supabase/migrations/20260520000000_security_correctness.sql:851`),
which is a `SECURITY DEFINER` RPC that does several things atomically inside a
single Postgres transaction:

1. Verifies `auth.uid()` is not null (rejects unauthenticated calls at the DB
   level, not just the app level).
2. Short-circuits on `client_op_id` collision — if the same idempotency key
   was already used by this user, the existing row is returned and no duplicate
   is inserted. This makes retries safe on flaky mobile networks.
3. Counts logs for this user in the trailing hour (`ts_utc > now() - interval
   '1 hour'`). If the count is 50 or more, it raises ERRCODE `54000` with
   message `rate_limited`. `mapDbError` in the repository layer converts that to
   a `rate_limit` AppError, which the UI surfaces as an inline error.
4. Inserts the row.
5. If `brand_id`, `unit_price_inr`, and `variant_snap` are all present,
   atomically updates the running mean on the matching `brand_variants` row
   (incrementing `price_sum_inr` and `price_count`, recomputing `avg_price_inr`,
   and updating `last_price_inr` / `last_priced_at`).

The 50-per-hour limit is the database-enforced ceiling. The comment in the
migration (`supabase/migrations/20260520000000_security_correctness.sql:850`)
notes it matches an earlier client-side `rateLimiter.ts`, but the server-side
check is what actually enforces it — the client-side version was a Deno KV
implementation that was abandoned when Supabase's hosted Edge Runtime stopped
supporting `Deno.openKv()`.

Before calling the RPC, `createLog` also runs the draft through `CigaretteLogSchema`
(Zod, `src/lib/validation.ts:89`). The schema enforces: quantity 1–100; total
price 0–10,000 INR; unit price 0–2,000 INR; craving 0–10; notes stripped of
null bytes and trimmed to 500 characters; brand/variant names stripped of null
bytes and bounded to 100 characters; and enum values for purchase mode, price
source, trigger, mood, and context that must match exactly the values in
`src/types/index.ts`.

An idempotency key (`clientOpId`) is generated by `makeId('op')` if the caller
does not supply one. The key is stored in `cigarette_logs.client_op_id` and
covered by a unique index on `(user_id, client_op_id)` where the column is not
null (`supabase/migrations/20260520000000_security_correctness.sql:25`). The
column also has a CHECK constraint requiring its length to be between 8 and 64
characters.

### Local date and local hour

The log stores three time values: `tsUtc` (the true wall-clock moment as ISO
8601), `localDate` (a `YYYY-MM-DD` string in IST), and `localHour` (0–23 in
IST). The date and hour are derived at write time via `toLocalDate` and
`toLocalHour` in `src/lib/date.ts`, or can be supplied by the caller.

Storing the local date separately is important because "how many today?" only
makes sense in the user's wall-clock day. The domain layer (`dailyStats`,
`sticksOn`, `spendOn` in `src/domain/calc.ts`) does all date arithmetic as
plain string comparisons on `YYYY-MM-DD` to avoid timezone drift.

### Reading logs: `listLogsPage` and the keyset cursor

`listLogsPage` (`src/db/repositories/logs.ts:167`) calls the `list_logs_page`
RPC (`supabase/migrations/20260523092053_add_list_logs_page.sql:9`). The RPC
takes optional date-range and brand/trigger filters plus a cursor of
`(ts_utc, id)`, and returns at most `effective_limit` rows (clamped to 5,000)
ordered by `ts_utc DESC, id DESC`. It fetches one extra row to determine
`hasMore`, then returns the page, the next cursor, and the flag in a JSONB
payload.

The older `listLogs` helper (`src/db/repositories/logs.ts:317`) wraps
`listLogsPage` with a default limit of 200 and emits a `logClientError` warning
if the cursor is non-null (meaning there are more rows). It exists for callers
that have not yet migrated to the paginated path. `MAX_LIST_LOGS` is 5,000
(`src/db/repositories/logs.ts:140`).

The `list_logs_page` RPC enforces its own auth check: it reads `auth.uid()` and
rejects any call where `uid IS NULL` or where `uid <> p_user_id`
(`supabase/migrations/20260523092053_add_list_logs_page.sql:36`). This is belt-
and-suspenders alongside the RLS policy on `cigarette_logs`.

For the "Year" view on Trends, the app uses `get_daily_summary` instead of
fetching raw logs. That RPC reads the `v_daily_summary_user` view (a plain
aggregation of `cigarette_logs` with `security_invoker = true`, so RLS on
`cigarette_logs` still applies), and caps the date range to 366 days
(`supabase/migrations/20260524050357_add_daily_summary.sql`).

### Price derivation and snapshots

Price on a log is always optional. Four purchase modes are supported — `single`,
`pack`, `carton`, and `custom` — and `deriveUnitPrice` in `src/domain/calc.ts:30`
converts whichever price the user typed into a `unitPriceInr` and a
`totalPriceInr` using documented rules:

- `single`: total divided by quantity, or the inferred unit if no total.
- `pack`: total (= pack price) divided by pack size gives unit; unit times
  quantity gives total for this log.
- `carton`: assumes 10 packs per carton; `price_source` is set to `'estimated'`
  because the per-stick price is an approximation.
- `custom`: total is treated as the amount paid for exactly this quantity.

When the user leaves price blank, `inferUnitPriceForVariant`
(`src/db/repositories/logs.ts:363`) looks up recent logs for the same variant
(up to 20) and averages their unit prices. If that comes up empty, it falls back
to the `brand_variants.avg_price_inr` divided by `default_pack_size`. If that
is also absent, `price_source` is set to `'unknown'` and both price fields are
null. The `'exact'` → `'inferred'` demotion in "Repeat last" captures the fact
that you did not observe the price again.

Logs store `brandNameSnap` and `variantSnap` — plain text copies of the brand
and variant names at the time of logging. This is important: if you later rename
or delete a brand, historical entries keep reading correctly. The `brand_id` FK
is `ON DELETE SET NULL`, so a deleted brand does not destroy old logs; it just
leaves `brand_id` null while `brandNameSnap` still holds the original name.

### Brands and variants

Brands live in `public.brands` and variants in `public.brand_variants`
(`supabase/migrations/20250426120000_initial_schema.sql:48`). Both tables are
scoped to a `user_id` with RLS enforcing isolation.

At account creation, `smoke_seed.apply_default_brands` seeds a catalogue of
Indian and international brands from `smoke_seed.brand_catalog`. The initial
seed includes Gold Flake, Classic, Marlboro, Benson & Hedges, Dunhill, Insignia,
and others, with default pack sizes and average prices. Users can add their own
brands (`createBrand` in `src/db/repositories/brands.ts:100`) and toggle
favourites (`toggleFavorite` at line 127). Favourites float to the top of every
brand list.

Variants can be created or updated via `upsertVariant`
(`src/db/repositories/brands.ts:166`). When a price is provided on upsert, the
running mean is updated using `price_sum_inr` / `price_count` columns —
these were added in the security-correctness migration to replace a "midpoint
hack" that was computing a biased average. A brand with variants cannot be
deleted directly; Postgres raises a `23503` foreign-key violation (the FK is
`ON DELETE RESTRICT`), which the repository converts to a `conflict` AppError
so the UI can tell you to delete the variants first.

The `listBrandsWithVariants` function (`src/db/repositories/brands.ts:263`) does
this in two parallel queries (brands + all variants for the user) and joins them
in memory to avoid the previous per-brand N+1 loop.

`BrandSchema` and `BrandVariantSchema` in `src/lib/validation.ts:137` enforce
that names are 1–100 characters (null bytes stripped, trimmed), pack size is
1–100, and `avgPriceInr` is 0–2,000 INR.

### The domain calculation layer

`src/domain/calc.ts` is a pure-function module with no I/O. Everything in it
takes an array of `CigaretteLog` values and returns derived numbers. The key
functions used across the app:

- `dailyStats` (line 113) — buckets logs into per-day totals, filling zero
  entries for days with no logs, over a given date range.
- `rollingAvgSticks` (line 128) and `rollingAvgSpend` (line 144) — trailing
  window averages ending at a given date.
- `sticksOn` (line 166) / `spendOn` (line 171) — sum for a single local date.
- `brandSpendMix` (line 276) — brand-level spend share over a date range; used
  for the spend breakdown view.
- `hourDistribution` (line 302) / `dowDistribution` (line 316) — arrays of
  stick counts by hour-of-day (24 buckets) and day-of-week (Mon–Sun, 7 buckets).
- `avgUnitPrice` (line 267) — stick-weighted average unit price across logs that
  have a known price.
- `lastLog` (line 261) — most recent log by `tsUtc`.

`dayShift` (line 156) does all day arithmetic as UTC math on `YYYY-MM-DD`
strings, by design avoiding any timezone dependency.

## Invariants

**Brand is always present.** Every log in the database either has a non-null
`brand_name_snap` (set at write time) or, for very old rows pre-migration, at
least a `brand_id`. The application-level check (`src/db/repositories/logs.ts:208`)
and the disabled Save button (`app/log/new.tsx:677`) mean the only way to create
a brand-less entry would be to call the RPC directly, which still works because
the RPC does not enforce the brand requirement — but every normal write path
does.

**Logs are isolated per user.** The RLS policy `logs_all` on `cigarette_logs`
uses `user_id = (select auth.uid())` (the `select` form avoids a per-row
function call; added in `supabase/migrations/20260602000000_perf_rls_initplan_indexes.sql:24`).
This applies to direct table access and to the `v_daily_summary_user` view
(which is `security_invoker = true`). The `list_logs_page` and
`create_log_with_rate_limit` RPCs add their own `uid` checks on top.

**At most 50 inserts per rolling hour per user.** This check runs in the
database inside the `SECURITY DEFINER` RPC. Application code cannot bypass it.

**Price fields are always consistent.** `unitPriceInr` and `totalPriceInr` are
always derived together by `deriveUnitPrice`, never set independently. The Zod
schema caps both fields before the RPC is called.

**Snapshots survive catalogue changes.** `brandNameSnap` and `variantSnap` are
written at insert time and are never updated when a brand or variant changes.
The `brand_id` FK is `ON DELETE SET NULL`, so deleting a brand orphans the FK
but leaves the snapshot intact.

**Keyset pagination is stable under concurrent inserts.** The `(ts_utc, id)`
cursor pair is unique and strictly ordered. A new log inserted between page
fetches will not cause a row to appear twice or be skipped.

## Edge cases and gotchas

**Quick-add with no prior log.** The `quickAdd` handler in `app/(tabs)/log.tsx:31`
reads `logs[0]` for the last log's brand and price. On a fresh account, that is
`undefined`. The code guards with `?? null` for each field, so the log is saved
with null brand, null price, and `priceSource: 'unknown'`. However, the brand-
required guard in `createLog` will then throw because `brandId` is null. In
practice this means quick-add silently fails on a fresh account if the session
has no logs yet. The UI shows the error string but does not prevent the attempt.
The correct path for a fresh account is "Log with full details".

**"Repeat last" price demotion.** When you repeat a log that had `priceSource:
'exact'`, the copy is saved with `priceSource: 'inferred'`. This is correct
because you did not observe the price again. It does mean the variant's running
mean in `brand_variants` is not updated for the repeated log (the RPC only
updates the mean when `unit_price_inr IS NOT NULL` — and it is not null here,
so the mean *is* updated). What changes is only the audit label on how the price
was known. This is the intended behaviour.

**`brand_variants.avg_price_inr` versus log history.** `inferUnitPriceForVariant`
prefers up to 20 recent log prices and only falls back to the catalog average if
none exist. The catalog average is itself a running mean of prices observed via
`upsertVariant` or backfilled from logs. If a variant's price has drifted
significantly from the catalog value, the log-history path will produce a more
accurate inference. The fallback to `brand_variants.avg_price_inr / default_pack_size`
is a rough approximation and is labelled `'inferred'` accordingly.

**`local_date` stored as text.** The column type in Postgres is `text`, not
`date`. The migrations cast it to `::date` in RPC WHERE clauses to enable proper
comparison against `date` parameters. Plain string ordering on `YYYY-MM-DD` is
equivalent, but it can surprise a reader who expects the column to be a date
type.

**The daily summary view had an RLS bypass.** `v_daily_summary_user` was
originally created without `security_invoker`, meaning it ran with the view
owner's privileges and bypassed RLS on `cigarette_logs`. Any authenticated user
could read every other user's aggregated daily counts and spend. This was fixed
in `supabase/migrations/20260602000000_perf_rls_initplan_indexes.sql:57` by
setting `security_invoker = true`. The fix is idempotent and does not change the
RPC path, which already filters by `uid`.

**Deleting a brand with variants fails with a confusing error.** Postgres raises
`23503` (foreign key violation). The brands repository converts this to a
`conflict` AppError, but the raw message `brand_has_variants: delete the brand
variants first, or merge the brand into another` is surfaced directly to the UI.
If the UI does not handle the `conflict` code specifically, the user sees
database-flavoured error text. Check the UI layer when changing this.

## Tests

`src/tests/calculations.test.ts` is the main test file for this section. It
tests every pure function in `src/domain/calc.ts` and the price-derivation
functions it depends on:

- `deriveUnitPrice` — all four purchase modes, inferred fallback, and the
  unknown/null case.
- `dailyStats` and `rollingAvgSticks` — bucketing with zero-fill and rolling
  average across a window.
- `dayShift` — forward and backward shifts including month boundaries.
- `brandSpendMix` — share computation across multiple brands.
- `smokeFreeStreak` — trailing zero-smoke day count.
- `trendVsBaseline` — negative delta when recent average is below baseline.
- `forecastMonthlySpend` — linear extrapolation to month-end.
- `potentialSavings` and `actualSavings` from `src/domain/savings.ts` — the
  avoided-sticks and display-clamped savings calculations.

These are pure-function tests: no Supabase, no network. They are the fastest and
most reliable tests in the repo and should be the first place to look when
changing anything in the domain layer.

There are no integration tests for `createLog`, the rate-limit RPC, or
`listLogsPage` against a live database. The RPC behaviour and idempotency logic
are only verified by reading the migration SQL and the repository code.

## Open gaps

**No integration tests for the create path.** The rate limit, idempotency key
behaviour, and the variant mean-update inside `create_log_with_rate_limit` are
not tested against a real Supabase instance. A pgTAP or Supabase local test
suite would catch drift between the migration SQL and the repository's
assumptions about what the RPC returns.

**Quick-add silently fails on a brand-less account.** The "no prior log" case in
`app/(tabs)/log.tsx` produces a null `brandId` that `createLog` rejects. The
error is shown but the UX does not guide the user to the right alternative. A
check before attempting the call would be cleaner.

**The legacy `listLogs` helper is still in use.** It emits a `logClientError`
when it hits the page cap, but there is no guarantee every caller has migrated
to `listLogsPage`. The warning is silent to the user. Callers that hit the 200-
row default cap will silently truncate their history.

**`brand_id` can be null on a log, but the `brandNameSnap` is never validated
against the live catalogue.** A log could theoretically hold a `brandNameSnap`
that no longer matches any brand in the user's catalogue (e.g., after a rename).
The snapshot is intentionally frozen, but there is no audit or reconciliation
path for it.

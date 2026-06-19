---
section: data-model
sources:
  - supabase/migrations/**
  - src/types/index.ts
  - src/db/repositories/logs.ts
  - src/db/repositories/brands.ts
  - src/db/repositories/profile.ts
  - src/db/repositories/goals.ts
  - src/db/repositories/facts.ts
  - src/db/repositories/summary.ts
last_verified_commit: fcabb85
status: current
---

# Data Model

## Purpose

Everything the app knows about a user lives in Postgres on Supabase. This section is the ground truth for every table, every constraint, every trigger, and every RPC that touches the database. It is grounded in the live schema (project `tvcwrsglceahkjnfuzkn`, queried 2026-06-19) and the migration history under `supabase/migrations/`. Where the migrations and the live DB disagree, the live DB wins.

## What the user experiences

From the user's point of view, there are no tables — there are logs, a brand list, goals, settings, and a profile. The database is entirely invisible except when something goes wrong (a rate-limit rejection, a constraint violation surfaced as an error message, or the data-export JSON). The data-model section exists for engineers and future maintainers, not users.

## How it works

### Schema layout

There are two schemas:

- **`public`** — everything the authenticated client can touch, all with RLS on. Fifteen tables, two views, and roughly twenty functions.
- **`smoke_seed`** — server-only catalogs (brand catalog, smoking facts, health milestones) plus the internal helpers that seed and sync them. RLS is off on these tables; they are shielded instead by `REVOKE ALL … FROM PUBLIC` and by living outside the `public` schema. The Supabase MCP flags this as a warning (see Open gaps below).

---

### Tables

#### `public.user_profiles`

One row per authenticated user, created automatically by the `on_auth_user_created` trigger.

| Column | Type | Nullable | Default | Constraints |
|---|---|---|---|---|
| `id` | uuid | NOT NULL | — | PK; FK → `auth.users.id` ON DELETE CASCADE |
| `baseline_per_day` | float8 (double precision) | NULL | — | CHECK: NULL or 0–200 |
| `baseline_window_days` | int4 | NOT NULL | 30 | CHECK: 1–365 |
| `currency` | text | NOT NULL | `'INR'` | — |
| `discreet_mode` | bool | NOT NULL | false | — |
| `app_lock_enabled` | bool | NOT NULL | false | — |
| `hide_totals_on_home` | bool | NOT NULL | false | — |
| `onboarded_at` | timestamptz | NULL | — | — |
| `onboarding_step` | text | NULL | — | CHECK: NULL or one of `privacy`, `usage`, `setup`, `baseline`, `brands`, `goal`, `done` |
| `age_confirmed_at` | timestamptz | NULL | — | — |
| `terms_version` | text | NULL | — | — |
| `privacy_version` | text | NULL | — | — |
| `health_disclaimer_version` | text | NULL | — | — |
| `data_processing_consent_at` | timestamptz | NULL | — | — |
| `marketing_consent_at` | timestamptz | NULL | — | — |
| `deleted_at` | timestamptz | NULL | — | Set to now() by `erase_account_data()` to force re-onboarding |
| `full_name` | text | NULL | — | CHECK: NULL or 1–80 chars |
| `date_of_birth` | date | NULL | — | CHECK: NULL or > 1900-01-01 (upper/18+ bound is in the trigger, not here) |
| `gender` | text | NULL | — | CHECK: NULL or `male`, `female`, `other`, `undisclosed` |
| `mobile_e164` | text | NULL | — | CHECK: NULL or matches `^\+[1-9][0-9]{7,14}$` |
| `mobile_changed_at` | timestamptz | NULL | — | Server-owned; never written by client |
| `place` | text | NULL | — | CHECK: NULL or ≤ 80 chars |

A note on `baseline_per_day`: the initial migration declared this `numeric(5,2)`, but the live database has it as `float8` (double precision). This is mentioned in the migration comment at `supabase/migrations/20250426120000_initial_schema.sql:39` ("C4 audit: changed from double precision pre-launch; existing dev DBs need manual ALTER or reset"). The live production DB retains `float8`. The repository mapper in `src/db/repositories/profile.ts:36` always coerces through `Number()` regardless, so the difference is invisible to the application.

**RLS**: SELECT, INSERT, UPDATE each have a separate policy keyed on `id = (SELECT auth.uid())`. There is no DELETE policy — row deletion is never allowed by clients; account removal is handled server-side through `erase_account_data()`.

**Realtime**: `user_profiles` is intended to be in `supabase_realtime` for settings sync across browser tabs (see `supabase/migrations/20260606000000_realtime_publications.sql`). At the time of live verification the publication showed no public tables — this is an open gap.

---

#### `public.brands`

Per-user brand records. Seed brands (populated from the catalog on signup) carry `is_seed = true`. Custom brands created by the user have `is_seed = false`.

| Column | Type | Nullable | Default | Constraints |
|---|---|---|---|---|
| `id` | text | NOT NULL | — | PK (format: `brd_<uuid-hex>`) |
| `user_id` | uuid | NOT NULL | — | FK → `auth.users.id` ON DELETE CASCADE |
| `name` | text | NOT NULL | — | UNIQUE together with `user_id` |
| `category` | text | NOT NULL | `'regular'` | CHECK: `budget`, `regular`, `premium`, `imported`, `other` |
| `is_seed` | bool | NOT NULL | false | — |
| `is_favorite` | bool | NOT NULL | false | — |
| `created_at` | timestamptz | NOT NULL | — | — |
| `updated_at` | timestamptz | NOT NULL | — | — |

The `(user_id, name)` unique constraint means a user cannot have two brands with the same name. The repository in `src/db/repositories/brands.ts:237` converts a Postgres `23503` FK violation (raised when trying to delete a brand that still has variants) into an `AppError` with code `conflict` rather than the generic `validation_error`, because `brand_variants.brand_id` is `ON DELETE RESTRICT`. This is intentional — the app should prompt the user to delete the variants first.

**RLS**: single `brands_all` policy FOR ALL using `user_id = (SELECT auth.uid())`.

---

#### `public.brand_variants`

Variants under a brand (e.g. "Kings", "Lights"). A brand must have at least one variant before a log can reference it.

| Column | Type | Nullable | Default | Constraints |
|---|---|---|---|---|
| `id` | text | NOT NULL | — | PK (format: `var_<uuid-hex>`) |
| `user_id` | uuid | NOT NULL | — | FK → `auth.users.id` ON DELETE CASCADE |
| `brand_id` | text | NOT NULL | — | FK → `public.brands.id` **ON DELETE RESTRICT** |
| `name` | text | NOT NULL | — | UNIQUE together with `(user_id, brand_id)` |
| `default_pack_size` | int4 | NOT NULL | 10 | CHECK: 1–100 |
| `avg_price_inr` | numeric | NULL | — | CHECK: NULL or 0–2000 |
| `last_price_inr` | numeric | NULL | — | CHECK: NULL or 0–2000 |
| `last_priced_at` | timestamptz | NULL | — | — |
| `price_sum_inr` | numeric | NOT NULL | 0 | Running sum for Welford-style mean |
| `price_count` | int4 | NOT NULL | 0 | Running count for Welford-style mean |

`price_sum_inr` and `price_count` exist so `avg_price_inr` is a true running mean of every observed price, not a midpoint between first and last. When `create_log_with_rate_limit()` inserts a log with a unit price, it atomically increments both columns and recomputes `avg_price_inr` in the same transaction (`supabase/migrations/20260520000000_security_correctness.sql:929`). This avoids the race condition that the previous midpoint approach had.

`ON DELETE RESTRICT` on `brand_id` is deliberate: deleting a brand while it has variants raises a 23503 FK violation. Cascade to `auth.users` (user deletion) still fires.

**RLS**: single `variants_all` policy FOR ALL using `user_id = (SELECT auth.uid())`.

---

#### `public.cigarette_logs`

The central fact table. Every recorded smoking event is one row here.

| Column | Type | Nullable | Default | Constraints |
|---|---|---|---|---|
| `id` | text | NOT NULL | — | PK (format: `log_<uuid-hex>`) |
| `user_id` | uuid | NOT NULL | — | FK → `auth.users.id` ON DELETE CASCADE |
| `ts_utc` | timestamptz | NOT NULL | — | The true moment of smoking, in UTC |
| `local_date` | text | NOT NULL | — | `YYYY-MM-DD` in Asia/Kolkata; stored as text to avoid timezone drift |
| `local_hour` | int4 | NOT NULL | — | CHECK: 0–23 |
| `brand_id` | text | NULL | — | FK → `public.brands.id` ON DELETE SET NULL |
| `brand_name_snap` | text | NULL | — | Snapshot of brand name at log time |
| `variant_snap` | text | NULL | — | Snapshot of variant name at log time |
| `quantity` | int4 | NOT NULL | 1 | CHECK: 1–100 |
| `purchase_mode` | text | NOT NULL | `'single'` | CHECK: `single`, `pack`, `carton`, `custom` |
| `pack_size` | int4 | NULL | — | CHECK: NULL or 1–100 |
| `total_price_inr` | numeric | NULL | — | CHECK: NULL or 0–10000 |
| `unit_price_inr` | numeric | NULL | — | CHECK: NULL or 0–2000 |
| `price_source` | text | NOT NULL | `'unknown'` | CHECK: `exact`, `estimated`, `inferred`, `unknown` |
| `trigger_tag` | text | NULL | — | Free text enum from client (not CHECK-constrained at DB level) |
| `mood_before` | text | NULL | — | Free text enum from client |
| `mood_after` | text | NULL | — | Free text enum from client |
| `craving` | int4 | NULL | — | CHECK: NULL or 0–10 |
| `context_tag` | text | NULL | — | Free text enum from client |
| `notes` | text | NULL | — | — |
| `created_at` | timestamptz | NOT NULL | — | — |
| `updated_at` | timestamptz | NOT NULL | — | — |
| `client_op_id` | text | NULL | — | CHECK: NULL or 8–64 chars; UNIQUE with `user_id` where NOT NULL |

`brand_name_snap` and `variant_snap` are intentionally denormalised: they preserve the display name at the time of logging so edits to the brand catalog don't silently rewrite history. `brand_id` may become NULL if a brand is deleted (`ON DELETE SET NULL`), but the snaps remain.

`client_op_id` is an idempotency key. The partial unique index `uq_logs_user_client_op` on `(user_id, client_op_id) WHERE client_op_id IS NOT NULL` means that if a client retries a failed insert with the same op-ID, the database returns the existing row instead of inserting a duplicate. This makes the log-creation RPC safe under flaky mobile networks (`supabase/migrations/20260520000000_security_correctness.sql:25`).

`trigger_tag`, `mood_before`, `mood_after`, and `context_tag` are not CHECK-constrained at the DB layer. The valid values are enforced in the TypeScript Zod schemas (`src/lib/validation.ts`) and in the domain types (`src/types/index.ts:6`). This was a deliberate trade-off: adding a DB CHECK would require a migration every time a new mood or trigger is introduced.

**RLS**: single `logs_all` policy FOR ALL using `user_id = (SELECT auth.uid())`.

**Realtime**: `cigarette_logs` is intended to be in `supabase_realtime` (see Open gaps).

---

#### `public.goals`

User-defined targets evaluated against the logs.

| Column | Type | Nullable | Default | Constraints |
|---|---|---|---|---|
| `id` | text | NOT NULL | — | PK |
| `user_id` | uuid | NOT NULL | — | FK → `auth.users.id` ON DELETE CASCADE |
| `type` | text | NOT NULL | — | CHECK: `daily_cap`, `spend_cap_daily`, `no_smoke_window`, `reduction_target`, `weekly_target`, `quit_date` |
| `target_value` | float8 | NOT NULL | — | CHECK: > 0 and ≤ 1000 |
| `current_baseline` | float8 | NULL | — | Locked baseline at goal creation (used by `reduction_target`) |
| `start_date` | text | NOT NULL | — | `YYYY-MM-DD` |
| `end_date` | text | NULL | — | `YYYY-MM-DD`; null means open-ended |
| `status` | text | NOT NULL | `'active'` | CHECK: `active`, `paused`, `completed`, `abandoned` |
| `meta_json` | jsonb | NULL | — | Type-specific extras (e.g. window start/end hours for `no_smoke_window`) |
| `created_at` | timestamptz | NOT NULL | — | — |

`target_value` is interpreted differently per `type`. For `daily_cap` it is sticks; for `spend_cap_daily` it is INR; for `no_smoke_window` it is hours; for `reduction_target` it is a target daily average; for `weekly_target` it is sticks per week; for `quit_date` it is a Unix-epoch day number. The evaluation logic in `src/domain/goals.ts:35` handles the dispatch.

**RLS**: single `goals_all` policy FOR ALL using `user_id = (SELECT auth.uid())`.

**Realtime**: `goals` is intended to be in `supabase_realtime` (see Open gaps).

---

#### `public.price_entries`

A log of manual price observations, separate from per-log price captures. Currently unpopulated (0 rows in live DB) and not yet actively written by the UI.

| Column | Type | Nullable | Default | Constraints |
|---|---|---|---|---|
| `id` | text | NOT NULL | — | PK |
| `user_id` | uuid | NOT NULL | — | FK → `auth.users.id` ON DELETE CASCADE |
| `brand_id` | text | NULL | — | No FK constraint (intentional; brand may be deleted) |
| `variant_id` | text | NULL | — | No FK constraint |
| `unit_price_inr` | numeric | NOT NULL | — | — |
| `pack_size` | int4 | NULL | — | — |
| `source` | text | NOT NULL | `'user'` | — |
| `observed_at` | timestamptz | NOT NULL | — | — |

**RLS**: single `price_entries_all` policy FOR ALL using `user_id = (SELECT auth.uid())`.

---

#### `public.settings_kv`

Arbitrary key-value settings beyond the fixed profile columns. The key is a string; the value is any JSON.

| Column | Type | Nullable | Default | Constraints |
|---|---|---|---|---|
| `user_id` | uuid | NOT NULL | — | Part of PK; FK → `auth.users.id` ON DELETE CASCADE |
| `key` | text | NOT NULL | — | Part of PK |
| `value_json` | jsonb | NOT NULL | — | — |

**RLS**: single `settings_kv_all` policy FOR ALL using `user_id = (SELECT auth.uid())`.

---

#### `public.reminders`

Local notification reminders. Currently unpopulated (0 rows in live DB).

| Column | Type | Nullable | Default | Constraints |
|---|---|---|---|---|
| `id` | text | NOT NULL | — | PK |
| `user_id` | uuid | NOT NULL | — | FK → `auth.users.id` ON DELETE CASCADE |
| `kind` | text | NOT NULL | — | — |
| `time_local` | text | NOT NULL | — | Time in local (HH:MM) |
| `enabled` | bool | NOT NULL | true | — |
| `quiet_start` | text | NULL | — | — |
| `quiet_end` | text | NULL | — | — |

**RLS**: single `reminders_all` policy FOR ALL using `user_id = (SELECT auth.uid())`.

---

#### `public.usage_events`

Product analytics events written by the client. Schema is intentionally loose: `name` is a string event name; `props_json` is whatever metadata the caller attaches.

| Column | Type | Nullable | Default | Constraints |
|---|---|---|---|---|
| `id` | bigserial | NOT NULL | auto | PK |
| `user_id` | uuid | NOT NULL | — | FK → `auth.users.id` ON DELETE CASCADE |
| `name` | text | NOT NULL | — | — |
| `props_json` | jsonb | NULL | — | — |
| `ts` | timestamptz | NOT NULL | `now()` | — |

**RLS**: three separate policies — SELECT (`usage_select`) and INSERT (`usage_insert`) scoped to `user_id = (SELECT auth.uid())`; DELETE (`usage_delete`) also scoped the same way. No UPDATE policy.

---

#### `public.user_facts_seen`

Tracks which smoking-facts cards a user has seen and optionally liked. Used by `get_random_facts()` to deprioritise recently seen facts.

| Column | Type | Nullable | Default | Constraints |
|---|---|---|---|---|
| `user_id` | uuid | NOT NULL | — | Part of PK; FK → `auth.users.id` ON DELETE CASCADE |
| `fact_id` | text | NOT NULL | — | Part of PK |
| `seen_at` | timestamptz | NOT NULL | `now()` | — |
| `liked` | bool | NULL | — | — |

**RLS**: single `user_facts_seen_all` policy FOR ALL using `user_id = (SELECT auth.uid())`.

---

#### `public.audit_events`

Compliance-grade record of significant account actions (exports, erasures, consent changes). Written only by `SECURITY DEFINER` RPCs — the `audit_events_insert` policy was explicitly revoked in `supabase/migrations/20260521000000_audit_export_ops.sql:295` so that authenticated clients cannot write directly.

| Column | Type | Nullable | Default | Constraints |
|---|---|---|---|---|
| `id` | bigserial | NOT NULL | auto | PK |
| `user_id` | uuid | NULL | — | FK → `auth.users.id` ON DELETE SET NULL |
| `event_type` | text | NOT NULL | — | CHECK: 1–80 chars |
| `event_category` | text | NOT NULL | `'account'` | — |
| `props_json` | jsonb | NOT NULL | `'{}'` | CHECK: ≤ 4096 bytes |
| `created_at` | timestamptz | NOT NULL | `now()` | — |

`user_id` is nullable. When `erase_account_data()` runs it sets `user_id = NULL` on all prior rows for the erased user (after replacing `props_json` with a pepper-hashed pseudonym), so the audit trail survives account deletion without retaining a link to the user's identity (`supabase/migrations/20260521000000_audit_export_ops.sql:8`).

**RLS**: SELECT only (`audit_events_select`) scoped to `user_id = (SELECT auth.uid())`. Rows with `user_id IS NULL` are invisible to authenticated clients — only service_role can read them.

---

#### `public.error_events`

Client-side error reports and the compliance-delete forensic tombstones written by Edge Functions.

| Column | Type | Nullable | Default | Constraints |
|---|---|---|---|---|
| `id` | bigserial | NOT NULL | auto | PK |
| `user_id` | uuid | NULL | — | FK → `auth.users.id` ON DELETE SET NULL |
| `request_id` | text | NULL | — | — |
| `route` | text | NULL | — | — |
| `category` | text | NOT NULL | — | CHECK: 1–60 chars; CHECK: category = `'compliance.delete'` IMPLIES `user_id IS NULL` |
| `message` | text | NOT NULL | — | CHECK: 1–500 chars |
| `details_json` | jsonb | NULL | — | CHECK: NULL or ≤ 4096 bytes |
| `created_at` | timestamptz | NOT NULL | `now()` | — |

The `compliance.delete` category is special. The CHECK constraint (`error_events_compliance_delete_null_user_check`) forces `user_id IS NULL` for these rows, and there is no DELETE or UPDATE policy for `authenticated` — so compliance tombstones written by the service role are permanently invisible and untouchable by any authenticated client (`supabase/migrations/20260520000000_security_correctness.sql:246`). This is four-layer tamper resistance: no INSERT policy for compliance rows, no DELETE policy, no UPDATE policy, and a CHECK that prevents an `authenticated` session from inserting a user-owned compliance row even if RLS were somehow relaxed.

**RLS**: INSERT allowed for own rows (not `compliance.delete`); SELECT of own rows. No DELETE or UPDATE policy — these default-deny via RLS.

---

#### `public.rate_limit_counters`

A generic sliding-window counter table used by `consume_rate_limit()`. Never directly accessible by clients.

| Column | Type | Nullable | Default | Constraints |
|---|---|---|---|---|
| `kind` | text | NOT NULL | — | Part of PK |
| `identity` | text | NOT NULL | — | Part of PK |
| `window_start` | timestamptz | NOT NULL | `now()` | — |
| `count` | int4 | NOT NULL | 0 | — |

RLS is enabled but there are intentionally zero policies — every access attempt from `authenticated` or `anon` roles is default-denied. Only `service_role` (via the `SECURITY DEFINER` `consume_rate_limit()` RPC) can read or write it.

---

#### `smoke_seed.brand_catalog`

Server-only. The canonical list of known cigarette brands and variants, used to seed new user accounts and to push price updates.

| Column | Type | Notes |
|---|---|---|
| `sort_order` | int4 PK | Determines seed order |
| `brand_name` | text | — |
| `category` | text | — |
| `variant_name` | text | — |
| `default_pack_size` | int4 | Typically 10 or 20 |
| `avg_price_inr` | numeric | Pack MRP; updated by catalog refresh migrations |

Currently 120 rows (16 original + 50 added in `20260519130000` + 15 added in `20260601000000`). Prices were refreshed in `20260601000000_catalog_2026_refresh.sql` to reflect post-February 2026 excise duty levels.

No RLS. Protected by `REVOKE ALL … FROM PUBLIC` at the schema level.

---

#### `smoke_seed.smoking_facts`

20 health/finance/recovery facts surfaced in the app. Served exclusively through the `get_random_facts()` RPC; clients never query this table directly.

| Column | Type | Notes |
|---|---|---|
| `id` | text PK | — |
| `category` | text | CHECK: `health`, `india`, `finance`, `recovery`, `environment`, `youth` |
| `headline` | text | — |
| `body` | text | — |
| `source` | text | Attribution |
| `source_url` | text NULL | — |
| `weight` | int4 | Sampling weight (1–3); higher = shown more often to unseen users |

---

#### `smoke_seed.health_milestones`

12 health-recovery milestones keyed by minutes since last cigarette (20 minutes through 15 years). Served entirely through `get_health_milestones()`; the client caches the result.

---

### Views

#### `public.v_daily_summary_user`

A lightweight pre-aggregation of `cigarette_logs` by `(user_id, local_date)`. It exists because pulling 365 raw log rows for the Trends "Year" view would be wasteful on the free tier; this collapses them to one row per day.

```sql
SELECT user_id, local_date,
  COUNT(*)::int AS sticks,
  COALESCE(SUM(total_price_inr), 0)::numeric AS total_spend_inr,
  AVG(unit_price_inr) FILTER (WHERE unit_price_inr IS NOT NULL) AS avg_unit_price_inr
FROM public.cigarette_logs
GROUP BY user_id, local_date
```

This view uses `security_invoker = true`, which means RLS on the underlying `cigarette_logs` table applies at query time. A user who queries the view directly only sees their own rows (`supabase/migrations/20260602000000_perf_rls_initplan_indexes.sql:57`). An earlier version of this view lacked `security_invoker` and was a real bug — any authenticated user could read every user's daily aggregates. That was fixed in the `20260602000000` migration.

---

### Triggers

**`on_auth_user_created`** (AFTER INSERT on `auth.users`)

Calls `public.handle_new_user()`, a `SECURITY DEFINER` function that:
1. Inserts a blank `user_profiles` row for the new user, reading `full_name`, `date_of_birth`, and `gender` from `raw_user_meta_data`.
2. If `date_of_birth` is present but not parseable as a date, raises `22007` — the signup is aborted entirely.
3. If `date_of_birth` is present and the user is under 18, raises `23514` — the signup is aborted. No account row, no email row, nothing is stored.
4. Seeds the new user's brand list from `smoke_seed.brand_catalog` via `smoke_seed.apply_default_brands()`, skipping brands the user already has.

The 18+ gate is hard: it happens inside the trigger that fires as part of the `auth.users` INSERT transaction. If the gate fires, the entire transaction rolls back — the minor's auth record is never committed (`supabase/migrations/20260616181124_profile_identity_fields.sql:130`).

**`trg_user_profiles_identity_rules`** (BEFORE UPDATE on `public.user_profiles`)

Calls `public.enforce_profile_identity_rules()`. This trigger has three jobs:

1. **Immutability of identity fields** — once `full_name`, `date_of_birth`, or `gender` is set (not NULL), any attempt to change it raises `42501`. The profile page never shows an edit control for these once they are filled in, but this trigger is the DB-layer guarantee.
2. **First-set 18+ recheck** — when `date_of_birth` transitions from NULL to a value (the legacy/admin profile-completion path), the trigger re-validates that the date is ≥ 18 years ago.
3. **Mobile number rate limit** — a user can change `mobile_e164` at most once per 30 days. The trigger enforces this and sets `mobile_changed_at = now()` server-side when a change occurs, so the client cannot forge an old timestamp to bypass the window.

---

### RPCs

All RPCs are `SECURITY DEFINER` with `SET search_path = ''`. Every function validates `auth.uid() IS NOT NULL` before doing anything — unauthenticated calls get ERRCODE `42501`.

#### User-callable (granted to `authenticated`)

**`create_log_with_rate_limit(...)`** — the only way to insert a log. It enforces a 50-inserts-per-rolling-hour limit, handles `client_op_id` idempotency (returns the existing row on a collision), inserts the log, and atomically updates `brand_variants.price_sum_inr` / `price_count` / `avg_price_inr` / `last_price_inr` in the same call. Source: `supabase/migrations/20260520000000_security_correctness.sql:851`.

**`list_logs_page(p_user_id, p_from_date, p_to_date, p_brand_id, p_trigger_tag, p_cursor_ts, p_cursor_id, p_limit)`** — keyset-paginated log listing. The cursor is a `(ts_utc, id)` tuple (both DESC), which is stable under concurrent inserts and avoids the offset-drift problem. The function validates that `p_user_id = auth.uid()` so a user cannot request another user's page. Returns `{ logs, nextCursorTs, nextCursorId, hasMore }`. The TypeScript caller is `listLogsPage()` in `src/db/repositories/logs.ts:167`. `local_date` comparisons cast to `::date` to avoid the text-vs-date type mismatch that caused a crash before `20260523171527_fix_list_logs_page_date_cast.sql`.

**`get_daily_summary(p_from date, p_to date)`** — returns one aggregated row per day from `v_daily_summary_user` for the calling user. Hard cap: date range must be ≤ 366 days and `p_to >= p_from`, or the function raises `22023`. Used by the Trends "Year" view to avoid pulling thousands of raw logs.

**`get_random_facts(p_limit int DEFAULT 5)`** — returns a weighted-random selection from `smoke_seed.smoking_facts`, capped between 1 and 25. Facts seen in the last 14 days are given a 0.2× weight penalty. The randomness is `random() * weight * recency_weight DESC`.

**`get_health_milestones()`** — returns the full `smoke_seed.health_milestones` catalog in ascending minute order. The result is small and stable; callers cache it.

**`mark_fact_seen(p_fact_id text, p_liked boolean DEFAULT NULL)`** — upserts a `user_facts_seen` row. Validates that `p_fact_id` exists in `smoke_seed.smoking_facts` before inserting; an unknown ID raises `22023`. On conflict, updates `seen_at = now()` and sets `liked` only if the new value is not NULL (so an unlike call doesn't erase a prior like).

**`export_account_data(p_from, p_to, p_cursor_ts, p_cursor_id, p_limit)`** — produces a `version: 2` JSON export of the user's data. On the first page it includes profile, brands+variants, goals, settings, reminders, price entries, usage events, audit events, and facts seen, plus a paginated slice of logs. Subsequent pages return only the next log slice. Uses `(ts_utc, id) DESC` keyset pagination so the cursor is stable. Caps `p_limit` at 5000 and floors it at 100. Writes an `account_data_exported` audit event on the first page only.

**`erase_account_data()`** — the DPDP right-to-erasure path. Sequence: (1) re-keys all the user's audit and error event rows by replacing the content with a SHA-256 HMAC of `uid || AUDIT_PEPPER` and setting `user_id = NULL` so the rows survive ON DELETE CASCADE; (2) deletes all user-owned data tables; (3) resets `user_profiles` to defaults and sets `deleted_at = now()`; (4) re-seeds default brands so the account is functional if the user logs back in; (5) writes a `account_data_erased` compliance audit event.

**`sync_default_brand_catalog()`** — adds any catalog brands/variants the user does not yet have. Safe to call repeatedly; skips already-present entries by name (case-insensitive). Used after a catalog expansion migration to push new brands to existing users without re-running a full seed.

**`seed_default_brands_if_empty()`** — re-seeds from catalog only if the user has zero brands (e.g. after the user deliberately deleted everything). Used as a recovery path.

**`refresh_seed_prices_from_catalog()`** — updates `avg_price_inr` and `last_price_inr` on seed variants whose `price_count = 0` (i.e., no real user-observed prices yet) to match the current catalog MRPs. Called after price-refresh migrations.

#### Service-role only (not callable by clients)

**`consume_rate_limit(p_kind, p_key, p_max, p_window_sec)`** — generic atomic sliding-window counter. Upserts the `rate_limit_counters` row under a row lock, resets the window when it has elapsed, and returns `true` if the call is within budget. Used by Edge Functions for rate-limiting auth and account operations.

**`record_audit_event(p_event_type, p_event_category, p_props)`** — writes one row to `audit_events` after redacting sensitive keys from `p_props` through `_redact_audit_props()`. Revoked from `authenticated` in `20260521000000_audit_export_ops.sql:295`; only `service_role` (i.e. Edge Functions) may call it.

#### Internal / trigger-only

**`handle_new_user()`** — called by `on_auth_user_created` trigger; described above.

**`enforce_profile_identity_rules()`** — called by `trg_user_profiles_identity_rules` trigger; described above.

**`_redact_audit_props(props jsonb)`** — strips known-sensitive keys (password, token, email, phone, OTP, etc.) from a props object before it is stored in `audit_events`. Marked `IMMUTABLE`; never called by clients directly.

**`smoke_seed.apply_default_brands(target_user)`** — inserts seed brands and variants for a user, skipping any that already exist (case-insensitive name match). Internal; callable only by other `SECURITY DEFINER` functions.

**`smoke_seed.sync_catalog_for_user(target_user)`** — same as `apply_default_brands` but intended for post-expansion syncing of new catalog entries.

**`smoke_seed.refresh_seed_prices_from_catalog()`** — the inner implementation called by the public wrapper above.

---

### Indexes

All indexes on `public` tables, as confirmed in the live DB:

| Index | Table | Definition | Purpose |
|---|---|---|---|
| `idx_logs_user_local_date` | `cigarette_logs` | `(user_id, local_date DESC)` | "Today"/"this week" date-range queries |
| `idx_logs_user_created` | `cigarette_logs` | `(user_id, created_at DESC)` | Recent-first listing |
| `idx_logs_user_brand` | `cigarette_logs` | `(user_id, brand_id)` | Brand filter |
| `idx_logs_brand_id` | `cigarette_logs` | `(brand_id)` | FK probe on brand delete |
| `idx_logs_user_ts` | `cigarette_logs` | `(user_id, ts_utc DESC)` | Keyset pagination primary cursor |
| `idx_logs_user_ts_brand` | `cigarette_logs` | `(user_id, ts_utc DESC, brand_id)` | Brand-filtered pagination (covering) |
| `idx_logs_user_ts_trigger` | `cigarette_logs` | `(user_id, ts_utc DESC, trigger_tag)` | Trigger-filtered pagination (covering) |
| `uq_logs_user_client_op` | `cigarette_logs` | `(user_id, client_op_id) WHERE client_op_id IS NOT NULL` | Idempotency unique index |
| `brands_user_id_name_key` | `brands` | `(user_id, name)` | Unique brand name per user |
| `idx_variants_user_brand` | `brand_variants` | `(user_id, brand_id)` | Variant listing per brand |
| `idx_variants_brand_id` | `brand_variants` | `(brand_id)` | FK probe on brand delete |
| `brand_variants_user_brand_name_unique` | `brand_variants` | `(user_id, brand_id, name)` | Unique variant name per brand per user |
| `idx_goals_user_status` | `goals` | `(user_id, status)` | Active goals listing |
| `idx_price_entries_user` | `price_entries` | `(user_id)` | FK/scan coverage |
| `idx_reminders_user` | `reminders` | `(user_id)` | FK/scan coverage |
| `idx_usage_user_ts` | `usage_events` | `(user_id, ts DESC)` | Recent events |
| `idx_audit_events_user_created` | `audit_events` | `(user_id, created_at DESC)` | Audit trail listing |
| `idx_error_events_user_created` | `error_events` | `(user_id, created_at DESC)` | Error listing |
| `idx_user_facts_seen_user` | `user_facts_seen` | `(user_id, seen_at DESC)` | Recent-seen facts |

All RLS policies use the `(SELECT auth.uid())` scalar-subquery form rather than a bare `auth.uid()` call. This lets the planner evaluate the function once per query (an InitPlan) rather than once per row, which is important for the frequently-queried `cigarette_logs` table. The rewrite was applied in `supabase/migrations/20260602000000_perf_rls_initplan_indexes.sql`.

---

### ID format

Every user-owned table uses text primary keys with a prefix that encodes the entity type: `brd_` for brands, `var_` for variants, `log_` for logs, and so on. The suffix is a UUID with hyphens stripped (`makeId()` in `src/lib/id.ts`). This makes foreign keys in logs and error messages self-documenting at a glance without needing a schema lookup.

---

## Invariants

These rules must never break:

1. Every `public.*` table has RLS enabled. No table is open to `anon` or `authenticated` in ways broader than the policies listed above.
2. `user_id = auth.uid()` (or `id = auth.uid()` for `user_profiles`) is the sole gating condition in every RLS USING and WITH CHECK clause. There are no policy exceptions.
3. All SECURITY DEFINER functions have `SET search_path = ''` and use fully-qualified object names. This prevents search-path injection via untrusted schema objects.
4. `record_audit_event` is callable only by `service_role`. Authenticated clients cannot write to `audit_events` directly.
5. `compliance.delete` rows in `error_events` always have `user_id IS NULL` (enforced by CHECK constraint). Authenticated clients can neither insert nor delete them.
6. A minor (under 18) can never create an account. The `on_auth_user_created` trigger aborts the `auth.users` INSERT when a date of birth is supplied and the age check fails. Absence of a date of birth is the only legitimate path past the gate for the legacy/admin flow — the trigger treats a missing DOB permissively.
7. `brand_variants.brand_id` is ON DELETE RESTRICT. Deleting a brand that still has variants raises a FK violation; the repository surfaces it as `AppError('conflict')` so the UI can guide the user.
8. `cigarette_logs.client_op_id` uniqueness is enforced by a partial index. Create-log RPCs that receive the same op-ID from the same user return the original row, never a duplicate.
9. `brand_variants.avg_price_inr` is a true running mean maintained via `price_sum_inr` / `price_count`, updated atomically in `create_log_with_rate_limit`. No separate computation step is needed.
10. `v_daily_summary_user` has `security_invoker = true`. Querying the view never bypasses RLS on the underlying `cigarette_logs` table.

## Edge cases & gotchas

**`baseline_per_day` is `float8`, not `numeric`**. The initial migration comment says `numeric(5,2)` was the intent, but the live DB has `float8`. The Postgres driver (via supabase-js) returns `float8` as a JS number, not a string, so the `Number()` coercion in `rowToProfile` is still correct and non-breaking but does handle both cases. If the column were ever changed to `numeric` a data migration would be needed first, and the tests in `src/tests/repositories.test.ts:337` would catch the regression.

**`local_date` is stored as text**. This is intentional — it avoids timezone re-interpretation when the row is serialised and deserialised — but it means comparisons require an explicit `::date` cast in SQL. An early version of `list_logs_page` omitted this cast and caused a type error at runtime; the fix is in `supabase/migrations/20260523171527_fix_list_logs_page_date_cast.sql`. Any future query that filters on `local_date` must cast it.

**`trigger_tag`, `mood_before`, `mood_after`, `context_tag` have no DB CHECK**. The valid values are enforced only in TypeScript. A direct Postgres INSERT (e.g. from a migration script or an integration test) can store any string. This is the tradeoff described in the Logging section.

**Audit event rows survive account deletion**. When a user erases their data, their audit rows are not deleted — they are anonymised in place (`user_id = NULL`, `props_json` replaced with a hashed pseudonym). The rows remain as compliance evidence. Only `service_role` can see them after the anonymisation.

**`smoke_seed` tables have no RLS**. The advisor warning is real but not a security bug in practice: the tables have no data that could harm a user if read (they are public health facts and generic brand info), and the `REVOKE ALL … FROM PUBLIC` on the schema prevents direct client access via PostgREST. However, enabling RLS with appropriate policies (or keeping them as internal-only tables with no PostgREST exposure) is the cleaner long-term posture.

**Realtime subscriptions may not be active**. The migration `20260606000000_realtime_publications.sql` adds `cigarette_logs`, `goals`, and `user_profiles` to the `supabase_realtime` publication. At live verification the publication contained no public tables. This means real-time sync across browser tabs is not currently active.

**`onboarding_step` was widened post-launch**. The original constraint in `20260520000000` omitted `'usage'`. The app's first onboarding step writes that value, so every new signup rejected with `23514` until `20260523081444_align_onboarding_step_constraint.sql` widened the CHECK. The TS source of truth is `OnboardingStep` in `src/types/index.ts:95`.

## Tests

- `src/tests/rls.integration.test.ts` — live integration test that signs in as two real users and verifies cross-user isolation on `cigarette_logs`, confirms `record_audit_event` is denied to `authenticated`, proves `compliance.delete` rows are invisible and untouchable, and exercises `get_daily_summary` including the 366-day cap. Skipped unless the four `E2E_*` env vars are present.
- `src/tests/repositories.test.ts` — unit tests that verify: `listLogsPage` cursor semantics and camelCase mapping; `listLogs` page-cap warning via `logClientError`; `getProfile` coerces `baseline_per_day` through `Number()` correctly; `deleteBrand` translates `23503` FK violations to `AppError('conflict')`.
- `src/tests/validation.schemas.test.ts` — covers the Zod schemas that gate every write before it reaches the DB.
- `src/tests/catalogSync.test.ts` — exercises the brand-catalog sync path.

## Open gaps

- **Realtime publication not applied**. The `supabase_realtime` publication has no public tables in the live project as of the last verification, despite the migration running. The web client's cross-tab sync depends on this being in place. Investigate with `SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime'` on the live project.
- **`smoke_seed` tables have RLS disabled**. The Supabase advisor flags `smoke_seed.brand_catalog`, `smoke_seed.smoking_facts`, and `smoke_seed.health_milestones` as critical. In practice, these tables have `REVOKE ALL … FROM PUBLIC` and are not directly reachable by PostgREST, but the belt-and-suspenders posture would be to add `ENABLE ROW LEVEL SECURITY` with no policies (which makes them default-deny) or to move them fully outside PostgREST's reach.
- **`price_entries` has no FK on `brand_id` or `variant_id`**. The columns are nullable and have no referential integrity. This was presumably intentional (brand can be deleted without orphaning price history), but it means there is no cheap way to join price entries back to a live brand record. An index on `user_id` was added in `20260602000000` but nothing enforces consistency.
- **`goals.start_date` and `end_date` are text**. Like `local_date` on logs, these are `YYYY-MM-DD` strings. They have no CHECK constraint ensuring they are valid dates or that `end_date >= start_date`. The validation lives only in TypeScript.
- **No automated drift detection for this section**. The manifest globs (`supabase/migrations/**`, `src/types/index.ts`) cover the main sources, but the live DB schema may diverge from the migration files if any out-of-band SQL is run. The integration tests are the only live-schema verification.

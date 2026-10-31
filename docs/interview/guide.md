# Smoke Ledger India — Interview Q&A Study Guide

> An external-evaluator's walkthrough of the Smoke Ledger India codebase, structured as 95 questions across 12 sections. Every claim cites a `file:line` so you can verify against the repo. Difficulty is calibrated to the codebase: **easy** = locate + transcribe, **medium** = locate + connect + reason, **hard** = locate + critique + propose.

## How to use this guide

You are reading this as if you've never seen the project. The questions are arranged in reading order: schema → security → correctness → analytics → operations. Each question stands alone, but adjacent questions build on shared context.

**For data-analytics candidates:** emphasize Sections 7 (Aggregations), 8 (Time-series), 10 (Money/date/locale), 11 (Cross-platform parity). The other sections are background.

**For database-engineer candidates:** emphasize Sections 1 (Schema), 2 (RLS), 3 (SECURITY DEFINER), 4 (Audit/DPDP), 5 (Rate limit), 6 (Idempotency), 9 (Catalog), 12 (Failure modes).

**For both roles:** Sections 4 and 12 are the most informative — they reveal how the team reasons about failure modes, observability, and trade-offs.

### Difficulty calibration

- **Easy (2-3 min)** — read what is in the file and report it. Locate + transcribe.
- **Medium (5-7 min)** — explain *why* this artifact is shaped the way it is, given the surrounding code. Locate + connect + reason.
- **Hard (8-12 min)** — argue for or against this design choice and propose an alternative. Locate + critique + propose. Vague answers fail.

**Hard rule:** if a hard question can be answered by quoting one sentence from a migration comment, it's mis-tagged.

### Citation format

Every `expected-answer` and `anti-answer` bullet cites `<relative/path/from/repo/root>:<line[-line2]>`. Forward slashes, relative to repo root.

### Repo map (read this first)

Smoke Ledger India is a monorepo with three surfaces and one database:

- `web/` — Next.js 14 App Router. Primary surface (web-first).
- `app/` — Expo Router SDK 56 (React Native, React 19, Reanimated 4). Play Store via EAS.
- `src/` — shared domain logic, repositories, validation, types, Zustand stores. Both web and mobile import via `@/` (web also uses `@web/`).
- `supabase/migrations/` — 30 SQL migrations, the schema source of truth.
- `supabase/functions/` — three edge functions: `audit-record`, `delete-account`, `send-sms-otp` (the last is intentionally OFF for production).
- `docs/spec/` — 10-section "mother book," drift-guarded.

Backend: Supabase project `tvcwrsglceahkjnfuzkn` (us-east-2). Postgres + Auth + RLS. Auth is email+password + magic link only — phone/SMS OTP is intentionally disabled.

Key deps: Supabase JS v2.49, Zod, Zustand, react-hook-form, dayjs (IST), Reanimated 4, react-native-svg.

---

## Section 1 — Schema design & normalization

The database has 14 public tables and 3 `smoke_seed.*` catalog tables. The schema is the foundation of everything else in this codebase. Before reading SQL, look at the file count in `supabase/migrations/` — there are 30 of them, applied chronologically. That alone tells you something: the schema evolved under real production pressure, not from a clean whiteboard.

The two-schema split (`public` vs `smoke_seed`) is the first thing to understand. `smoke_seed` is server-only seed data (brand catalog, smoking facts, health milestones); no client role has any privilege on it. `public` is user-owned data, every table RLS-enabled. This split isn't accidental — it makes the privilege boundary visible at the schema level.

### 1.1 — Schema inventory

> **Easy / Database-engineer / 3 min**

**Question.** List every table in `public` and `smoke_seed`. Which tables have RLS enabled, and which have policies?

**Why this matters.** RLS coverage is the foundational security claim. A table without RLS is a leak waiting to happen.

**Expected answer.**

- Public user-owned tables (14): `user_profiles`, `brands`, `brand_variants`, `cigarette_logs`, `price_entries`, `goals`, `settings_kv`, `reminders`, `usage_events`, `user_facts_seen`, `audit_events`, `error_events`, `rate_limit_counters`. Plus `v_daily_summary_user` and `v_mood_trigger_heatmap` views.
- Server-only seed tables (3 in `smoke_seed`): `brand_catalog`, `smoking_facts`, `health_milestones`. All three have `REVOKE ALL ON SCHEMA smoke_seed FROM PUBLIC; REVOKE ALL ON ALL TABLES IN SCHEMA smoke_seed FROM PUBLIC;` in `supabase/migrations/20250426120000_initial_schema.sql:6-35`.
- RLS is enabled on all 14 public tables. The policy count is 16 — one per table for most, but `error_events` has split SELECT/INSERT policies and `rate_limit_counters` has an explicit deny.
- `v_daily_summary_user` and `v_mood_trigger_heatmap` are both `SECURITY INVOKER`, so they inherit RLS from `cigarette_logs`.

**Anti-answers.**

- "`smoke_seed` has RLS enabled" — no, the seed schema is protected by `REVOKE`, not RLS. RLS is per-table; `REVOKE` is per-role and is sufficient when no client role needs access.
- "`audit_events` and `error_events` have the same policy shape" — they don't. `audit_events` is SELECT-only-for-owner with INSERT through a `SECURITY DEFINER` RPC; `error_events` has split INSERT/SELECT policies and no UPDATE/DELETE policies at all (default-deny).

**Follow-ups.**

1. Why does `error_events` need no UPDATE policy?
2. What is the role of `v_mood_trigger_heatmap` and which dashboard tile reads it?

**Tags.** rls, schema, security-invoker, revoke

---

### 1.2 — The `local_date text` decision

> **Medium / Database-engineer / 5 min**

**Question.** Open `supabase/migrations/20250426120000_initial_schema.sql:76-100`. The `cigarette_logs` table stores `local_date text NOT NULL` rather than `date`. Why is that the right call for an India-first product, and what would break if it were `date`?

**Why this matters.** A wrong type choice here propagates into every aggregation, every RPC, every index. It's the kind of decision you only notice when it goes wrong.

**Expected answer.**

- `local_date` is a *calendar date in IST*, not a timestamp. Storing as `text` avoids Postgres's `date` type coercing to UTC midnight in some clients (`20250426120000_initial_schema.sql:76-100`).
- The app stores `'YYYY-MM-DD'` strings derived from `ts_utc` via `toLocalDate()` in `src/lib/date.ts`. IST is `Asia/Kolkata` — UTC+5:30, no DST, half-hour offset from UTC. A naive `date` cast would convert to UTC at midnight, shifting the calendar day for any user logging late evening.
- Downstream code casts to `::date` only when filtering (`local_date::date BETWEEN p_from_date AND p_to_date` in `list_logs_page` — fixed in `supabase/migrations/20260523171527_fix_list_logs_page_date_cast.sql`). The cast is intentional and bounded.
- The tradeoff: text can't be range-constrained by Postgres, no arithmetic on dates without a cast, no `EXTRACT(YEAR FROM local_date)`. The codebase pays this cost in exchange for unambiguous IST storage.

**Anti-answers.**

- "`text` is faster than `date`" — no, it's slightly slower. The choice is about semantics, not perf.
- "Postgres `date` type already handles timezones correctly" — only if you're always UTC. `date` has no timezone; midnight-UTC vs midnight-IST is a real, observable difference.

**Follow-ups.**

1. What would change if the product added multi-country support (say, US east coast)?
2. Why does `list_logs_page` filter via `local_date::date` rather than `text` comparison?

**Tags.** schema, ist, timezone, type-choice

---

### 1.3 — Snapshot columns on `cigarette_logs`

> **Medium / Both / 5 min**

**Question.** Open `supabase/migrations/20250426120000_initial_schema.sql:76-100` and `src/db/repositories/logs.ts`. The `cigarette_logs` table stores `brand_name_snap` and `variant_snap` alongside `brand_id`. Why snapshot the name when there is a foreign key to `brands`?

**Why this matters.** Snapshots decouple history from present. Without them, a renamed brand rewrites history.

**Expected answer.**

- `brand_name_snap` and `variant_snap` are denormalized copies of `brands.name` and `brand_variants.name` taken at write time. The FK to `brands` is `ON DELETE SET NULL` (`20250426120000_initial_schema.sql:76-100`), so the relationship is preserved even if the brand is deleted.
- A historical "I smoked Gold Flake King on Tuesday" log should display "Gold Flake King" forever, regardless of whether the user later renamed that variant to "Gold Flake King (menthol)" or deleted the brand entirely. Without the snapshot, the report would silently re-link to whatever brand_id happened to point to now.
- The snapshot is also what makes DPDP export meaningful: the export envelope (`EXPORT_SCHEMA_VERSION = 2`) carries the snapshots directly.
- Cost: a small amount of storage duplication, and the obligation to keep snapshot write logic in lock-step with the catalog. Acceptable.

**Anti-answers.**

- "Snapshots improve query performance" — they don't, in any meaningful way; the FK join is cheap.
- "Snapshots make the data immutable" — they don't, the table itself is mutable; the snapshots are merely a write-time copy.

**Follow-ups.**

1. What if the user corrects a typo in a brand name the same day? Does the snapshot get rewritten?
2. Where is the snapshot written — client or RPC?

**Tags.** schema, denormalization, history, snapshots

---

### 1.4 — Why `audit_events.user_id` is nullable

> **Medium / Database-engineer / 5 min**

**Question.** Open `supabase/migrations/20260521000000_audit_export_ops.sql:24-30` and `:295-310`. The `audit_events.user_id` column was made nullable and the FK changed to `ON DELETE SET NULL`. Walk through the migration and explain the rationale.

**Why this matters.** Audit retention under erasure is a regulated behaviour. The schema must survive `auth.users` deletion without losing the audit trail.

**Expected answer.**

- Originally `audit_events.user_id` was `NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE`. When the user deleted their account, audit rows cascaded away. That defeated forensic continuity — the system lost its record of *what the deleted user did*.
- The fix (`20260521000000_audit_export_ops.sql:24-30`): drop NOT NULL, change cascade to `SET NULL`. Now deleting the auth user nullifies `user_id` on existing audit rows; the row stays, the link to the identity is severed.
- The peppered hash is the link-back: `props_json.hashed_user_id = sha256(user_id || audit_pepper)` makes the surviving row still attributable to the same deletion event without exposing the original user_id. Without the pepper, `null` is just `null`.
- RLS still scopes SELECT to `user_id = (select auth.uid())` — but the deleted user has no `auth.uid()` anymore, so they can't read their own audit history post-deletion. Only service_role or another owner can.

**Anti-answers.**

- "Audit rows should be deleted when the user is deleted" — that's the unfixable version; you can't prove a deletion happened if you delete the evidence.
- "`SET NULL` is the same as `DELETE`" — no, the row is preserved, the column is nulled; `SELECT count(*) FROM audit_events` still includes the anonymized rows.

**Follow-ups.**

1. Who can read the anonymized audit rows after deletion?
2. What's in `props_json` for an anonymized row?

**Tags.** schema, audit, dpdp, retention, pepper

---

### 1.5 — The `price_sum_inr` / `price_count` running mean

> **Hard / Both / 8 min**

**Question.** Open `supabase/migrations/20260520000000_security_correctness.sql:120-180` and `src/db/repositories/brands.ts`. The `brand_variants` table has `price_sum_inr numeric NOT NULL DEFAULT 0` and `price_count int NOT NULL DEFAULT 0` columns. Walk through how the running mean is maintained on every log write, and what the alternative designs were.

**Why this matters.** A running mean is a textbook statistics problem with a textbook SQL solution. The choice made here has a subtle interaction with the seed-refresh gate.

**Expected answer.**

- On every successful `create_log_with_rate_limit` insert, the matching `brand_variants` row has its `price_sum_inr` increased by `unit_price_inr` and `price_count` incremented. The new `avg_price_inr` is `nextSum / nextCount` — a true running mean (`20260520000000_security_correctness.sql:120-180`).
- This replaced a "midpoint" hack that was in the codebase earlier — averaging the previous `avg_price_inr` with the new observation at 50/50 weight regardless of how many observations preceded it.
- The repo side mirrors this: `upsertVariant` in `src/db/repositories/brands.ts` calls the same RPC path and re-derives the mean client-side for the optimistic update.
- **The non-obvious bit:** `setVariantPriceOverride` deliberately sets `price_count = 1` so it survives every future `refresh_seed_prices_from_catalog` call. The seed-refresh SQL only rewrites rows where `COALESCE(price_count, 0) = 0` — `= 1` is the load-bearing escape hatch.
- Alternative designs: (a) trigger-maintained materialized view per variant, (b) compute on read, (c) external analytics system. The chosen design is the cheapest that survives the seed-refresh gate.

**Anti-answers.**

- "Just store `avg_price_inr` and recompute on every change" — that's the midpoint hack the team replaced.
- "Use Postgres `AVG()` over a window" — that would be a per-query aggregate, not a running mean; you'd lose it on every read.

**Follow-ups.**

1. What happens if `price_count` is incremented but the insert is rolled back?
2. Why is the column called `price_sum_inr` not `price_total_inr`?

**Tags.** schema, analytics, running-mean, seed-refresh

---

### 1.6 — Two schemas, one database

> **Medium / Database-engineer / 5 min**

**Question.** Open `supabase/migrations/20250426120000_initial_schema.sql:1-35` and any subsequent catalog migration. Why does this codebase use two schemas (`public` and `smoke_seed`) instead of one?

**Why this matters.** The two-schema split encodes the security model. If you don't see it, you'll misread every subsequent migration.

**Expected answer.**

- `public` is for user-owned data; `smoke_seed` is for server-controlled reference data (brand catalog, smoking facts, health milestones).
- The split makes the privilege boundary visible: `REVOKE ALL ON SCHEMA smoke_seed FROM PUBLIC` at the top of `20250426120000_initial_schema.sql:6-35` says "no client role may touch this schema, period." You don't need RLS because there's no privilege to gate.
- Reads from `smoke_seed` go through `SECURITY DEFINER` RPCs (`apply_default_brands`, `sync_catalog_for_user`, `get_random_facts`, `get_health_milestones`). The RPC layer is the only entry point, so the schema can stay fully locked.
- Without this split, you'd either grant `SELECT` on `smoke_seed.brand_catalog` to authenticated (leaking the catalog) or invent a parallel "internal_*" schema later. Encoding the boundary now means future migrations don't have to think about it.

**Anti-answers.**

- "Two schemas just for organization" — no, the split is security-driven. You could organize within one schema using prefix conventions; the security boundary is the reason.
- "RLS would do the same job" — RLS protects rows; `REVOKE` protects the entire schema. They're complementary, not substitutes.

**Follow-ups.**

1. Could a client ever read from `smoke_seed` directly?
2. What happens if a malicious client tries to `select * from smoke_seed.brand_catalog`?

**Tags.** schema, security, revoke, smoke-seed

---

### 1.7 — FK cascade choices

> **Medium / Database-engineer / 5 min**

**Question.** Open `supabase/migrations/20250426120000_initial_schema.sql:48-100` and compare the FK actions on each user-owned table: `brands`, `brand_variants`, `cigarette_logs`, `goals`, `audit_events`, `error_events`, `rate_limit_counters`. Note which use `CASCADE`, which use `RESTRICT`, which use `SET NULL`, and explain why the choice differs.

**Why this matters.** FK action choice is a design statement about what should happen when ownership is severed.

**Expected answer.**

- `CASCADE` on user-owned data: `brands`, `brand_variants`, `cigarette_logs`, `price_entries`, `goals`, `settings_kv`, `reminders`, `usage_events`, `user_facts_seen` — when the user is deleted, all their data goes with them. (`20250426120000_initial_schema.sql:37-145`.)
- `RESTRICT` on `brand_variants.brand_id REFERENCES brands(id)` — you cannot delete a brand while it has variants. This is why `deleteBrand` in `src/db/repositories/brands.ts` special-cases Postgres `23503` (FK violation) as `AppError('conflict', 'brand_has_variants: …')`.
- `SET NULL` on `audit_events.user_id` and `error_events.user_id` (changed in `20260521000000_audit_export_ops.sql:24-30`) — audit rows survive account deletion, anonymized.
- `CASCADE` on `audit_events.props_json` style would be wrong; the audit is the evidence, not the dependent.
- The choice encodes: "user data dies with the user; audit data survives; structural invariants are protected."

**Anti-answers.**

- "Use `CASCADE` everywhere for simplicity" — that loses audit evidence and breaks brand-variant invariant.
- "Use `RESTRICT` everywhere to be safe" — that makes user deletion impossible without manual cleanup.

**Follow-ups.**

1. What is the order of operations when a user account is deleted?
2. What error does `deleteBrand` raise if variants exist?

**Tags.** schema, foreign-key, cascade, restrict, set-null

---

### 1.8 — Why is `client_op_id` a partial unique index?

> **Medium / Database-engineer / 5 min**

**Question.** Open `supabase/migrations/20260520000000_security_correctness.sql:60-100`. The `cigarette_logs` table has `client_op_id text` plus a partial unique index `uq_logs_user_client_op (user_id, client_op_id) WHERE client_op_id IS NOT NULL`. Walk through why it's a partial index and not a full one.

**Why this matters.** Partial indexes are a precise tool. They say "uniqueness matters here, but only when this predicate holds."

**Expected answer.**

- `client_op_id` is generated client-side (`makeId('op')` in `src/lib/id.ts`) and sent with every log write for idempotent retries on flaky mobile networks.
- A *full* unique index `(user_id, client_op_id)` would require every existing log row to have a non-null `client_op_id`. But logs written before the column existed have `NULL`, and multiple `NULL`s are allowed in SQL unique indexes — so a full index would *not* enforce uniqueness on NULL values anyway, which makes the partial index semantically identical but cheaper.
- The partial form (`WHERE client_op_id IS NOT NULL`) says "only enforce uniqueness when the client actually provided one." The index doesn't store NULL rows, so it's smaller; queries that don't filter on `client_op_id` don't have to consult it.
- The retry path: same `client_op_id` short-circuits in `create_log_with_rate_limit` (see `20260520000000_security_correctness.sql:60-100`) without raising an error.

**Anti-answers.**

- "Partial indexes are faster than full indexes" — not in general; they're smaller, but per-row cost is similar.
- "`NULL` is treated as distinct in Postgres unique indexes" — true, so a full unique index wouldn't actually enforce on NULLs; the partial form makes the intent explicit.

**Follow-ups.**

1. What happens if two different users generate the same `client_op_id`?
2. What error is raised on a duplicate non-NULL `client_op_id`?

**Tags.** schema, idempotency, partial-index, unique

---

### 1.9 — `usage_events` is a separate stream from `audit_events`

> **Easy / Both / 3 min**

**Question.** Open `supabase/migrations/20250426120000_initial_schema.sql:142-160`. The `usage_events` table exists alongside `audit_events`. What's the difference between them, and why are they separate?

**Why this matters.** Two observability streams with different retention rules, different RLS, and different consumers. Mixing them up is a privacy mistake.

**Expected answer.**

- `audit_events` is server-written only (via `record_audit_event` SECURITY DEFINER RPC), SELECT-only for the owner, retained for forensic compliance. (`20250426120000_initial_schema.sql:142-160`.)
- `usage_events` is client-insertable, client-readable, has its own per-command RLS policies (`usage_select`, `usage_insert`, `usage_delete` — no UPDATE). It's a product-analytics stream (page views, button taps) gated by `consent.analyticsOptIn`.
- The split exists because audit is *required* (regulatory, security) and usage is *optional* (analytics, opt-in). They have different retention, different access patterns, different schema.
- Mixing them would force one set of rules on both — either you'd accidentally retain analytics data past consent revocation, or you'd accidentally delete audit evidence.

**Anti-answers.**

- "Audit is just logs with extra fields" — no, the access model is fundamentally different.
- "`usage_events` is the same as `audit_events` but client-writable" — true in shape, but the *intent* differs and so do the policies.

**Follow-ups.**

1. What happens to `usage_events` rows when the user revokes analytics consent?
2. Could a user ever read another user's `audit_events`?

**Tags.** schema, observability, audit, usage, consent

---

### 1.10 — The `daily_summary` view is not a materialized view

> **Hard / Both / 10 min**

**Question.** Open `supabase/migrations/20260524050357_add_daily_summary.sql:1-60`, `20260602000000_perf_rls_initplan_indexes.sql:57-60`, and `20260621000000_daily_summary_sum_quantity.sql`. The team uses a regular VIEW (`v_daily_summary_user`) for daily aggregates, not a materialized view and not an on-write rollup table. Take a position: was that the right call as of 2026-08, and what is the first migration you would write if the answer is "no, change it"? If "yes," what is the load threshold that would flip the call?

**Why this matters.** This is a real trade-off the team made, with a real bug (the `SUM(quantity)` fix) showing the cost of evolving the view.

**Expected answer.**

- The view is `SECURITY INVOKER` (fixed in `20260602000000_perf_rls_initplan_indexes.sql:57-60` because the original was SECURITY DEFINER and bypassed RLS — a cross-user data leak). A materialized view would not inherit RLS by default; per-user refresh partitioning would be required to avoid the same leak.
- The query is a single `GROUP BY (user_id, local_date)` summing `quantity` and `total_price_inr`. With the composite index from `20260531080049_scale_forward_indexes.sql`, a sum is O(rows/day) per user.
- An on-write rollup would require either a trigger on `cigarette_logs` (more SECURITY DEFINER surface) or a daily cron, both adding failure modes.
- **Defend:** correct under ~10k rows/user/month; cost bounded by partial index and SECURITY INVOKER inheritance.
- **Attack:** the view will hit a cliff around 100k rows/user; first migration is a per-user materialized view refreshed on insert via trigger that updates only the affected `(user_id, local_date)` tuple.
- In either case, cite `20260621000000_daily_summary_sum_quantity.sql` as evidence the team has already had to amend the view once — i.e., the cost of evolving a view is real.

**Anti-answers.**

- "Just add Redis" — bypasses source of truth; app already has client-side summary caching.
- "Materialize it without thinking about RLS" — would leak rows across users.

**Follow-ups.**

1. What's the migration sequence to backfill, switch reads, and roll back?
2. What does `periodSummary.ts` do that the view does not?

**Tags.** view, rollup, perf, rls, kpi

---

## Section 2 — Row-Level Security (RLS)

RLS is the security backbone. Every user-owned table has a policy; every policy has a structure; the structures share patterns. There are 16 policies. The most important pattern is `(SELECT auth.uid())` — the initplan rewrite — and understanding why it matters requires understanding how Postgres plans RLS.

The key insight: `auth.uid()` is `VOLATILE` (it can return different values for the same query — actually it doesn't, but the planner has to assume it might). A naive `WHERE user_id = auth.uid()` re-evaluates `auth.uid()` for *every row* in the table. Wrapping it in `(SELECT auth.uid())` lets the planner evaluate it once per query (the "initplan" optimization), making the predicate index-friendly.

This is the load-bearing performance optimization. Without it, every query would be a sequential scan, even on indexed tables.

### 2.1 — The initplan pattern

> **Medium / Database-engineer / 6 min**

**Question.** Open `supabase/migrations/20260602000000_perf_rls_initplan_indexes.sql:14-42`. Walk through what the migration does. Explain: what problem does wrapping `auth.uid()` in `(SELECT auth.uid())` solve, what would break if the wrapper were removed, and what's the rule of thumb for spotting other RLS policies in this repo that need the same fix?

**Why this matters.** The initplan optimization is what makes policies index-friendly at scale. This is asked of every DB-engineer candidate.

**Expected answer.**

- `auth.uid()` is `VOLATILE` in Postgres — a policy calling it directly is re-evaluated per row, defeating partial indexes. (`20260602000000_perf_rls_initplan_indexes.sql:14-22`.)
- Wrapping in `(SELECT auth.uid())` makes the planner treat it as `STABLE` per statement, so the index can be used as an initplan. (`20260602000000_perf_rls_initplan_indexes.sql:24-42`.)
- Without this, the partial index on `cigarette_logs(user_id, local_date)` would never be picked; every read would seq-scan.
- Rule of thumb: any RLS policy whose predicate calls a volatile function (`auth.uid()`, `current_setting(..., false)`) needs the SELECT wrapper. All 16 policies in this repo have it.

**Anti-answers.**

- "Caching `auth.uid()` in a session variable" — Postgres has no per-row user cache; SET LOCAL inside RLS is not allowed.
- "Adding a BRIN index" — wrong tool; this is per-row volatility, not column cardinality.

**Follow-ups.**

1. Why doesn't the repo use `current_setting('request.jwt.claim.sub', true)` instead?
2. If we added column-level GRANT, does the initplan rule still apply?

**Tags.** rls, perf, initplan, auth

---

### 2.2 — The 16 policies, by table

> **Easy / Database-engineer / 3 min**

**Question.** List every RLS policy in the repo. For each, name the table, command (`SELECT`/`INSERT`/`UPDATE`/`DELETE`/`ALL`), target role, and the `USING`/`WITH CHECK` expression.

**Why this matters.** Knowing the policy inventory is the baseline; you can't reason about RLS without it.

**Expected answer.**

| Table | Policy | Cmd | Role | USING | WITH CHECK |
|---|---|---|---|---|---|
| user_profiles | user_profiles_select | SELECT | authenticated | `id = (SELECT auth.uid())` | — |
| user_profiles | user_profiles_insert | INSERT | authenticated | — | `id = (SELECT auth.uid())` |
| user_profiles | user_profiles_update | UPDATE | authenticated | `id = (SELECT auth.uid())` | `id = (SELECT auth.uid())` |
| brands | brands_all | ALL | authenticated | `user_id = (SELECT auth.uid())` | `user_id = (SELECT auth.uid())` |
| brand_variants | variants_all | ALL | authenticated | `user_id = (SELECT auth.uid())` | `user_id = (SELECT auth.uid())` |
| cigarette_logs | logs_all | ALL | authenticated | `user_id = (SELECT auth.uid())` | `user_id = (SELECT auth.uid())` |
| price_entries | price_entries_all | ALL | authenticated | `user_id = (SELECT auth.uid())` | `user_id = (SELECT auth.uid())` |
| goals | goals_all | ALL | authenticated | `user_id = (SELECT auth.uid())` | `user_id = (SELECT auth.uid())` |
| settings_kv | settings_kv_all | ALL | authenticated | `user_id = (SELECT auth.uid())` | `user_id = (SELECT auth.uid())` |
| reminders | reminders_all | ALL | authenticated | `user_id = (SELECT auth.uid())` | `user_id = (SELECT auth.uid())` |
| usage_events | usage_select | SELECT | authenticated | `user_id = (SELECT auth.uid())` | — |
| usage_events | usage_insert | INSERT | authenticated | — | `user_id = (SELECT auth.uid())` |
| usage_events | usage_delete | DELETE | authenticated | `user_id = (SELECT auth.uid())` | — |
| user_facts_seen | user_facts_seen_all | ALL | authenticated | `user_id = (SELECT auth.uid())` | `user_id = (SELECT auth.uid())` |
| audit_events | audit_events_select | SELECT | authenticated | `user_id = (SELECT auth.uid())` | — |
| error_events | error_events_select | SELECT | authenticated | `user_id = (SELECT auth.uid())` | — |
| error_events | error_events_insert | INSERT | authenticated | — | `user_id = (SELECT auth.uid()) AND category <> 'compliance.delete'` |
| rate_limit_counters | rate_limit_counters_deny_clients | ALL | anon, authenticated | `false` | `false` |

**Anti-answers.**

- "All tables have a single `FOR ALL` policy" — `error_events` and `usage_events` have split policies; `audit_events` is INSERT-restricted.

**Follow-ups.**

1. Why does `usage_events` have no UPDATE policy?
2. Why does `rate_limit_counters` have a deny policy rather than no policy at all?

**Tags.** rls, policies, inventory

---

### 2.3 — `rate_limit_counters` is the double-lock

> **Medium / Database-engineer / 5 min**

**Question.** Open `supabase/migrations/20260523092236_add_rate_limit_counters.sql` and `20260619180000_rate_limit_counters_explicit_deny.sql`. The `rate_limit_counters` table has RLS enabled, an explicit deny policy, AND `REVOKE ALL FROM anon, authenticated`. Walk through the three layers of defense.

**Why this matters.** A rate-limit table that's writable by clients is a useless rate-limit table. The team layered three defenses to be sure.

**Expected answer.**

- Layer 1: `REVOKE ALL ON TABLE rate_limit_counters FROM anon, authenticated` in `20260619180000_rate_limit_counters_explicit_deny.sql` — at the privilege level, no client role has any access. Even before RLS is consulted, the role lacks SELECT/INSERT/UPDATE/DELETE.
- Layer 2: explicit deny policy `rate_limit_counters_deny_clients FOR ALL TO anon, authenticated USING (false) WITH CHECK (false)` — at the RLS level, even if a privilege were granted, the policy says false. Belt-and-suspenders.
- Layer 3: only `consume_rate_limit` SECURITY DEFINER RPC (granted to service_role) can write. Clients cannot call this RPC because EXECUTE was revoked from authenticated in `20260531075255_lockdown_secdef_execute.sql`.
- Three layers because each fails differently: a future migration could regrant the privilege (layer 2 catches it); the policy could be dropped (layer 1 catches it); a client could attempt direct SQL (layer 3 catches it).

**Anti-answers.**

- "REVOKE is enough; RLS is redundant" — REVOKE protects against direct privilege grants; RLS protects against accidentally granted SELECT and is the policy layer the team documents.
- "RLS alone is enough" — RLS is per-row, not per-role; without REVOKE, an authenticated role could still have SELECT privilege that RLS would filter, but the planner cost is wasted.

**Follow-ups.**

1. What's the migration sequence if you accidentally dropped the deny policy?
2. Why is the policy `FOR ALL` and not `FOR SELECT, INSERT` separately?

**Tags.** rls, rate-limit, defense-in-depth, revoke

---

### 2.4 — `error_events` is the split-policy table

> **Medium / Database-engineer / 5 min**

**Question.** Open `supabase/migrations/20260520000000_security_correctness.sql:200-260` and `20260619000000_error_events_compliance_check.sql`. The `error_events` table has only SELECT and INSERT policies for authenticated — no UPDATE, no DELETE — and the INSERT policy has `category <> 'compliance.delete'`. Walk through why.

**Why this matters.** Error events are observability data with compliance value. Tampering with them is a regulatory issue.

**Expected answer.**

- SELECT: clients see only their own (`user_id = (SELECT auth.uid())`). They can introspect their own error history.
- INSERT: clients can write non-compliance rows. The CHECK `category <> 'compliance.delete'` blocks them from inserting forensic DPDP records — those must come through service_role.
- No UPDATE / DELETE policies: by default RLS denies, so clients cannot tamper with existing rows. The migration DROP + no-recreate is documented explicitly in the comments as "Intentionally do NOT recreate."
- Layer 4 is a CHECK constraint: `error_events_compliance_delete_null_user_check` enforces `category = 'compliance.delete' ⇒ user_id IS NULL` (added in `20260619000000_error_events_compliance_check.sql`). Service_role inserts forensic rows; they're invisible to the subject via RLS; cannot be UPDATEd/DELETEd by anyone.
- The four-layer tamper resistance: (1) INSERT policy, (2) no UPDATE/DELETE policies, (3) layer-2 also covers the SELECT path, (4) CHECK constraint. Each layer fails differently.

**Anti-answers.**

- "Why not just have ALL permissions and rely on application logic?" — application logic is the layer you don't trust; database invariants survive app bugs.
- "DELETE not allowed because audit" — it's not about audit, it's about preventing forensic tampering.

**Follow-ups.**

1. What error does a client get if they try to UPDATE an `error_events` row?
2. What error does a client get if they try to INSERT a `category = 'compliance.delete'` row?

**Tags.** rls, error-events, compliance, tamper-resistance

---

### 2.5 — `audit_events` is INSERT-closed to clients

> **Medium / Database-engineer / 5 min**

**Question.** Open `supabase/migrations/20260521000000_audit_export_ops.sql:295-310` and `20260531075255_lockdown_secdef_execute.sql`. The `audit_events` table has only a SELECT policy for authenticated. Walk through how an audit event actually gets written.

**Why this matters.** Audit data is server-controlled. Clients writing their own audit would defeat the purpose.

**Expected answer.**

- No INSERT policy for `authenticated` → RLS default-deny → clients cannot write audit rows directly.
- The only writes go through `record_audit_event` SECURITY DEFINER RPC (`20260521000000_audit_export_ops.sql:295-310`). This function was originally granted to `authenticated`; the migration revokes that grant, leaving only `service_role`.
- `service_role` bypasses RLS entirely, so it can write any audit row without policy evaluation.
- Clients wanting to log an audit event call the `audit-record` Edge Function (`supabase/functions/audit-record/index.ts`), which uses a service-role client to invoke `record_audit_event`. The Edge Function enforces an event-type allowlist and rate limits per user.
- Result: clients can read their own audit log; cannot write to it; the only write path is server-mediated.

**Anti-answers.**

- "Just use a trigger" — triggers fire on data events, not user actions; `discreet_mode_toggled` and `consent_revoked` aren't data events.
- "Use Postgres `LISTEN`/`NOTIFY`" — that's the wrong direction; it doesn't write audit, just signals.

**Follow-ups.**

1. What is the rate limit on `audit-record`?
2. What event types are in the allowlist?

**Tags.** rls, audit, security-definer, service-role

---

### 2.6 — Realtime RLS is evaluated before delivery

> **Medium / Both / 6 min**

**Question.** Open `supabase/migrations/20260606000000_realtime_publications.sql`, `20260620130000_realtime_enable.sql`, and `20260622000000_realtime_brands.sql`. The `supabase_realtime` publication includes 5 tables. How does RLS interact with realtime delivery?

**Why this matters.** Realtime without RLS would be a real-time data leak.

**Expected answer.**

- Supabase realtime applies the RLS SELECT policy *before* delivering a `postgres_changes` event. The client receives only the rows it could already `SELECT`. (`20260606000000_realtime_publications.sql:1-30` and `20260620130000_realtime_enable.sql:1-15`.)
- The client-side `filter: 'user_id=eq.<uid>'` is defense-in-depth, not the primary guard. RLS is the primary guard.
- Tables excluded from publication: `audit_events`, `error_events`, `usage_events`, `price_entries`, `reminders`, `settings_kv`, `user_facts_seen`, `rate_limit_counters`. The channel cost outweighed the UX win.
- `REPLICA IDENTITY FULL` is required on `cigarette_logs`, `goals`, `brands`, `brand_variants` because UPDATE/DELETE events need `user_id` in the OLD tuple for the client filter to work. Default identity only publishes the PK. (`20260620130000_realtime_enable.sql:18-30`.)
- `user_profiles` doesn't need `FULL` because the client filters on `id` (the PK).

**Anti-answers.**

- "RLS isn't applied to realtime events" — it is, by Supabase design.
- "REPLICA IDENTITY FULL is a performance optimization" — it's not; it's correctness.

**Follow-ups.**

1. What would happen if a row was updated and the user filter didn't see the OLD tuple?
2. Why are `audit_events` and `error_events` excluded?

**Tags.** rls, realtime, replica-identity, publication

---

### 2.7 — When RLS is bypassed intentionally

> **Medium / Database-engineer / 5 min**

**Question.** Find every place in the schema where RLS is intentionally bypassed. For each, explain the bypass mechanism (SECURITY DEFINER, service_role, view ownership) and the threat model.

**Why this matters.** RLS bypasses are a feature, not a bug — but they need to be explicit and audited.

**Expected answer.**

- `v_daily_summary_user` was originally `SECURITY DEFINER` and bypassed RLS — the original migration omitted `security_invoker`. This was a *bug* — fixed in `20260602000000_perf_rls_initplan_indexes.sql:57-60` to set `security_invoker = true`. RLS now applies.
- `consume_rate_limit` SECURITY DEFINER RPC bypasses RLS by design — it needs to write `rate_limit_counters` on behalf of any caller. Service-role grant. (`20260523092236_add_rate_limit_counters.sql:25-50`.)
- `record_audit_event` SECURITY DEFINER RPC bypasses RLS — needs to write `audit_events` for any caller. Service-role grant. (`20260519100000_hardening_and_compliance.sql:60-90`.)
- `apply_default_brands` / `sync_catalog_for_user` SECURITY DEFINER — write to `brands`/`brand_variants` on behalf of new users.
- `handle_new_user` trigger function runs as `auth.users` table owner — bypasses RLS for the initial profile insert. (`20250426120000_initial_schema.sql:240-260`.)
- `enforce_profile_identity_rules` trigger function does NOT need SECURITY DEFINER (it's BEFORE UPDATE on `user_profiles`, which the user can already write to via RLS).
- Service_role: `auth.admin.deleteUser`, `audit-record` Edge Function, `delete-account` Edge Function. All run server-side with the service_role key.

**Anti-answers.**

- "RLS is always applied" — false; triggers and SECURITY DEFINER can bypass.
- "SECURITY DEFINER is dangerous" — it's safe when the function pins `search_path = ''` and is granted narrowly.

**Follow-ups.**

1. What's the threat model if a SECURITY DEFINER function has `search_path = pg_catalog, public`?
2. How would you audit all SECURITY DEFINER bypasses?

**Tags.** rls, security-definer, service-role, bypass

---

### 2.8 — RLS performance at scale

> **Hard / Database-engineer / 8 min**

**Question.** A user has 100,000 cigarette_logs over 5 years. They open Trends and request a Year view. Walk through every RLS-relevant operation, including which index is consulted and which is not.

**Why this matters.** RLS performance is not free; understanding the access pattern tells you what scales and what doesn't.

**Expected answer.**

- `get_daily_summary(p_from, p_to)` RPC: range-scoped to 366 days max. (`20260524050357_add_daily_summary.sql:23-40`.)
- Reads `v_daily_summary_user` filtered by `auth.uid()`. View is SECURITY INVOKER so RLS on `cigarette_logs` applies.
- `cigarette_logs` RLS: `user_id = (SELECT auth.uid())` — initplan-evaluated once, then index-scanned on `(user_id, ts_utc DESC)`. (`20260531080049_scale_forward_indexes.sql:18-40`.)
- Group by `(user_id, local_date)`. The result is ~365 rows for a 1-year user with ~270 daily-active days.
- For Trends Year: that's the only data needed. No raw-log read.
- For Trends Day/Week/Month: client-side reads raw logs, scoped to 60-90 days via `list_logs_page` keyset pagination. (`20260523092053_add_list_logs_page.sql` and `20260523171527_fix_list_logs_page_date_cast.sql`.)
- What doesn't scale: a Trends "all-time" view. The 366-day cap in `get_daily_summary` is the explicit design choice. Without it, the view would scan all rows.

**Anti-answers.**

- "Postgres will just figure it out" — no; partial indexes and initplan are explicit choices.
- "Just cache the result" — cache invalidation on every insert is the hard problem.

**Follow-ups.**

1. What's the cost difference between an index scan and a seq scan at 100k rows?
2. Why is the Year cap 366 days specifically?

**Tags.** rls, perf, indexing, trends

---

### 2.9 — Why RLS on `rate_limit_counters` is enabled but no real policy

> **Easy / Database-engineer / 3 min**

**Question.** The `rate_limit_counters` table has RLS enabled, but the only policy is the explicit deny `rate_limit_counters_deny_clients`. Why have RLS at all if there's no policy allowing reads or writes?

**Why this matters.** RLS-enabled-with-deny is a deliberate signal. It says "no client role has access here, period."

**Expected answer.**

- The REVOKE handles the privilege layer; the RLS deny policy handles the policy layer. Together they're defense-in-depth. (`20260619180000_rate_limit_counters_explicit_deny.sql:15-30`.)
- If a future migration accidentally grants a privilege, the deny policy still says false. The comment in the migration is explicit: "only `consume_rate_limit` SECURITY DEFINER RPC and service_role access this table."
- Without RLS enabled, REVOKE alone is sufficient — but RLS enables a migration to add a future "allow admin to read counters" policy cleanly, without re-enabling RLS.
- It's a small cost (RLS evaluation per query) for a documentation benefit.

**Anti-answers.**

- "RLS is enabled so admins can query counters" — false; admins bypass RLS via service_role.

**Follow-ups.**

1. What happens if you remove the deny policy but keep REVOKE?
2. What's the planner overhead of RLS evaluation when the predicate is `false`?

**Tags.** rls, rate-limit, deny, defense-in-depth

---

### 2.10 — Testing RLS in CI

> **Medium / Database-engineer / 5 min**

**Question.** Open `src/tests/rls.integration.test.ts`. The RLS integration tests run against a dedicated CI Supabase project, gated on `E2E_SUPABASE_*` and `E2E_USER_*` env vars. What do they verify, and what would a failure tell you?

**Why this matters.** RLS is hard to unit-test; the integration tests are the safety net.

**Expected answer.**

- The tests assert: cross-user isolation on `cigarette_logs`, `record_audit_event` revoke for `authenticated`, `audit_events` SELECT visibility, `error_events` INSERT blocked for `compliance.delete`, CHECK constraint enforcement (H1 layer 3), SELECT returns 0 `compliance.delete` rows, DELETE on `error_events` returns 0 rows, `get_daily_summary` ordering + 366-day cap + `p_to < p_from` rejection, `v_daily_summary_user` RLS respect under direct filter.
- A failure tells you either: (a) a migration accidentally granted a privilege, (b) a SECURITY DEFINER function has unsafe `search_path`, (c) a view was created without `security_invoker`, (d) a policy was dropped without replacement.
- These tests are deliberately separate from the unit tests in `npm test` (Jest) because they require a live database. The CI project is a separate free-tier Supabase instance.

**Anti-answers.**

- "RLS can be unit-tested with mocks" — partially; mocks don't catch migration drift or privilege grants.
- "If unit tests pass, RLS is fine" — false; RLS failures are silent at the unit-test level.

**Follow-ups.**

1. How would you add a test for a new RLS policy?
2. What's the cost of running RLS tests in CI?

**Tags.** rls, testing, integration, ci

---

## Section 3 — SECURITY DEFINER RPCs

A `SECURITY DEFINER` function runs with the privileges of its owner, not its caller. This is the right tool when a function needs to write to a table the caller can't write to (audit, rate limit counters) or read from a table the caller can't read from (seed catalogs). It's the wrong tool when it can be avoided — SECURITY DEFINER expands the attack surface (search-path hijack, privilege escalation through owned tables).

This codebase has ~15 SECURITY DEFINER functions. They all share two hardening choices: `SET search_path = ''` and fully qualified identifiers. Both are non-negotiable. They turn a class of attack ("create a table in a writable schema, get the SECURITY DEFINER function to read/write it") into a runtime error.

The EXECUTE grant matrix is the second non-obvious piece. Some functions are granted to `authenticated` (the signed-in API: `create_log_with_rate_limit`, `list_logs_page`, `get_daily_summary`, `erase_account_data`, `export_account_data`, `get_random_facts`, `mark_fact_seen`, `sync_default_brand_catalog`, `refresh_seed_prices_from_catalog`, `seed_default_brands_if_empty`, `get_health_milestones`). Some are service-role only (`record_audit_event`, `consume_rate_limit`, `handle_new_user` trigger). The lockdown migration in `20260531075255_lockdown_secdef_execute.sql` made this explicit.

### 3.1 — `SET search_path = ''` and fully qualified names

> **Medium / Database-engineer / 5 min**

**Question.** Open `supabase/migrations/20260520000000_security_correctness.sql:307-340`. Every SECURITY DEFINER function in this migration is created with `SET search_path = ''` and references tables as `public.x`, `smoke_seed.y`. Walk through the attack this prevents.

**Why this matters.** Search-path hijack is the most-cited attack on SECURITY DEFINER. The hardening here is the textbook fix.

**Expected answer.**

- Without `SET search_path = ''`, the SECURITY DEFINER function resolves `tablename` against `search_path`, which is `pg_catalog, public` by default — but a superuser or attacker who can create tables in `public` (or another early schema on the path) can shadow system or app tables.
- An attacker who can `CREATE TABLE public.brands (... )` shadows the real `public.brands`; the SECURITY DEFINER function runs `DELETE FROM brands` and deletes the attacker's row, not the real data.
- With `SET search_path = ''`, the function has no schemas on its path. All references must be fully qualified: `DELETE FROM public.brands`. There is no table to shadow — the empty path means `public.brands` is unambiguous.
- This is `IMMUTABLE` for the search path itself — no caller can `SET search_path` to override it within the function.

**Anti-answers.**

- "Use `SET search_path = pg_catalog, public`" — that's the default and is what the attack exploits; pinning to `''` is the fix.
- "Just use schemas carefully" — schemas don't help if the path is still mutable; `''` removes the resolution ambiguity.

**Follow-ups.**

1. What does the function do if it references an unqualified `audit_events`?
2. Is `SET search_path = ''` enough, or do you also need `REVOKE` on `public`?

**Tags.** security-definer, search-path, hardening

---

### 3.2 — The EXECUTE grant matrix

> **Medium / Database-engineer / 5 min**

**Question.** Open `supabase/migrations/20260531075255_lockdown_secdef_execute.sql:1-30`. Categorize every SECURITY DEFINER function by who can call it. What is the principle behind the split?

**Why this matters.** Grant hygiene is the second half of SECURITY DEFINER safety. Hardened functions with over-broad grants are still vulnerable.

**Expected answer.**

- **Authenticated-callable** (the signed-in API): `create_log_with_rate_limit`, `list_logs_page`, `get_daily_summary`, `erase_account_data`, `export_account_data`, `get_random_facts`, `mark_fact_seen`, `sync_default_brand_catalog`, `refresh_seed_prices_from_catalog`, `seed_default_brands_if_empty`, `get_health_milestones`. Each does one thing for the calling user, validated with `auth.uid()`.
- **Service-role only**: `record_audit_event`, `consume_rate_limit`, `_redact_audit_props`. The first writes audit (which has INSERT closed to authenticated); the second writes rate-limit counters (which are locked); the third is an internal helper called by `record_audit_event`.
- **Trigger-only**: `handle_new_user`, `enforce_profile_identity_rules`. These don't take parameters; they're invoked by triggers on `auth.users` / `user_profiles` and shouldn't be callable directly.
- **Server-only seed wrappers**: `apply_default_brands`, `sync_catalog_for_user`, `refresh_seed_prices_from_catalog` (smoke_seed versions) — invoked by the public wrappers or by service-role.

**Anti-answers.**

- "Grant EXECUTE to PUBLIC for convenience" — that's what the migration explicitly undoes.
- "Authenticated should call `record_audit_event` directly" — no; audit writes go through the Edge Function which uses service_role.

**Follow-ups.**

1. What's the migration sequence if you accidentally granted `record_audit_event` to authenticated?
2. How would you detect an over-broad grant at PR time?

**Tags.** security-definer, grants, revoke, service-role

---

### 3.3 — `handle_new_user` is a trigger-only function

> **Easy / Database-engineer / 3 min**

**Question.** Open `supabase/migrations/20250426120000_initial_schema.sql:240-275` and `20260616181124_profile_identity_fields.sql:100-150`. The `handle_new_user()` function is `SECURITY DEFINER` and is invoked by a trigger on `auth.users`. Why is it not callable directly?

**Why this matters.** Trigger functions have a specific contract; making them callable is a foot-gun.

**Expected answer.**

- The function reads `NEW.raw_user_meta_data` from the `auth.users` insert. It doesn't take parameters — it relies on the trigger context. (`20250426120000_initial_schema.sql:240-260`.)
- It creates a `user_profiles` row, seeds 5 default brands, normalizes gender, fails closed on malformed DOB, hard-blocks under-18 (raises `23514`).
- If callable, a malicious client could invoke it with arbitrary `raw_user_meta_data` and create a profile row for an existing user — bypassing the signup flow entirely.
- The trigger-only nature is enforced by the grant: `REVOKE EXECUTE ON FUNCTION handle_new_user FROM PUBLIC, anon, authenticated` was applied in `20260531075255_lockdown_secdef_execute.sql`. Only the trigger (running as `auth.users` table owner) can invoke it.

**Anti-answers.**

- "It's safer because it's a trigger" — it's safer because the trigger is the only caller; the grant enforces it.

**Follow-ups.**

1. What error does a client get if they try to call `handle_new_user()` directly?
2. What happens if a `raw_user_meta_data` field is missing?

**Tags.** security-definer, trigger, handle-new-user, signup

---

### 3.4 — `consume_rate_limit` is atomic and TOCTOU-safe

> **Hard / Database-engineer / 8 min**

**Question.** Open `supabase/migrations/20260523092236_add_rate_limit_counters.sql:30-80`. The `consume_rate_limit` RPC uses a single-statement upsert `INSERT … ON CONFLICT (kind, identity) DO UPDATE SET …`. Why is the single-statement form critical?

**Why this matters.** TOCTOU (time-of-check-to-time-of-use) bugs in rate limiters are textbook. The single-statement upsert is the textbook fix.

**Expected answer.**

- A two-statement "SELECT count, then INSERT/UPDATE" is TOCTOU-vulnerable: two concurrent requests both read `count = 49`, both compute `50 <= max`, both insert, count becomes 51.
- The single-statement `INSERT … ON CONFLICT … DO UPDATE SET count = count + 1 … RETURNING count` is atomic in Postgres. The increment and the read happen in one statement. (`20260523092236_add_rate_limit_counters.sql:30-80`.)
- The function returns `count <= p_max`. The caller interprets `false` as "rate limited."
- The window is per-`(kind, identity)` tuple, parameterized by `p_max` and `p_window_sec`. Sliding-window logic (older buckets decay) is not implemented here — the simpler fixed-window approach is enough for the use cases.
- Fail-closed: if anything fails, the caller (`audit-record` Edge Function) returns 429.

**Anti-answers.**

- "Wrap in a transaction" — that doesn't help; the race is within a single statement, not across statements.
- "Use advisory locks" — works but is more code and slower; the upsert is the idiomatic fix.

**Follow-ups.**

1. What happens if the upsert conflicts on a row with `window_start` older than now?
2. Why does the function return boolean instead of raising?

**Tags.** security-definer, rate-limit, atomic, upsert

---

### 3.5 — `list_logs_page` is keyset-paginated

> **Medium / Both / 6 min**

**Question.** Open `supabase/migrations/20260523092053_add_list_logs_page.sql`, `20260523171527_fix_list_logs_page_date_cast.sql`. The `list_logs_page` RPC returns `{logs, nextCursorTs, nextCursorId, hasMore}`. Walk through the keyset contract.

**Why this matters.** Offset pagination breaks under load and breaks on inserts. Keyset is the right primitive.

**Expected answer.**

- Signature: `(p_user_id, p_from_date, p_to_date, p_brand_id, p_trigger_tag, p_cursor_ts, p_cursor_id, p_limit=200) → jsonb {logs, nextCursorTs, nextCursorId, hasMore}`.
- The cursor is `(ts_utc, id DESC)` — a composite that uniquely orders logs even when many share the same timestamp.
- The query is `WHERE user_id = p_user_id AND ts_utc <= p_cursor_ts AND (ts_utc, id) < (p_cursor_ts, p_cursor_id)` (keyset form). The `(ts_utc, id DESC)` index supports the comparison. (`20260531080049_scale_forward_indexes.sql:18-40`.)
- `p_user_id` is checked against `auth.uid()` — raises `forbidden` if mismatched. The caller can't query another user's logs even by passing their UUID.
- `::date` cast: the `local_date::date` filter was added in `20260523171527_fix_list_logs_page_date_cast.sql` because the original migration compared `text` to `date` and failed silently in some Postgres plans.

**Anti-answers.**

- "Use OFFSET and LIMIT" — that's the offset-pagination approach; under insert pressure, OFFSET shifts and rows are skipped or duplicated.
- "The cursor should be `id` only" — `id` alone is not stable across paginations; composite is needed.

**Follow-ups.**

1. What's the cost difference between keyset and offset at 100k rows?
2. Why is the cast `local_date::date` and not `local_date::text`?

**Tags.** security-definer, keyset, pagination, cursor

---

### 3.6 — `get_daily_summary` has a 366-day cap

> **Easy / Both / 3 min**

**Question.** Open `supabase/migrations/20260524050357_add_daily_summary.sql:23-40`. The `get_daily_summary(p_from, p_to)` RPC rejects `p_to - p_from > 366 days` and `p_to < p_from`. Why is the cap there?

**Why this matters.** Aggregates without caps are how you get OOM errors and runaway bills.

**Expected answer.**

- The function reads `v_daily_summary_user` filtered by `user_id` and `local_date BETWEEN p_from AND p_to`. Without a cap, a user could request `from='1900-01-01'` and force a full-table scan.
- The 366-day cap matches the Year view in the UI. The function is the source for that view; the cap enforces the contract.
- `p_to < p_from` rejection prevents accidental empty-window queries that would silently return empty results.
- The cap is enforced in SQL, not just in the client — even a direct DB call from the dashboard or a script hits it.

**Anti-answers.**

- "Just add LIMIT" — LIMIT applies after the predicate; the predicate scan is the cost.
- "Trust the client to send reasonable dates" — clients lie, especially after bugs.

**Follow-ups.**

1. What error is raised on `p_to - p_from > 366 days`?
2. What happens if `p_from` is `NULL`?

**Tags.** security-definer, aggregation, cap, daily-summary

---

### 3.7 — `get_random_facts` is weighted-random with recency penalty

> **Medium / Both / 6 min**

**Question.** Open `supabase/migrations/20260504000000_enhancements.sql:175-220` and `20260629000001_facts_cravings_category.sql`. The `get_random_facts(p_limit)` RPC returns facts weighted by `weight` and deprioritizes facts seen in the last 14 days. Walk through the SQL.

**Why this matters.** A "random fact" is rarely a random fact. Weighting and recency bias are the engineering decisions.

**Expected answer.**

- Facts live in `smoke_seed.smoking_facts` with `weight int NOT NULL DEFAULT 1`. Higher weight = more likely to be picked.
- The query JOINs to `user_facts_seen` and applies a 0.2× multiplier to facts seen in the last 14 days. The exact form: `CASE WHEN seen_at > now() - interval '14 days' THEN 0.2 ELSE 1 END` weighted by `fact.weight`.
- This means: a fact the user saw yesterday is 5× less likely to be picked than a fresh one.
- The 14-day window and 0.2× multiplier are tuned for the dashboard's "show me 5 facts" UX — the user sees mostly fresh content with occasional revisits.
- Limit is bounded to 1..25.

**Anti-answers.**

- "Random is random" — at small N, true random repeats content; weighting is the UX fix.
- "Track all facts ever seen" — would be a permanent blacklist; the 14-day window allows re-showing older content.

**Follow-ups.**

1. What error is raised on `p_limit > 25`?
2. What happens if a fact has `weight = 0`?

**Tags.** security-definer, randomness, weighting, facts

---

### 3.8 — When to NOT use SECURITY DEFINER

> **Medium / Database-engineer / 5 min**

**Question.** A candidate proposes adding a new SECURITY DEFINER function `compute_user_stats(p_user_id uuid)` that aggregates the calling user's logs. Walk through when SECURITY DEFINER is the right tool here, and when it's not.

**Why this matters.** SECURITY DEFINER expands attack surface; using it when not needed is a common mistake.

**Expected answer.**

- If the function reads `cigarette_logs` and the RLS policy already scopes by `user_id = (SELECT auth.uid())`, the function should be SECURITY INVOKER — RLS applies, no bypass needed. Reads work fine.
- If the function reads from `smoke_seed.smoking_facts` (which authenticated cannot SELECT directly), SECURITY DEFINER is needed — the function bypasses RLS to read the seed.
- If the function reads from `audit_events` (which authenticated can SELECT but only own rows) and the caller is allowed to see their own audit, SECURITY INVOKER is fine.
- Rule: SECURITY DEFINER is for *bypassing RLS on behalf of the caller*. If the caller already has access via RLS, INVOKER is correct.
- The trap: using DEFINER "just in case" expands the attack surface unnecessarily. The hardening (`SET search_path = ''`) helps, but every DEFINER function is one more thing to audit.

**Anti-answers.**

- "Always use DEFINER for consistency" — INVOKER is the safer default.
- "DEFINER means the function is more powerful" — yes, and that power is a liability when not needed.

**Follow-ups.**

1. How do you decide between INVOKER and DEFINER for a new function?
2. What's the migration to change an existing function from INVOKER to DEFINER (or vice versa)?

**Tags.** security-definer, invoker, decision-rule

---

## Section 4 — Audit, compliance & DPDP

This is the deepest section in the codebase. The audit and erasure flow is a textbook privacy-engineering problem: the user has a right to be forgotten, but the company has a right (and a duty) to prove that the deletion happened. The system reconciles both by separating the *evidence of deletion* from the *identity of the user*.

The audit pepper is the load-bearing primitive. `audit_events.user_id` is set to NULL on erasure; `error_events` retains a forensic `compliance.delete` row with `user_id = NULL` and a `hashed_user_id` that proves "this deletion happened" without revealing who was deleted. The pepper makes the hash irreversible without the secret; without the pepper, the hash is `sha256("user_id" || "")` — trivially brute-forceable.

The pepper is sourced from `app.audit_pepper` GUC, with a Vault fallback. The fail-closed guard (`20260629000000_erase_pepper_guard.sql`) raises P0001 if both are missing, so a freshly-linked project can't write a reversible hash. The Vault fallback (`20260706120000_erase_pepper_vault_fallback.sql`) was added because `ALTER DATABASE` is denied on Supabase hosted; the Vault is the alternate path.

The deletion flow is six-layered. The `delete-account` Edge Function is the only authorized erasure path. It verifies JWT, checks reauth (`REAUTH_WINDOW_MIN`), rate-limits per-IP and per-user, allowlists origin, writes two forensic records (one audit, one error_events with `category='compliance.delete'`), calls `erase_account_data` with the *user's* bearer token, and only on success calls `admin.deleteUser`. If erase fails, the auth row is never touched.

This is the right place for candidates to demonstrate they can read across the stack: schema (audit/error_events), RPCs (erase_account_data, record_audit_event), Edge Function (delete-account), and the operational runbook (audit-pepper-rotation).

### 4.1 — The audit pepper chain

> **Hard / Both / 10 min**

**Question.** Open `supabase/migrations/20260629000000_erase_pepper_guard.sql`, `20260706120000_erase_pepper_vault_fallback.sql`, and `supabase/functions/delete-account/index.ts:140-180`. The pepper is sourced via `COALESCE(current_setting('app.audit_pepper', true), (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'audit_pepper'))`. Walk through the chain and explain why both sources exist.

**Why this matters.** This is the most non-obvious bit of the codebase. A candidate who can explain it has read the security model carefully.

**Expected answer.**

- Primary: `current_setting('app.audit_pepper', true)` — a Postgres GUC set per database. Empty/missing → returns NULL. The `, true` makes it return NULL instead of raising.
- Fallback: `(SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'audit_pepper')` — Supabase Vault, queried at runtime. (`20260706120000_erase_pepper_vault_fallback.sql:5-25`.)
- Why both? Supabase hosted denies `ALTER DATABASE postgres SET app.audit_pepper = '...'` (the operation requires superuser, which isn't granted). Vault is the only writeable secret store in this environment.
- Why was the GUC the original design? Because the Vault was added later, and the guard migration (`20260629000000_erase_pepper_guard.sql`) was the immediate fix when the GUC was found unset on the live DB.
- The hash: `sha256(user_id || pepper)`. The pepper is concatenated as a string; the result is a hex digest.
- The fail-closed: if both sources are NULL, the function raises P0001 (`audit pepper is not configured — erase aborted to prevent reversible audit hash`).

**Anti-answers.**

- "Use the pepper directly in SQL" — the pepper never enters SQL as a parameter; it's read inside the function.
- "Vault is more secure than GUC" — both are equally secure in terms of who can read them; the difference is writeability.

**Follow-ups.**

1. What happens if the Vault secret exists but is empty string?
2. What's the rotation procedure (open `docs/runbooks/audit-pepper-rotation.md`)?

**Tags.** audit, pepper, vault, fail-closed, dpdp

---

### 4.2 — `error_events` 4-layer tamper resistance

> **Hard / Database-engineer / 10 min**

**Question.** Open `supabase/migrations/20260520000000_security_correctness.sql:200-260` and `20260619000000_error_events_compliance_check.sql`. The `error_events` table has four layers of tamper resistance for `category = 'compliance.delete'` rows. Walk through each layer and the failure mode it addresses.

**Why this matters.** Forensic data needs to be tamper-evident. The four layers are the textbook way to achieve this.

**Expected answer.**

- **Layer 1: INSERT policy** (`error_events_insert FOR INSERT TO authenticated WITH CHECK user_id = (SELECT auth.uid()) AND category <> 'compliance.delete'`). Clients can insert their own non-compliance rows; cannot insert compliance.delete rows.
- **Layer 2: No UPDATE policy, no DELETE policy.** Default-deny means clients cannot tamper with existing rows. Even if they owned the row, they can't modify it.
- **Layer 3: SELECT policy scopes to own rows.** `error_events_select FOR SELECT TO authenticated USING user_id = (SELECT auth.uid())`. Clients see their own error history, not compliance.delete rows (which have `user_id = NULL`).
- **Layer 4: CHECK constraint** `error_events_compliance_delete_null_user_check` (`20260619000000_error_events_compliance_check.sql:5-20`): `category = 'compliance.delete' ⇒ user_id IS NULL`. Service_role inserts forensic rows; the constraint enforces they're anonymized.
- The four layers fail differently: layer 1 fails if a future migration grants the wrong WITH CHECK; layer 2 fails if a future migration adds an UPDATE/DELETE policy; layer 3 fails if the SELECT policy is rewritten; layer 4 fails only if the constraint is dropped (which the migration comments explicitly warn against).
- The migration that added layer 4 (`20260619000000`) was a forward-fix — the original constraint was edited after apply and never reached the live DB. The June 2026 audit caught the gap.

**Anti-answers.**

- "Application logic prevents tampering" — application logic is the layer you don't trust; DB invariants are what survive.
- "DELETE not allowed because audit" — it's about forensic tamper resistance, not just audit.

**Follow-ups.**

1. What error is raised on a client trying to UPDATE an `error_events` row?
2. What error is raised on a client trying to INSERT a `category = 'compliance.delete'` row?

**Tags.** error-events, compliance, tamper-resistance, check-constraint

---

### 4.3 — The delete-account 6-layer security model

> **Hard / Database-engineer / 10 min**

**Question.** Open `supabase/functions/delete-account/index.ts`. The function's header comment says it has six layers of security. Walk through each layer and the failure mode it addresses.

**Why this matters.** Account deletion is the most privileged operation. Each layer guards a different attack vector.

**Expected answer.**

1. **JWT verification** through anon client (line 115) — the Edge gateway `--no-verify-jwt` is off (defense in depth). An invalid/expired token → 401.
2. **Re-auth gate**: `user.last_sign_in_at` must be within `REAUTH_WINDOW_MIN` (default 15 min). A stolen refresh token that's idle for >15 min cannot escalate to deletion. The user must re-enter their password.
3. **Per-IP rate limit** (5/10min, key = `sha256Hex(ip)`) — limits how often any one IP can attempt deletion.
4. **Per-user rate limit** (5/10min, key = `user:<id>`) — limits how often any one user can attempt deletion.
5. **Origin allowlist** via `_shared/cors.ts` — only allowed browser origins can invoke; non-browser clients (no `Origin` header) are accepted because the bearer token is the real gate.
6. **Audit trail before erase**: writes `audit_events` (`account_delete_requested`) and `error_events` (`category='compliance.delete'`, `user_id=NULL`, `hashed_user_id=sha256(userId:AUDIT_PEPPER)`). Best-effort (`try/catch` continues if it fails). The forensic evidence of the deletion request is preserved even if the deletion itself fails.
7. **Erase-then-delete ordering**: calls `erase_account_data` with the user's bearer token (so `auth.uid()` resolves). If erase fails, `admin.deleteUser` is never called. Only on erase success does `auth.admin.deleteUser(userId)` run, with CASCADE catching anything erase missed.

**Anti-answers.**

- "Just call `admin.deleteUser` directly" — that loses the audit trail and the erase pre-pass.
- "Rate limit only on IP" — per-user limit is needed to prevent credential stuffing from rotating IPs.

**Follow-ups.**

1. What error does a stolen refresh token older than 15 min get?
2. What's the audit event sequence on a successful deletion?

**Tags.** delete-account, edge-function, security, reauth, rate-limit

---

### 4.4 — The re-auth gate

> **Medium / Database-engineer / 5 min**

**Question.** Open `supabase/functions/delete-account/index.ts:60-100`. The re-auth gate checks `user.last_sign_in_at` against `REAUTH_WINDOW_MIN` (default 15 min). Why is this separate from the JWT verification?

**Why this matters.** JWT validity ≠ recent activity. A valid token can be a stolen token.

**Expected answer.**

- JWT verification (`supabase.auth.getUser`) checks signature and expiry. A refresh token can extend a session for weeks; the original JWT can be valid for an hour after issuance.
- The re-auth gate checks `last_sign_in_at` — when the user *last authenticated* (entered password or magic link). If that's >15 min ago, the session is "valid but stale."
- The window forces the user to re-enter credentials for high-stakes operations. Stolen refresh tokens that are >15 min idle cannot escalate to deletion.
- Why 15 min? Tunable via env; the default is short enough that casual use isn't blocked, long enough that legitimate "log in and delete" flows work.

**Anti-answers.**

- "JWTs can't be stolen" — they can; XSS, leak, device theft, social engineering.
- "Just rotate the refresh token" — rotation is the long-term fix; re-auth is the immediate gate.

**Follow-ups.**

1. What's the re-auth window for password reset?
2. What's the migration if you wanted to lower REAUTH_WINDOW_MIN to 5?

**Tags.** delete-account, reauth, security, session

---

### 4.5 — Export keyset pagination

> **Medium / Database-engineer / 6 min**

**Question.** Open `supabase/migrations/20260521000000_audit_export_ops.sql:140-200`. The `export_account_data` RPC is keyset-paginated via `(p_cursor_ts, p_cursor_id)`. Why is keyset used here instead of offset?

**Why this matters.** DPDP export is a contract; the implementation must scale and never skip or duplicate rows.

**Expected answer.**

- The export returns the user's complete data — could be 10k+ logs for a power user. Offset pagination at that scale is slow (the planner has to scan + skip).
- Keyset pagination uses `(ts_utc, id DESC)` as the cursor; each page is bounded and uses the index. (`20260521000000_audit_export_ops.sql:140-200`.)
- The first page includes profile, brands, goals, settings, reminders, price_entries, usage_events, audit_events, facts_seen — full snapshot. Subsequent pages return only the next log chunk + cursor metadata.
- Effective limit 100..5000; client caps at 200 pages.
- The export writes one `account_data_exported` audit event on the first page only. Repeating the audit per page would inflate the audit log.

**Anti-answers.**

- "Just dump everything" — that's the textbook mistake; pagination is required for scale.
- "Use server-side cursors" — Postgres cursors require persistent connections; keyset is stateless.

**Follow-ups.**

1. What's the cost difference at 100k logs?
2. What happens if the client requests page 201?

**Tags.** export, keyset, dpdp, pagination

---

### 4.6 — Audit retention under erasure

> **Medium / Both / 5 min**

**Question.** Open `supabase/migrations/20260521000000_audit_export_ops.sql:24-30` and `20260629000000_erase_pepper_guard.sql`. After `erase_account_data` runs, what survives in `audit_events` and `error_events`, and why?

**Why this matters.** Forensic continuity under erasure is the regulatory question. The answer is "anonymized evidence of the deletion."

**Expected answer.**

- `audit_events.user_id` is set to NULL on every row tied to the deleted user. (`20260521000000_audit_export_ops.sql:24-30`.) The row stays; the FK link is severed.
- `error_events.user_id` is set to NULL on every row tied to the deleted user. Same treatment.
- The `props_json` on the surviving audit row is replaced with `{"hashed_user_id": sha256(userId || pepper)}`. The pepper makes the hash irreversible without the secret. (`20260629000000_erase_pepper_guard.sql:10-30`.)
- A new `error_events` row is inserted by `delete-account` BEFORE the erase, with `category='compliance.delete'`, `user_id=NULL`, `details_json.hashed_user_id=sha256(userId:AUDIT_PEPPER)`. This is the forensic record of the deletion itself.
- The user, even with their auth row intact, cannot read these rows post-deletion because their `auth.uid()` no longer matches `NULL`. The audit log is anonymous to them.
- Service-role can read the rows; the pepper holder can re-attribute them; nobody else can.

**Anti-answers.**

- "Audit rows should be deleted too" — that destroys the forensic record.
- "Anonymization is enough without the pepper" — `sha256(user_id || '')` is brute-forceable from a known uid space.

**Follow-ups.**

1. What's the migration to add a new forensic event category?
2. How would you rotate the pepper without losing the link to old forensic rows?

**Tags.** audit, erasure, dpdp, retention, pepper

---

### 4.7 — What "DPDP-best-effort" means

> **Easy / Both / 3 min**

**Question.** Open `docs/legal/privacy-policy.md` and `docs/spec/00-glossary.md`. The privacy policy says "DPDP-best-effort." What does that mean in practice?

**Why this matters.** A "best-effort" claim is a specific posture. Understanding it is required for compliance review.

**Expected answer.**

- DPDP (Digital Personal Data Protection Act, 2023) is India's data-protection law. The product is pre-launch with a handful of test users; full compliance certification is not claimed.
- "Best-effort" means: the architecture supports DPDP-aligned behavior (export, erasure, consent, retention) but the operational/legal certification is not pursued yet.
- In practice: consent timestamps are stored, export works, erasure works, audit evidence is preserved anonymously. A privacy review would find these in place; a regulatory audit would require additional documentation.
- The posture is explicit in the privacy policy and the spec — not a quiet claim.

**Anti-answers.**

- "We ignore DPDP" — no, the architecture is aligned; only the formal certification is deferred.
- "We're fully compliant" — false; the "best-effort" qualifier is explicit.

**Follow-ups.**

1. What would full DPDP compliance require beyond what's there?
2. Where is the consent version stored?

**Tags.** dpdp, compliance, posture, consent

---

### 4.8 — The audit event allowlist

> **Easy / Both / 3 min**

**Question.** Open `supabase/functions/_shared/auditAllowlist.ts`. The audit event types are a closed set (15 entries). Why a closed set rather than a free string?

**Why this matters.** A closed allowlist prevents the audit log from being polluted with arbitrary event names.

**Expected answer.**

- The set is: `consent_accepted`, `consent_revoked`, `onboarding_completed`, `account_data_exported_requested`, `account_data_erased_requested`, `account_delete_requested`, `password_reset_requested`, `password_changed`, `discreet_mode_toggled`, `app_lock_enabled/disabled`, `reminder_enabled/disabled`, `phone_otp_sent/verified/rate_limited`. (`supabase/functions/_shared/auditAllowlist.ts:5-30`.)
- A free string would let any client write any event name; the audit log would become noise.
- The allowlist also constrains the `event_category` to a closed set: `account | compliance | auth | privacy | preferences`.
- Rejection: any event type not in the set → 400. The Edge Function logs the rejection in stdout but doesn't write to `audit_events` (the rejection itself isn't a meaningful audit event).

**Anti-answers.**

- "Free strings are more flexible" — they're a logging anti-pattern; closed sets enable reliable analytics on audit.

**Follow-ups.**

1. How would you add a new audit event type?
2. What's the migration if you need to rename an existing event type?

**Tags.** audit, allowlist, edge-function, event-types

---

## Section 5 — Rate limiting

The codebase has three rate-limit flavors: per-user, per-IP, and per-phone. They all share one backend: `consume_rate_limit` SECURITY DEFINER RPC against `rate_limit_counters` table. The double-lock on that table (REVOKE + RLS deny) is covered in Section 2; this section covers the rate-limit policies themselves.

The most subtle design choice: the log-write rate limit window is keyed off `created_at` (server-set) not `ts_utc` (user-supplied). Before `20260626120000_rate_limit_window_created_at.sql`, the window was off `ts_utc` — meaning a malicious client could backdate 50 logs at 23:59 and 50 at 00:01 the next day, evading the 50/hour limit. The fix is one line in the RPC, but it required understanding the threat.

The other rate limits: PIN lockout (5 attempts, 30 min) lives client-side in `expo-secure-store`; audit-record (10 events / 60s) is in the Edge Function; send-sms-otp (3/10min per phone) is in the SMS Edge Function. All fail-closed.

### 5.1 — The `created_at` window choice

> **Hard / Database-engineer / 8 min**

**Question.** Open `supabase/migrations/20260626120000_rate_limit_window_created_at.sql`. The `create_log_with_rate_limit` RPC counts its window off `created_at` (server-set) rather than `ts_utc` (user-supplied). Walk through the attack the migration prevents.

**Why this matters.** Time-of-event vs time-of-write is a fundamental decision. Getting it wrong lets users bypass rate limits.

**Expected answer.**

- `ts_utc` is user-supplied (Zod-validated, but the value comes from the client). A malicious client could backdate 50 logs at 23:59 yesterday and 50 at 00:01 today, getting 100/hour through a 50/hour limit.
- `created_at` is `DEFAULT now()` — server-set at insert. The user cannot influence it (except by submitting faster, which the limit is designed to throttle).
- The window query: `SELECT count(*) FROM cigarette_logs WHERE user_id = p_user_id AND created_at > now() - interval '1 hour'`. (`20260626120000_rate_limit_window_created_at.sql:5-15`.)
- The 24-hour backdate cap (Zod `MAX_BACKDATE_MS`) is defense-in-depth — even if the rate-limit window were wrong, backdating is bounded.

**Anti-answers.**

- "Just trust `ts_utc`" — `ts_utc` is user-supplied; trust is the wrong model.
- "Use a sliding window" — fixed-window is simpler and sufficient; sliding is a future migration.

**Follow-ups.**

1. What happens if a user inserts a log at 23:59:30 — is it in the same window as one at 00:00:30?
2. Why was the original implementation off `ts_utc`?

**Tags.** rate-limit, created-at, backdating, evasion

---

### 5.2 — `consume_rate_limit` is the atomic primitive

> **Medium / Database-engineer / 5 min**

**Question.** Open `supabase/migrations/20260523092236_add_rate_limit_counters.sql:30-80`. The `consume_rate_limit(p_kind, p_key, p_max, p_window_sec)` returns boolean. Walk through the contract and a TOCTOU scenario it prevents.

**Why this matters.** The single-statement upsert is the textbook fix for race conditions in counters.

**Expected answer.**

- Signature: `(p_kind text, p_key text, p_max int, p_window_sec int) → boolean`. True = allowed; false = rate-limited.
- The body is one statement: `INSERT INTO rate_limit_counters(kind, identity, window_start, count) VALUES (...) ON CONFLICT (kind, identity) DO UPDATE SET count = rate_limit_counters.count + 1, window_start = CASE WHEN rate_limit_counters.window_start < now() - interval '1 second' * p_window_sec THEN now() ELSE rate_limit_counters.window_start END RETURNING count <= p_max`. (`20260523092236_add_rate_limit_counters.sql:30-80`.)
- The window_start advances only when the existing window has expired (sliding-ish, not strictly sliding). Within the window, count increments.
- TOCTOU prevention: the INSERT/UPDATE is atomic. Two concurrent calls cannot both see count=49 and both decide to increment.

**Anti-answers.**

- "Wrap in BEGIN/COMMIT" — that doesn't fix per-statement races; the upsert is the fix.
- "Use SERIALIZABLE" — works but is more invasive; the upsert is targeted.

**Follow-ups.**

1. What happens if `p_max` is 0?
2. What happens if the same `(kind, key)` is used by two different rate-limit policies?

**Tags.** rate-limit, atomic, upsert, toctou

---

### 5.3 — Per-IP rate limit on `delete-account`

> **Easy / Database-engineer / 3 min**

**Question.** Open `supabase/functions/delete-account/index.ts:80-110`. The function rate-limits per-IP (`sha256Hex(ip)`) and per-user (`user:<id>`). Why both?

**Why this matters.** Per-IP alone is insufficient against distributed credential stuffing; per-user alone is insufficient against a single-IP attacker.

**Expected answer.**

- Per-IP limit (5/10min) prevents a single attacker from spamming deletion attempts across many users. The hash of the IP makes the key non-reversible in logs.
- Per-user limit (5/10min) prevents a single user's account from being used to spam deletion requests (e.g., via a stolen token). The user can't be locked out from legitimate use within the window.
- Together: an attacker with a stolen token can't spam (per-user), and an attacker rotating IPs can't spam (per-IP).
- The keys are independent; a request consumes from both buckets.

**Anti-answers.**

- "Per-IP is enough" — credential stuffing rotates IPs.
- "Per-user is enough" — doesn't constrain a single attacker IP.

**Follow-ups.**

1. What's the env var to tune these limits?
2. What happens if both buckets say false?

**Tags.** rate-limit, edge-function, delete-account, ip

---

### 5.4 — PIN lockout is client-side

> **Medium / Both / 5 min**

**Question.** Open `src/lib/secureStore.ts` and search for `MAX_PIN_ATTEMPTS`. The PIN lockout (5 attempts → 30 min) is implemented in `expo-secure-store`, not in Postgres. Why?

**Why this matters.** Not every rate limit needs to be server-side. Local storage is sometimes the right tool.

**Expected answer.**

- The PIN guards the local app — preventing casual access if the phone is left unlocked. It's a UX lockout, not a security lockout (server-side auth still works).
- `expo-secure-store` is encrypted on the device. The attempt counter and lockout timestamp are stored there.
- Server-side rate limit would require a round-trip per PIN attempt; client-side is faster and works offline.
- The trade-off: a sophisticated attacker with root on the device could reset the counter. The PIN is not security boundary; the server-side auth is.
- Constants: `MAX_PIN_ATTEMPTS = 5`, `PIN_LOCKOUT_MS = 30 * 60 * 1000`.

**Anti-answers.**

- "Server-side is always more secure" — for a UX lockout, client-side is appropriate.
- "Local storage can be bypassed" — yes; that's why PIN is not the security boundary.

**Follow-ups.**

1. What happens on a fresh install of the app?
2. What happens if the user signs out and signs back in?

**Tags.** pin, lockout, client-side, secure-store

---

### 5.5 — Audit-record rate limit (10/60s)

> **Easy / Database-engineer / 3 min**

**Question.** Open `supabase/functions/audit-record/index.ts`. The Edge Function rate-limits via `consume_rate_limit({kind: 'audit-record', key: 'user:<id>'})` with default 10/60s. Why is the limit lower than the log-write limit?

**Why this matters.** Audit events are sensitive; their rate limit should reflect that.

**Expected answer.**

- 10 audit events / 60s per user is a much tighter limit than 50 logs / hour. (`supabase/functions/audit-record/index.ts:50-90`.)
- Audit events are consent changes, password changes, mode toggles — actions a user does occasionally, not constantly.
- A high rate of audit events from one user suggests either a bug or abuse.
- The limit is env-tunable: `AUDIT_RATE_LIMIT_MAX` and `AUDIT_RATE_LIMIT_WINDOW_SEC`. Default 10/60s; can be tightened.

**Anti-answers.**

- "Same limit as logs" — logs are high-frequency; audit is low-frequency.

**Follow-ups.**

1. What error does a user get if they hit the audit-record limit?
2. What's the env var to tighten the limit?

**Tags.** rate-limit, audit-record, edge-function

---

### 5.6 — `canSeed()` is a test-only gate

> **Medium / Database-engineer / 5 min**

**Question.** Open `src/tests/perf.integration.test.ts` and search for `canSeed()`. The local perf tests seed large volumes into a local Supabase. What is the gate, and why is it local-only?

**Why this matters.** A test that seeds 10k rows is dangerous if accidentally run against prod.

**Expected answer.**

- The gate checks the URL is `127.0.0.1` / `localhost` / `0.0.0.0`. Any other host → test refuses to seed.
- This is the difference between `npm run test:perf` (allowed) and a CI matrix run against a real project (refused).
- The seed creates a user, inserts logs/goals, runs the query under test, then tears down.
- Without this gate, a developer running `npm test` against a dev branch that points at a real project would pollute the DB.

**Anti-answers.**

- "Use env vars" — env vars are mutable; URL check is harder to fake.
- "Skip the test in CI" — CI runs them on a local Supabase instance.

**Follow-ups.**

1. What's the URL pattern that triggers the gate?
2. How does the teardown run?

**Tags.** rate-limit, test, canSeed, perf

---

## Section 6 — Idempotency & backdating

Mobile networks are flaky. A log write that succeeds server-side but fails to deliver the response leaves the user wondering whether to retry. Retrying without idempotency creates duplicates. The codebase solves this with a client-generated `client_op_id` and a partial unique index in Postgres.

The backdate cap is the other half. A user who smoked a cigarette an hour ago wants to log it; a user who wants to log a cigarette from last week is gaming the rate limit. The cap is 24 hours, enforced in Zod (`MAX_BACKDATE_MS`) on the client.

These two mechanisms interact: the rate-limit window is keyed off `created_at` (server-set), not `ts_utc` (user-supplied). So even with a 24h backdate, the rate limit is robust.

### 6.1 — Why client-side `client_op_id`?

> **Medium / Database-engineer / 5 min**

**Question.** Open `src/lib/id.ts` and `src/db/repositories/logs.ts`. The `client_op_id` is generated client-side via `makeId('op')` and sent with every log write. Why client-side, not server-generated?

**Why this matters.** Idempotency keys must be generated before the network call to be useful for retries.

**Expected answer.**

- A server-generated ID requires a round-trip before the write. If the network drops after the write, the client doesn't have the ID to retry.
- A client-generated ID is created at the moment of "user taps save," before any network call. The same ID is sent on every retry attempt.
- The format: `${prefix}_${ts36}${rnd36}` — base-36 timestamp + random suffix. Not cryptographically strong; fine for collision avoidance within a user's session.
- The collision space is large enough (timestamp + ~52 bits of randomness) that a duplicate within a user's session is implausible.
- The partial unique index `uq_logs_user_client_op (user_id, client_op_id) WHERE client_op_id IS NOT NULL` (`20260520000000_security_correctness.sql:60-100`) enforces uniqueness when present; NULL rows (legacy data) are not constrained.

**Anti-answers.**

- "Use UUIDs" — the codebase uses base-36 timestamps for compactness; UUIDs would also work but are larger.
- "Server-generated is more secure" — for idempotency, generation time matters more than cryptographic strength.

**Follow-ups.**

1. What happens if two devices generate the same `client_op_id` for the same user?
2. What's the migration to retire `client_op_id`?

**Tags.** idempotency, client-op-id, retries

---

### 6.2 — The 24-hour backdate cap

> **Medium / Database-engineer / 5 min**

**Question.** Open `src/lib/validation.ts` and search for `MAX_BACKDATE_MS`. The `CigaretteLogSchema` has a `.superRefine(backdateCap)` that rejects `ts_utc` more than 24h in the past. Walk through the cap and why it's Zod-side, not SQL-side.

**Why this matters.** Input validation lives at trust boundaries; the client is one.

**Expected answer.**

- `MAX_BACKDATE_MS = 24 * 60 * 60 * 1000` is exported from `validation.ts`. (`src/lib/validation.ts`.)
- `backdateCap` is a `.superRefine` on `CigaretteLogSchema` that checks `now() - ts_utc < MAX_BACKDATE_MS`. The cap is composed so patch/import variants can include it via `.superRefine(backdateCap)` while preserving `.partial()` / `.extend()`.
- Why client-side? The server has no notion of "the user's intent" — a `ts_utc` from yesterday is just a timestamp. The cap is a UX policy: the user can correct yesterday's log but not last week's.
- Why not SQL-side? The server doesn't have a clock reference for "right now" tied to the user's intent (they could be on a different timezone). Zod-side uses the device clock; SQL-side would use server time, leading to drift.
- The repository's `createLog` re-validates via `parseOrThrow(schema, draft)` — defense-in-depth behind the UI.

**Anti-answers.**

- "Server-side is more secure" — server-side would be wrong here because the policy is about user intent, not data integrity.
- "24h is too short" — too long and the rate-limit window can be evaded (see Section 5.1).

**Follow-ups.**

1. What's the error if `ts_utc` is 25h in the past?
2. What's the cap for `goals.start_date`?

**Tags.** backdate, validation, zod, max-backdate

---

### 6.3 — Idempotent retry short-circuit

> **Hard / Both / 8 min**

**Question.** Open `supabase/migrations/20260520000000_security_correctness.sql:60-100`. The `create_log_with_rate_limit` RPC short-circuits on a duplicate `(user_id, client_op_id)`. Walk through the retry flow and what the short-circuit returns.

**Why this matters.** Idempotency is a contract; the implementation must be precise.

**Expected answer.**

- The RPC first does `SELECT … WHERE user_id = p_user_id AND client_op_id = p_client_op_id`. If a row exists, return it. (`20260520000000_security_correctness.sql:60-100`.)
- If not, INSERT the new log, run the rate-limit counter, write the brand_variants running-mean update, return the new row.
- Both paths return a single `cigarette_logs` row with the same shape. The client doesn't know whether it was a retry or a fresh write — and shouldn't care.
- The partial unique index is the safety net: if the SELECT misses (race), the INSERT fails with `23505` and the client can re-SELECT to recover the row.
- The rate-limit counter is *not* incremented on a short-circuit. A retry doesn't count as a new write.

**Anti-answers.**

- "Just retry the INSERT" — without the short-circuit, duplicates accumulate.
- "Throw on duplicate" — that forces the client to handle errors; idempotent return is better UX.

**Follow-ups.**

1. What's the migration sequence if the short-circuit path is buggy?
2. What's the behavior on partial unique index violation?

**Tags.** idempotency, short-circuit, retry, race

---

### 6.4 — `local_date` derived from `ts_utc` if missing

> **Easy / Both / 3 min**

**Question.** Open `src/db/repositories/logs.ts` and search for `localDate`/`localHour`. The `createLog` repository derives `localDate` and `localHour` from `tsUtc` if missing. Why?

**Why this matters.** A column that can be derived shouldn't be supplied independently — supply invites inconsistency.

**Expected answer.**

- `local_date` and `local_hour` are the IST storage columns for the log. They're denormalized for index-friendliness (`(user_id, local_date)` is the composite key for daily aggregations).
- If the client supplies them, they could be inconsistent with `ts_utc` (wrong timezone, wrong day boundary). The repository derives them from `ts_utc` to ensure consistency.
- The derivation uses `toLocalDate(tsUtc)` and `toLocalHour(tsUtc)` in `src/lib/date.ts` — the IST math is centralized.
- The client can pass them as a hint (e.g., when displaying a date picker), but the server is the source of truth.

**Anti-answers.**

- "Client knows best" — the client can be wrong (timezone, DST); the server math is canonical.
- "Just store UTC" — UTC loses the user's calendar day, which is the unit of aggregation.

**Follow-ups.**

1. What happens if the client passes `local_date` that disagrees with `ts_utc`?
2. Why is `local_hour` int 0..23?

**Tags.** local-date, ist, derivation, denormalization

---

### 6.5 — Why partial unique index on `(user_id, client_op_id)`

> **Medium / Database-engineer / 5 min**

**Question.** Open `supabase/migrations/20260520000000_security_correctness.sql:60-100`. The index is `WHERE client_op_id IS NOT NULL`. Walk through why partial, not full.

**Why this matters.** Partial indexes are a precise tool; understanding why they're used is understanding the data shape.

**Expected answer.**

- `client_op_id` is nullable. Logs written before the column existed have NULL; logs written after have a value.
- A full unique index `(user_id, client_op_id)` would have to include NULL rows. In Postgres, NULLs are *distinct* in unique indexes — so a full index would not actually enforce uniqueness on NULLs (any number of NULL rows are allowed).
- The partial form (`WHERE client_op_id IS NOT NULL`) makes the intent explicit: only enforce uniqueness when the client provided an ID. NULL rows are unconstrained.
- Index size is smaller (no NULL rows), and queries that don't filter on `client_op_id` don't have to consult it.
- The behavior is identical for rows with non-NULL `client_op_id`: unique per `(user_id, client_op_id)` is enforced.

**Anti-answers.**

- "Partial is faster" — partially true (smaller index, fewer comparisons), but the main reason is intent.
- "NULL is a valid value" — it is; the partial index lets NULL mean "legacy data" while non-NULL means "client-supplied idempotency key."

**Follow-ups.**

1. What error is raised on duplicate `(user_id, client_op_id)`?
2. What's the migration to add a NOT NULL constraint?

**Tags.** partial-index, unique, client-op-id, null-handling

---

### 6.6 — Idempotency in the export flow

> **Medium / Database-engineer / 5 min**

**Question.** Open `supabase/migrations/20260521000000_audit_export_ops.sql:140-200`. The `export_account_data` writes an `account_data_exported` audit event on the first page only. Why once, not per page?

**Why this matters.** Audit log volume matters; redundant events pollute analysis.

**Expected answer.**

- A paginated export could span 200 pages. One audit event per page would inflate the audit log by 200× for a single export action.
- The first-page check: the function takes a `p_is_first_page` flag (or detects via cursor=NULL). On first page only, write the audit event. (`20260521000000_audit_export_ops.sql:140-200`.)
- Subsequent pages are pure log chunks; no audit, no profile re-send.
- The first page includes the full snapshot (profile, brands, goals, etc.); subsequent pages are just logs + cursor.

**Anti-answers.**

- "Per page for forensic completeness" — that's the textbook mistake; one logical action is one audit event.
- "Use a separate `account_data_exported_chunk` event" — unnecessary granularity.

**Follow-ups.**

1. What's the migration to log per-page?
2. What's the env var to disable audit on first page?

**Tags.** export, audit, pagination, dedup

---

## Section 7 — Aggregations & KPI definitions

The analytics half of the system is intentionally pure TypeScript on top of a small server-side pre-aggregation. There are no materialized views; there is one regular Postgres view (`v_daily_summary_user`). The view is consumed by `get_daily_summary` RPC, which feeds `periodSummary.ts` — the single source of truth for dashboard and Trends totals.

This architecture has a specific consequence: when the Year view disagrees with the Day/Week/Month view, the bug is in `periodSummary.ts`, not in the view. The codebase explicitly calls this out — there's a comment in `periodSummary.ts` saying "SINGLE SOURCE OF TRUTH for dashboard + Trends totals across the rolling daily / weekly / monthly / yearly windows."

The savings model is the most subtle part. There are two: `potentialSavings` (sticks avoided × avg unit price) and `actualSavings` (expected daily spend − actual). The actual model has a `rawDeltaInr` that keeps signs and a `displayInr` clamped to 0 — because seeing "−₹200" in the dashboard would confuse users who don't read the negative as "saved."

The insights engine is rules-based, deterministic, and explains every insight with evidence. No AI, no ML — just thresholds and conditions.

### 7.1 — `v_daily_summary_user` is a regular view

> **Medium / Both / 5 min**

**Question.** Open `supabase/migrations/20260524050357_add_daily_summary.sql:1-60` and `20260621000000_daily_summary_sum_quantity.sql`. The view computes `sticks = SUM(quantity)`. Walk through the original bug the second migration fixed.

**Why this matters.** A real bug in production is the best kind of lesson.

**Expected answer.**

- The original view computed `sticks = COUNT(*)` — counting rows, not summing quantity. (`20260524050357_add_daily_summary.sql:23-40`.)
- A user who logs "1 pack of 20 cigarettes" would have 1 row, contributing 1 stick to the count instead of 20.
- The fix in `20260621000000_daily_summary_sum_quantity.sql` changes to `SUM(quantity)`, restoring the expected semantics.
- The view is `SECURITY INVOKER` (set in `20260602000000_perf_rls_initplan_indexes.sql:57-60`); originally it was SECURITY DEFINER, which bypassed RLS — a separate, worse bug that leaked cross-user aggregates.
- The composite index `(user_id, ts_utc DESC)` (`20260531080049_scale_forward_indexes.sql:18-40`) supports the GROUP BY scan.

**Anti-answers.**

- "COUNT(*) is faster than SUM(quantity)" — true, but wrong; the semantic is the issue.
- "Use materialized view for performance" — see Section 1.10; the trade-off is RLS inheritance.

**Follow-ups.**

1. What other columns are in the view?
2. What's the cost of the GROUP BY at 100k rows?

**Tags.** aggregation, daily-summary, sum, view

---

### 7.2 — `periodSummary.ts` is the single source of truth

> **Hard / Both / 10 min**

**Question.** Open `src/domain/periodSummary.ts`. The file's header comment says "SINGLE SOURCE OF TRUTH for dashboard + Trends totals." Walk through the four windows (Day, Week, Month, Year) and explain why this centralization matters.

**Why this matters.** Reconciliation across windows is the analytics correctness question. A single function that computes all four is the right tool.

**Expected answer.**

- The four windows are: Day (1 day), Week (7 days, Monday-start), Month (calendar month), Year (366-day cap from RPC).
- `totalsForWindow(rows, windowDays, endYmd)` — sums sticks + spend over a trailing window. (`src/domain/periodSummary.ts:80-120`.)
- `periodWithTrend(rows, windowDays, endYmd)` — current window + previous window + delta% for both sticks and spend.
- `savedForWindow`, `savedAllTime` — money not spent vs baseline, preferring day's own avg unit price, falling back to global.
- `streakFromRows(rows, endYmd, maxLookback=365)` — smoke-free days ending at endYmd; anchored at earliest row to avoid unbounded streak on fresh accounts.
- The centralization matters because every UI view (dashboard, Trends) routes through these functions. If Year shows 5,000 sticks and Day+Week+Month shows 4,500, the bug is here, not in the view.
- The view itself is dumb data; the period logic is in TypeScript.

**Anti-answers.**

- "Compute each window independently" — that's the bug surface; centralization is the fix.
- "Do it in SQL" — possible, but the rolling-window + trend logic is easier in TS; the SQL is the pre-aggregation.

**Follow-ups.**

1. Why is the streak anchored at the earliest row?
2. What's the migration if you wanted to add a new window (e.g., Quarter)?

**Tags.** aggregation, period-summary, single-source-of-truth, kpi

---

### 7.3 — Savings: potential vs actual

> **Hard / Both / 10 min**

**Question.** Open `src/domain/savings.ts`. The codebase has two savings models: `potentialSavings` and `actualSavings`. Walk through the formula for each and the UX rationale.

**Why this matters.** Two savings models are a UX and analytics choice. Understanding both is required to read the dashboard.

**Expected answer.**

- `potentialSavings(input)`: `Σ max(0, baseline - actual_sticks) × avgUnitPrice` over days. Returns `{totalInr, sticksAvoided, avgUnitPriceUsed, days}`. (`src/domain/savings.ts`.)
- `actualSavings(input)`: `Σ (expectedSpendPerDay - actualSpend)`. Returns `{rawDeltaInr, displayInr, days}`. `rawDeltaInr` keeps signs (can be negative if user spent *more* than baseline); `displayInr` clamps to 0 (the dashboard shows "you saved ₹X" — never "you lost ₹X").
- The baseline is `deriveBaselinePerDay(logs, windowDays=30, anchor='yesterday')` — a 30-day rolling average ending *yesterday* so today doesn't drag the baseline down.
- UX rationale: a user sees "potential" as "what you could save if you matched yesterday" and "actual" as "what you actually saved vs your baseline." Two different framings of the same underlying concept.
- The `displayInr` clamp is a deliberate UX choice; it means the dashboard never shows a negative savings number.

**Anti-answers.**

- "Savings is just `actualSpend × period`" — that's spend, not savings; savings requires a baseline.
- "Always show negative numbers" — that's the analytical truth but bad UX; the codebase chose to hide the negative.

**Follow-ups.**

1. What happens on day 1 (no baseline)?
2. What's the migration to add a "spend reduction" insight?

**Tags.** savings, baseline, kpi, potential-vs-actual

---

### 7.4 — The insights 5-rule engine

> **Hard / Both / 10 min**

**Question.** Open `src/domain/insights.ts`. The `generateInsights(logs, today)` function emits insights from 5 deterministic rules. Walk through each rule and the bootstrap gate.

**Why this matters.** Rules-based insights are how analytics products ship without ML. The 5 rules encode domain knowledge.

**Expected answer.**

- **Bootstrap gate**: if `logs.length < 3`, return a single "log a few entries" placeholder. The gate prevents premature insights from sparse data. (`src/domain/insights.ts:1-30`.)
- **Time-of-day dominance**: peak hour ±1h window holds ≥ 25% of sticks.
- **Trigger concentration**: top trigger tag ≥ 30% of ≥ 5 tagged logs.
- **Reduction trend**: 7-day avg vs prior 30; emit when `deltaPct ≤ -10%` (down) or `≥ +15%` (up).
- **Brand concentration**: top brand ≥ 40% of monthly spend.
- **Day-of-week dominance**: single day ≥ 22% of sticks (≥ 7 total).
- Each insight has `{title, explanation, evidence, confidence, severity, generatedAt}` — the `evidence` is a structured reference to the data point that triggered it, not just a number.
- Determinism: same input → same output. No ML, no randomness.

**Anti-answers.**

- "ML would be better" — for 5 rules, ML is overkill; rules are auditable and explainable.
- "Higher thresholds are more accurate" — higher thresholds = fewer false positives but more false negatives; the thresholds are tuned for the user base.

**Follow-ups.**

1. What's the migration to add a new rule?
2. How are insights persisted (if at all)?

**Tags.** insights, rules-engine, deterministic, kpi

---

### 7.5 — Streak anchoring at the earliest log

> **Medium / Both / 5 min**

**Question.** Open `src/domain/calc.ts` and `src/domain/periodSummary.ts`. Both `smokeFreeStreak` and `streakFromRows` anchor at the earliest logged day. Why?

**Why this matters.** Streaks without an anchor are unbounded — and unbounded means lying to users on fresh accounts.

**Expected answer.**

- A naive streak counts consecutive zero-stick days ending today. For a fresh account with 0 logs, the count is infinite.
- The anchor: `streak` looks back from `endYmd` but stops at `earliest log date - 1`. Beyond that, the count is unknown; the function returns whatever it has, not infinity.
- This means: a user who signs up today and never logs has a 0-day streak, not an "infinity-day smoke-free streak!"
- The `maxLookback = 365` is a secondary bound to prevent pathological cases (e.g., a long-dormant account reactivating).

**Anti-answers.**

- "Always count from the user's birth date" — irrelevant; the streak is about logged behavior.
- "Cap at 30 days" — arbitrary; the anchor is principled.

**Follow-ups.**

1. What does `streakFromRows` return for an empty account?
2. What's the migration if you wanted to support cross-device streaks?

**Tags.** streak, anchoring, smoke-free, edge-case

---

### 7.6 — `no_smoke_window` handles overnight wrap

> **Medium / Both / 5 min**

**Question.** Open `src/domain/goals.ts`. The `no_smoke_window` goal type stores `startHour`/`endHour` in `meta` and the predicate handles `start >= end` (e.g., 22:00–06:00). Walk through the wrap logic.

**Why this matters.** Time-window logic with wrap is a common bug. The handling here is precise.

**Expected answer.**

- A naive predicate: `hour >= start && hour < end`. Fails when `start = 22, end = 6` — no hour matches.
- Wrap handling: `hour >= start OR hour < end`. (`src/domain/goals.ts`.)
- The check: if `start < end`, normal range; if `start >= end`, wrap. The function does both correctly.
- The `targetValue` for this goal is `1` (an inert positive value; the actual "target" is implicit in the meta). `GoalSchema` requires `targetValue > 0`; the value carries no semantic weight for this goal type.

**Anti-answers.**

- "Store as two ranges" — over-engineering; one range with wrap is correct.
- "Use 24-hour format with explicit wrap" — that's the storage choice, the predicate is the runtime.

**Follow-ups.**

1. What happens for a goal with `start = end` (full-day window)?
2. How is `meta_json` validated?

**Tags.** goals, no-smoke-window, overnight, wrap

---

### 7.7 — Forecast formula

> **Medium / Both / 5 min**

**Question.** Open `src/domain/calc.ts`. The `forecastMonthlySpend(logs, today)` function returns `elapsedSpend / daysElapsed * daysInMonth`. Walk through the formula and its assumptions.

**Why this matters.** Forecasts are linear extrapolations; understanding their assumptions prevents misuse.

**Expected answer.**

- The formula: `elapsedSpend / daysElapsed * daysInMonth`. Linear extrapolation. (`src/domain/calc.ts`.)
- Assumption: the rate of spending so far this month continues for the rest of the month.
- Reality: spending is rarely linear — weekends differ from weekdays, paydays spike, etc. The forecast is a sanity estimate, not a prediction.
- The function takes `today` so it can compute `daysElapsed` correctly even at month boundaries.
- The forecast is shown alongside actual savings in the dashboard's Month view.

**Anti-answers.**

- "Use ARIMA" — for a personal expense app, ARIMA is overkill; the simple linear forecast is honest about its limits.
- "The forecast should be conservative" — conservatism is a UX choice; the codebase shows the linear estimate.

**Follow-ups.**

1. What's the behavior on day 1 (daysElapsed = 1)?
2. What's the migration if you wanted to weight weekday vs weekend differently?

**Tags.** forecast, linear-extrapolation, kpi

---

### 7.8 — Reduction target progress

> **Medium / Both / 5 min**

**Question.** Open `src/domain/goals.ts`. The `reduction_target` goal type uses `currentBaseline` from the goal row (locked at creation) or a computed 30-day window. The `onTrack` flag is true when `current <= target OR percent >= 50`. Walk through.

**Why this matters.** Goal progress is a UX judgment; the mid-progress forgiveness is a deliberate choice.

**Expected answer.**

- `reduction_target`: user wants to reduce from baseline (e.g., 20/day) to target (e.g., 10/day) over a window.
- `currentBaseline` is locked at goal creation (the snapshot of the 30-day avg). Current is the 7-day rolling avg.
- `onTrack = current <= target OR percent >= 50`. The 50% mid-progress forgiveness means a user halfway to their goal isn't shown "you're off track."
- `clampPercent` rounds to 0.1, clamps 0..100.
- The lock on `currentBaseline` means a user can't game the goal by inflating the baseline post-creation.

**Anti-answers.**

- "Recompute baseline on every check" — that lets the user game the baseline by logging a high-stick day.
- "50% forgiveness is too generous" — that's a UX tuning knob; the team chose this.

**Follow-ups.**

1. What happens when `current = target`?
2. How is `currentBaseline` updated if the user pauses and resumes the goal?

**Tags.** goals, reduction, baseline, progress

---

### 7.9 — Daily cap at-risk band

> **Easy / Both / 3 min**

**Question.** Open `src/domain/goals.ts`. The `daily_cap` goal type has an "at-risk band: 80% ≤ used < 100%." Why a band, not a binary?

**Why this matters.** Goal UX with binary on-track/off-track is jarring; bands smooth the experience.

**Expected answer.**

- A user at 50% of `daily_cap` is "on track." A user at 90% is "at risk" — a warning state.
- The band `80% ≤ used < 100%` flags the user before they exceed the cap.
- At 100%, the user is "at limit." Above 100%, they're over.
- The visual treatment in the UI is distinct: green (on track), yellow (at risk), red (over).
- Same band logic applies to `spend_cap_daily`.

**Anti-answers.**

- "Binary is simpler" — simpler, but the band gives users actionable warning before they fail.
- "Warn at 90% only" — the 80% threshold gives a buffer.

**Follow-ups.**

1. What happens when the goal is completed?
2. What's the migration if you wanted a per-goal band threshold?

**Tags.** goals, daily-cap, at-risk, band

---

### 7.10 — `moodTriggerMatrix` is server-side and client-side

> **Medium / Both / 5 min**

**Question.** Open `src/domain/correlations.ts` and `supabase/migrations/20260504000000_enhancements.sql:157-175`. The codebase has both a `moodTriggerMatrix(logs)` in TypeScript AND a `v_mood_trigger_heatmap` view in SQL. Walk through why both exist.

**Why this matters.** Two implementations of the same computation are a code smell unless they're load-balanced.

**Expected answer.**

- `v_mood_trigger_heatmap` is a Postgres view with `security_invoker = true`, aggregating `user_id, mood_before, trigger_tag` to `(n, avg_unit_price, last_seen)`. (`20260504000000_enhancements.sql:157-175`.)
- `moodTriggerMatrix(logs, topK)` is a TypeScript function that builds the same matrix in memory from a client-side logs array. (`src/domain/correlations.ts`.)
- When to use which: the SQL view is for server-rendered Trends pages (large data, indexed scan); the TS function is for client-side updates (small data, no round-trip).
- The duplication is acceptable because the matrix is small (10 moods × 9 triggers = 90 cells max) and the computation is cheap.
- A future migration could replace both with a single RPC.

**Anti-answers.**

- "One of them is redundant" — they're not; they're different access patterns.
- "Use the SQL view always" — adds a round-trip the client doesn't need.

**Follow-ups.**

1. What's the cost of the view at 100k logs?
2. How would you unify the two implementations?

**Tags.** correlations, mood, trigger, dual-implementation

---

## Section 8 — Time-series modeling

The codebase treats time-series data with three storage columns: `ts_utc` (the instant), `local_date` (IST calendar day), `local_hour` (IST hour-of-day). The split is deliberate: `ts_utc` for ordering and keyset pagination, `local_date` for daily aggregation, `local_hour` for hour-of-day distribution.

The IST discipline is total. Every time-series question routes through `src/lib/date.ts` (`todayIst`, `daysAgoIst`, `startOfWeekIst`). There's no ad-hoc `new Date()` in domain code — the centralization is the point.

The indexes are forward-looking composite indexes: `(user_id, ts_utc DESC, brand_id)`, `(user_id, ts_utc DESC, trigger_tag)`. The 366-day cap in `get_daily_summary` matches the Year view. Keyset pagination uses `(ts_utc, id DESC)` as the cursor. Realtime publication includes 5 tables with `REPLICA IDENTITY FULL` for UPDATE/DELETE delivery.

### 8.1 — `local_date text` is for IST

> **Medium / Database-engineer / 5 min**

**Question.** Open `supabase/migrations/20250426120000_initial_schema.sql:76-100`. The `local_date` is `text` storing `YYYY-MM-DD` IST, not `date`. Walk through the timezone implications.

**Why this matters.** A timezone bug in a logging app is a calendar bug, which is a UX bug, which is a trust bug.

**Expected answer.**

- `local_date` is the user's calendar day in IST, derived from `ts_utc` via `toLocalDate()` in `src/lib/date.ts`.
- If `local_date` were `date` (Postgres native), the conversion from `ts_utc` would be ambiguous: does it convert at UTC midnight or IST midnight?
- `text` is the unambiguous choice — `YYYY-MM-DD` strings compare lexically the same as they compare chronologically, and there's no timezone coercion.
- Downstream queries cast to `::date` only when filtering ranges: `local_date::date BETWEEN p_from_date AND p_to_date` (`20260523171527_fix_list_logs_page_date_cast.sql`). The cast is intentional and bounded.
- The cost: no arithmetic on dates without a cast; no `EXTRACT(YEAR FROM local_date)`. The codebase pays this in exchange for unambiguous storage.

**Anti-answers.**

- "Use `timestamptz` for everything" — that loses the calendar day unit; aggregations by day require `DATE_TRUNC`.
- "Postgres handles timezones correctly" — only for `timestamptz`; `date` and `text` are timezone-naive.

**Follow-ups.**

1. What if the product added a US east-coast user?
2. Why is `local_hour` int and not text?

**Tags.** time-series, ist, local-date, timezone

---

### 8.2 — Composite indexes for keyset pagination

> **Medium / Database-engineer / 5 min**

**Question.** Open `supabase/migrations/20260531080049_scale_forward_indexes.sql:18-40`. The forward-looking indexes include `(user_id, ts_utc DESC, brand_id)`, `(user_id, ts_utc DESC, trigger_tag)`, and `(user_id, ts_utc DESC)`. Walk through the use cases.

**Why this matters.** Composite indexes are precision tools; the right column order matters.

**Expected answer.**

- `(user_id, ts_utc DESC)`: the base keyset pagination index. Every `list_logs_page` query uses this. (`20260531080049_scale_forward_indexes.sql:18-25`.)
- `(user_id, ts_utc DESC, brand_id)`: optimizes queries that filter by brand. The trailing column supports `WHERE user_id = ? AND brand_id = ?` after the leading columns.
- `(user_id, ts_utc DESC, trigger_tag)`: same shape for trigger-tag filtering.
- Column order: equality columns first (`user_id`), then ordering columns (`ts_utc DESC`), then filter columns (`brand_id` / `trigger_tag`). Postgres can use a prefix of the index for partial filters.
- Why "forward-looking"? Because the original migration created only `(user_id, local_date)`; the team added ts_utc-prefixed indexes as they saw new access patterns.

**Anti-answers.**

- "One index per column" — Postgres can use multi-column indexes for single-column predicates; the composite is more flexible.
- "DESC indexes are slower" — no, Postgres handles DESC indexes natively.

**Follow-ups.**

1. What's the cost of an unused index?
2. How would you add an index for a new query pattern?

**Tags.** time-series, index, keyset, pagination

---

### 8.3 — The 366-day cap is in SQL, not the client

> **Easy / Both / 3 min**

**Question.** Open `supabase/migrations/20260524050357_add_daily_summary.sql:23-40`. The `get_daily_summary` rejects `p_to - p_from > 366 days`. Why in SQL?

**Why this matters.** Client-side limits are easily bypassed.

**Expected answer.**

- A client-side cap is a soft constraint — anyone calling the RPC directly bypasses it.
- The SQL cap is a hard constraint — even `psql` against the DB hits it.
- The cap matches the UI's Year view. The function is the source for that view; the cap is the contract.
- The error raised is informative: `p_to - p_from > 366 days is not supported`.
- Without the cap, a user (or bug) could request `from='1900-01-01'` and force a full-table scan.

**Anti-answers.**

- "Just trust the client" — trust is the wrong model for SQL.
- "Use LIMIT" — LIMIT applies after the predicate scan; the predicate is the cost.

**Follow-ups.**

1. What's the migration to raise the cap to 730 days?
2. What's the error code raised?

**Tags.** time-series, cap, daily-summary, sql-constraint

---

### 8.4 — Keyset cursor contract

> **Medium / Database-engineer / 5 min**

**Question.** Open `src/db/repositories/logs.ts` and the `list_logs_page` RPC. The cursor is `{ts, id}` (or `{ts_utc, id}` server-side). Walk through why a composite cursor, not a single-column one.

**Why this matters.** A cursor that doesn't uniquely order rows will skip or duplicate under contention.

**Expected answer.**

- Many logs can share the same `ts_utc` (a user logging multiple cigarettes in a minute). A cursor on `ts_utc` alone is not unique.
- The composite `(ts_utc, id DESC)` is unique — `(ts_utc, id)` is the row's identity for ordering.
- The keyset query: `WHERE user_id = p_user_id AND ts_utc <= p_cursor_ts AND (ts_utc, id) < (p_cursor_ts, p_cursor_id)`. The composite comparison is supported by the index.
- A single-column cursor on `id` would work for ordering, but `(ts_utc, id)` is what the index provides; using `id` alone would force a different sort.

**Anti-answers.**

- "Just use OFFSET" — see Section 3.5; offset breaks under inserts.
- "Use UUIDs for cursor" — the cursor is a row position, not a row identity.

**Follow-ups.**

1. What's the migration to add a third column to the cursor?
2. What happens if two logs share both `ts_utc` and `id`?

**Tags.** keyset, cursor, composite, pagination

---

### 8.5 — Realtime publication: 5 tables

> **Medium / Database-engineer / 5 min**

**Question.** Open `supabase/migrations/20260606000000_realtime_publications.sql`, `20260620130000_realtime_enable.sql`, and `20260622000000_realtime_brands.sql`. Walk through which 5 tables are in the publication and which are excluded.

**Why this matters.** Realtime channel cost is per-row; the publication choice has a dollar cost.

**Expected answer.**

- In the publication: `cigarette_logs`, `goals`, `user_profiles`, `brands`, `brand_variants`. (`20260606000000_realtime_publications.sql:1-30`, `20260620130000_realtime_enable.sql:1-15`, `20260622000000_realtime_brands.sql:1-20`.)
- Excluded by design: `audit_events`, `error_events`, `usage_events`, `price_entries`, `reminders`, `settings_kv`, `user_facts_seen`, `rate_limit_counters`. The channel cost outweighed the UX win.
- Why `cigarette_logs`? Cross-device sync — a log written on mobile should appear on web immediately.
- Why not `audit_events`? Audit is server-written; clients shouldn't see real-time updates.
- `REPLICA IDENTITY FULL` is set on `cigarette_logs`, `goals`, `brands`, `brand_variants` because UPDATE/DELETE events need `user_id` in the OLD tuple for the client filter. `user_profiles` doesn't need it (filters on PK).

**Anti-answers.**

- "Include everything" — channel cost would blow the free-tier egress budget.
- "REPLICA IDENTITY FULL is a performance optimization" — it's correctness; without it, UPDATE/DELETE events are dropped client-side.

**Follow-ups.**

1. What's the cost of adding `price_entries` to the publication?
2. How would you add `settings_kv` safely?

**Tags.** realtime, publication, replica-identity, channel-cost

---

### 8.6 — Hour distribution and day-of-week distribution

> **Medium / Both / 5 min**

**Question.** Open `src/domain/calc.ts`. The `hourDistribution(logs)` returns a 24-bucket array; `dowDistribution(logs)` returns 7 buckets. Walk through the implementation choices.

**Why this matters.** Distribution charts are a common analytics requirement; understanding the bucketing is required.

**Expected answer.**

- `hourDistribution(logs)`: 24-element array, index 0 = 00:00–00:59 IST, index 23 = 23:00–23:59 IST. (`src/domain/calc.ts`.)
- `dowDistribution(logs)`: 7-element array, index 0 = Monday, index 6 = Sunday (Monday-start week to match `startOfWeekIst`).
- The hour is `local_hour` from the log row; the day is derived from `local_date` via `getDayOfWeek(localDate)` which respects Monday-start.
- The dashboard's hour-of-day chart reads from `hourDistribution`; the day-of-week chart reads from `dowDistribution`.
- Empty buckets are included (zero-count) so the chart's x-axis is always complete.

**Anti-answers.**

- "Use Monday-start because it's the ISO standard" — yes; matches `startOfWeekIst`.
- "Skip empty buckets" — the chart needs a complete x-axis.

**Follow-ups.**

1. What happens if `local_hour` is missing on a log?
2. How is `dowDistribution` different from a SQL `GROUP BY EXTRACT(DOW FROM ...)`?

**Tags.** distribution, hour, day-of-week, bucketing

---

### 8.7 — Time-series at scale

> **Hard / Both / 8 min**

**Question.** A power user has 100k cigarette_logs over 5 years. They open Trends Year, then Trends Day, then drill into a specific day. Walk through the indexes consulted at each step.

**Why this matters.** Index design is only correct when it serves real access patterns.

**Expected answer.**

- **Trends Year**: `get_daily_summary(p_from, p_to)` reads `v_daily_summary_user` filtered by `user_id` and `local_date::date BETWEEN p_from AND p_to`. View is SECURITY INVOKER, RLS applies. Index: `(user_id, ts_utc DESC)` for the underlying scan, then GROUP BY.
- **Trends Day**: raw logs for one day. Index: `(user_id, local_date DESC)` for the day filter. (`20250426120000_initial_schema.sql:90-100`.)
- **Drill into a specific log**: row by primary key (`id`), RLS-scoped.
- For 100k logs:
  - Year view: ~270 daily aggregates; ~270 rows out, fast.
  - Day view: ~5–10 logs; trivial.
  - Drill: primary key lookup; trivial.
- The indexes serve all three patterns. A user with 1M logs would still be fast on Year (GROUP BY is O(rows) regardless of total volume) but slow on Day if the day has many logs (keyset pagination is needed).

**Anti-answers.**

- "All queries hit the same index" — different queries use different indexes; that's the point of having multiple.

**Follow-ups.**

1. What's the migration if Day needs to support 1000+ logs/day?
2. How would you add a quarterly Trends view?

**Tags.** time-series, index, scale, trends

---

## Section 9 — Catalog seeding strategy

The brand catalog is the load-bearing seed data. A new user signs up; `handle_new_user` seeds 5 brands from `smoke_seed.brand_catalog`. As the catalog grows (2026.1, 2026.2, European, Indian regional), existing users get more brands on each `sync_default_brand_catalog` call.

The seed schema (`smoke_seed.*`) is fully revoked from PUBLIC. Reads go through SECURITY DEFINER RPCs. This is the second schema split (Section 1.6) in action.

The `price_count = 0` gate on `brand_variants` is the load-bearing escape hatch: it lets `refresh_seed_prices_from_catalog` update seed prices without overwriting user-entered prices. The seed refresh writes only where `COALESCE(price_count, 0) = 0` — i.e., never observed.

### 9.1 — `smoke_seed.brand_catalog` is the canonical source

> **Medium / Database-engineer / 5 min**

**Question.** Open `supabase/migrations/20250426120000_initial_schema.sql:6-35`. The `smoke_seed.brand_catalog` table has columns `(sort_order, brand_name, category, variant_name, default_pack_size, avg_price_inr)`. Walk through the columns and the role of `sort_order`.

**Why this matters.** Catalog tables are deceptively simple; the schema encodes business decisions.

**Expected answer.**

- `sort_order` is an int PK. The catalog is sorted: lower `sort_order` = displayed first in the brand picker.
- `brand_name` + `variant_name` is the natural key (composite unique, though not enforced via a unique index — dedupe is by lowercase at insert time).
- `category` is the brand category enum (`budget | regular | premium | imported | other`).
- `default_pack_size` is the assumed pack size for unit-price calculations (carton math uses `packSize * 10`).
- `avg_price_inr` is the seed MRP, used until the user records a real price (then `price_count` increments and the running mean takes over).
- `REVOKE ALL ON SCHEMA smoke_seed FROM PUBLIC; REVOKE ALL ON ALL TABLES IN SCHEMA smoke_seed FROM PUBLIC;` at the top of the migration says "no client role may touch this."

**Anti-answers.**

- "`sort_order` is for performance" — no; it's for display ordering.
- "Public should see the catalog" — no, the catalog is server-only.

**Follow-ups.**

1. What's the migration to add a new brand?
2. How is `sort_order` updated when the catalog grows?

**Tags.** catalog, smoke-seed, brand-catalog, seed-data

---

### 9.2 — Dedupe by lowercase brand name

> **Medium / Database-engineer / 5 min**

**Question.** Open `supabase/migrations/20260519130000_brand_catalog_expansion.sql` and the `apply_default_brands` / `sync_catalog_for_user` functions. Walk through how a re-seed handles existing user brands.

**Why this matters.** Re-seeding without dedupe creates duplicates; dedupe by case-sensitive name creates inconsistent data.

**Expected answer.**

- `apply_default_brands(target_user)` inserts brands from `smoke_seed.brand_catalog` for a new user. (`20260519130000_brand_catalog_expansion.sql:80-130`.)
- Dedupe: `WHERE NOT EXISTS (SELECT 1 FROM public.brands WHERE user_id = target_user AND lower(name) = lower(NEW.brand_name))`.
- Case-insensitive dedupe means "Gold Flake" and "gold flake" don't coexist for the same user.
- `sync_catalog_for_user(target_user)` does the same shape plus adds new variants to existing brands (also lowercased).
- This means: a user who already has "Gold Flake" (case as entered) won't get a duplicate from the seed even if the seed has "Gold Flake" (case as catalog).

**Anti-answers.**

- "Dedupe by id" — ids are user-generated; the catalog has no global id.
- "Case-sensitive dedupe is fine" — "Gold Flake" and "gold flake" should be the same brand.

**Follow-ups.**

1. What happens if a user renames a seeded brand?
2. What's the migration to make dedupe case-sensitive?

**Tags.** catalog, dedupe, lowercase, idempotent

---

### 9.3 — The `price_count = 0` gate

> **Hard / Database-engineer / 8 min**

**Question.** Open `supabase/migrations/20260520000000_security_correctness.sql:120-180` and `20260601000000_catalog_2026_refresh.sql`. The `refresh_seed_prices_from_catalog` RPC only updates `brand_variants` where `COALESCE(price_count, 0) = 0`. Walk through the design.

**Why this matters.** User-entered prices must survive every seed refresh. The gate is the safety.

**Expected answer.**

- When the catalog refreshes, seed prices may change (MRP updates, regional pricing, etc.). The refresh must update prices the user has never overridden.
- The gate: `WHERE price_count = 0` means "this variant has never been observed by a user." (`20260601000000_catalog_2026_refresh.sql:30-60`.)
- Once a user records a price (`create_log_with_rate_limit` increments `price_count`), the variant is "user-owned" — the seed refresh leaves it alone.
- `setVariantPriceOverride` deliberately sets `price_count = 1` to flag a manual override; the refresh SQL only updates where `price_count = 0`, so `= 1` survives.
- The choice of `= 0` (not `IS NULL`) is deliberate: `price_count` is `NOT NULL DEFAULT 0`, so legacy rows have `0` and new rows increment to `1+`. The COALESCE handles hypothetical future NULLs.

**Anti-answers.**

- "Update all prices on refresh" — overwrites user data.
- "Update only if `last_priced_at IS NULL`" — conflates "never observed" with "user hasn't recorded in a while."

**Follow-ups.**

1. What's the migration to force-update a variant's price?
2. How does a user "reset" a variant to seed price?

**Tags.** catalog, price-count, seed-refresh, gate

---

### 9.4 — Why the catalog keeps growing

> **Easy / Both / 3 min**

**Question.** List every migration that adds brands to the catalog. What is the rhythm?

**Why this matters.** A growing catalog is a deliberate choice; understanding the rhythm reveals the team's update cadence.

**Expected answer.**

- `20250426120000_initial_schema.sql` — initial 5 brands.
- `20260504000000_enhancements.sql` — added facts and milestones, not brands.
- `20260519130000_brand_catalog_expansion.sql` — 41 international brands.
- `20260601000000_catalog_2026_refresh.sql` — 2026 MRP refresh + 15 new variants.
- `20260601120000_indian_brand_catalog_expansion.sql` — 38 Indian brands.
- `20260605000000_european_brand_catalog.sql` — 22 European brands.
- `20260620120000_indian_brand_catalog_2026_expansion.sql` — 17 more Indian brands.
- Rhythm: roughly every 1-2 weeks during the 2026 build-up, slowing as the catalog matures.
- Each expansion migration is idempotent (case-insensitive dedupe) and adds a small set, not a wholesale replace.

**Anti-answers.**

- "One big migration" — that's the textbook mistake; small expansions are auditable.

**Follow-ups.**

1. What's the migration to remove a brand?
2. How does the catalog stay current with market prices?

**Tags.** catalog, expansion, rhythm, migration

---

### 9.5 — Service-role only refresh

> **Easy / Database-engineer / 3 min**

**Question.** Open `supabase/migrations/20260601000000_catalog_2026_refresh.sql`. The `refresh_seed_prices_from_catalog` is granted to service_role only. Why?

**Why this matters.** Catalog refresh touches every user's variants; the privilege must match.

**Expected answer.**

- The function updates `brand_variants.avg_price_inr` for all users where `price_count = 0`. That's cross-user; only service_role can do it.
- Authenticated callers can call the wrapper `public.refresh_seed_prices_from_catalog()` (granted in `20260531075255_lockdown_secdef_execute.sql`) but the wrapper is no-op for them — the actual work is in `smoke_seed.refresh_seed_prices_from_catalog()`.
- The wrapper pattern lets us grant a no-op RPC to clients (so they can test connectivity) without exposing the cross-user write.

**Anti-answers.**

- "Authenticated should be able to refresh" — they can call the wrapper, but the wrapper does nothing for them.

**Follow-ups.**

1. What's the wrapper vs the inner function?
2. How is the refresh scheduled?

**Tags.** catalog, service-role, refresh, grants

---

## Section 10 — Money, date, locale (INR / IST)

This is the cross-cutting concern both roles must know. Money is in INR, stored as integer paise (well, actually stored as `numeric` with two-decimal precision — see below). Dates are IST, stored as `text` `YYYY-MM-DD`. Locale formatting uses `Intl.NumberFormat('en-IN')` for the lakh grouping (`1,00,000`).

The codebase's posture on money is: round at the leaf, defer rounding to display. The `round2` function is the explicit choice. The `PriceSource` enum ('exact' | 'estimated' | 'inferred' | 'unknown') carries provenance through every layer, so downstream knows whether a number is user-typed, derived, catalog-inferred, or unknown.

Locale discipline: `Intl.NumberFormat('en-IN')` produces lakh grouping. Compact form (`₹1.2L`, `₹1.2Cr`, `₹1.2k`) is used in dashboard tiles. The design tokens forbid alarm-red — terracotta `--warn-earth` is the concern color.

### 10.1 — INR via `Intl.NumberFormat('en-IN')`

> **Medium / Both / 5 min**

**Question.** Open `src/lib/format.ts` and search for `formatInr`. The function uses `Intl.NumberFormat('en-IN')`. Walk through what that produces and why `en-IN` instead of `en-US` or `hi-IN`.

**Why this matters.** India numbering convention is lakh-crore (last 3 + pairs of 2), not thousand-million (last 3 + pairs of 3). The wrong locale produces wrong-looking numbers.

**Expected answer.**

- `Intl.NumberFormat('en-IN')` formats with the Indian grouping: `1,00,000` (one lakh), `10,00,000` (ten lakhs), `1,00,00,000` (one crore). Last 3 digits, then pairs of 2. (`src/lib/format.ts`.)
- `Intl.NumberFormat('en-US')` would produce `100,000` — visually flat. Indians reading `100,000` see "one hundred thousand" not "one lakh."
- `hi-IN` would use Devanagari digits (`१,००,०००`) by default. For a product targeting English-literate users, `en-IN` is correct.
- Compact form: `Intl.NumberFormat('en-IN', { notation: 'compact', maximumFractionDigits: 1 })` produces `₹1.2L` / `₹1.2Cr` / `₹1.2k`. Used in dashboard tiles for space.
- The function handles edge cases: `null`, `NaN`, negative numbers, very small numbers (< ₹1).

**Anti-answers.**

- "All locales are the same" — wrong; en-IN has unique grouping.
- "Just use `toLocaleString()` without arguments" — defaults to the runtime locale, which is fragile.

**Follow-ups.**

1. What happens if the runtime locale is `fr-FR`?
2. What happens if `value` is `Infinity`?

**Tags.** locale, inr, intl, lakh

---

### 10.2 — `round2` and the rounding discipline

> **Medium / Both / 5 min**

**Question.** Open `src/domain/calc.ts` and search for `round2`. The codebase uses `Math.round(n * 100) / 100` for INR rounding. Walk through where it's applied.

**Why this matters.** Rounding money is where bugs hide. The discipline is explicit.

**Expected answer.**

- `round2(n) = Math.round(n * 100) / 100` — 2-decimal rounding for INR. (`src/domain/calc.ts`.)
- Applied at the *display* layer, not the *storage* layer. Storage uses `numeric` columns (`total_price_inr`, `unit_price_inr`) with no rounding at write.
- Applied in `calc.ts` (`deriveUnitPrice`, `resolveLogUnitPrice`), `periodSummary.ts` (`savedForWindow`, `savedAllTime`), `savings.ts` (`potentialSavings.totalInr`), `format.ts`.
- The leaf computation is exact (cigarette count × unit price = exact total). Rounding happens at the boundary where the number becomes a display string.
- The cost: any sum that's done in floating-point loses precision (1/3, 7ths, etc.). For INR with 2-decimal precision, the precision loss is bounded.

**Anti-answers.**

- "Round at every step" — over-rounds and drifts.
- "Use floats without rounding" — accumulating drift over many sums.

**Follow-ups.**

1. What's the migration if you switch to 4-decimal precision (e.g., for crypto)?
2. How does `round2` differ from `Math.round(n * 100) / 100` exactly?

**Tags.** money, round2, inr, precision

---

### 10.3 — The `PriceSource` enum is provenance

> **Hard / Both / 8 min**

**Question.** Open `src/lib/validation.ts` and search for `PriceSourceSchema`. Every cigarette log carries `priceSource: 'exact' | 'estimated' | 'inferred' | 'unknown'`. Walk through why provenance matters.

**Why this matters.** Money without provenance is dangerous — you don't know what's measured vs. assumed.

**Expected answer.**

- `PriceSourceSchema` is an enum: exact (user typed the price), estimated (user estimated), inferred (catalog lookup), unknown (no price info). (`src/lib/validation.ts`.)
- The enum propagates from `create_log_with_rate_limit` RPC through to the dashboard and analytics.
- Why: a savings number computed from "inferred" prices is fundamentally different from one computed from "exact" prices. A dashboard showing "you saved ₹5,000" should know whether that's based on user-typed data or catalog guesses.
- The running mean on `brand_variants` only counts observations with `price_source IN ('exact', 'estimated')` — inferred and unknown don't contribute.
- The export envelope carries `priceSource` per log so DPDP export preserves provenance.

**Anti-answers.**

- "Just store the number" — then you can't distinguish measurement from assumption.

**Follow-ups.**

1. What's the migration if you add a `price_source = 'bulk'` for pack purchases?
2. Where is `priceSource` consumed by analytics?

**Tags.** price-source, provenance, validation, inr

---

### 10.4 — Monday-start week

> **Easy / Both / 3 min**

**Question.** Open `src/lib/date.ts` and search for `startOfWeekIst`. The function returns Monday for any given date. Walk through why Monday-start, not Sunday-start.

**Why this matters.** Locale-aware date arithmetic is a small thing that matters for analytics.

**Expected answer.**

- `startOfWeekIst(date)` returns the Monday of the week containing `date`. (`src/lib/date.ts`.)
- India uses Monday-start for work weeks; the codebase matches.
- The `weekly_target` goal type uses `startOfWeekIst(today)` as the start of the week's progress.
- The Trends Week view shows Monday-start weeks.
- The choice cascades into `dowDistribution` (0 = Monday in the 7-bucket array).
- US conventions use Sunday-start; following US would mismatch the dashboard's day-of-week chart with users' intuition.

**Anti-answers.**

- "Locale doesn't matter" — wrong; Monday vs. Sunday changes which days are "this week."

**Follow-ups.**

1. What's the migration if a user wants Sunday-start?
2. What about a user in a different locale?

**Tags.** date, monday-start, week, locale

---

### 10.5 — Feb 29 leap-year handling

> **Medium / Both / 5 min**

**Question.** Open `src/domain/age.ts`. The `isBirthdayToday` function handles Feb 29 birthdays by triggering on Mar 1 in non-leap years. Walk through the conservative approach.

**Why this matters.** Edge cases in birthday math are a common bug source.

**Expected answer.**

- A user born on Feb 29, 2000 has a birthday on Feb 29 every leap year, but only every 4 years.
- `isBirthdayToday(dob, today)` checks month/day match. For a Feb 29 dob, in non-leap years, today is Mar 1 (the user's "celebrated" birthday). (`src/domain/age.ts`.)
- The conservative choice: trigger on Mar 1 rather than skip the year. The user gets the celebration they deserve; the alternative (skip) makes Feb 29 birthdays feel forgotten.
- `computeAge(dob, today)` uses calendar parts (year, month, day) not milliseconds — leap-year-safe.
- `parseYmd` rejects impossible dates (`2025-02-30`) at the input layer.

**Anti-answers.**

- "Skip the year" — makes Feb 29 birthdays feel forgotten.
- "Use ms deltas" — DST/timezone bugs at boundaries.

**Follow-ups.**

1. What does `computeAge` return for a future DOB?
2. How is `isBirthdayToday` used in the character mood bus?

**Tags.** birthday, leap-year, feb-29, age

---

### 10.6 — Indian numbering in the dashboard

> **Easy / Both / 3 min**

**Question.** Open the dashboard (web or mobile) and find a number that's formatted. What's the grouping rule?

**Why this matters.** UI consistency is a design discipline; numbers follow.

**Expected answer.**

- Lakh grouping: last 3 digits, then pairs of 2. `1,00,000` (1 lakh), `10,00,000` (10 lakhs), `1,00,00,000` (1 crore).
- Compact form in tiles: `₹1.2L`, `₹1.2k`, `₹1.2Cr`. (`src/lib/format.ts`.)
- The formatting is consistent across web and mobile (the shared `format.ts` is used by both).
- The `tnum` font-variant (tabular numerals) is applied in CSS so digits align in columns (`web/app/globals.css`).

**Anti-answers.**

- "Use `Intl.NumberFormat('en-US')` for consistency" — produces `100,000` which reads as "one hundred thousand," wrong for the audience.

**Follow-ups.**

1. Where in `DESIGN.md` is the typography decision documented?
2. What's the migration if a user prefers comma grouping?

**Tags.** locale, inr, lakh, design-tokens

---

### 10.7 — Money at the storage layer

> **Hard / Both / 10 min**

**Question.** Open `supabase/migrations/20250426120000_initial_schema.sql:76-100`. The columns `total_price_inr`, `unit_price_inr`, `avg_price_inr` are `numeric`, not `integer` (paise). Walk through the storage choice.

**Why this matters.** Storage type choice for money is a foundational decision.

**Expected answer.**

- `numeric` is arbitrary-precision decimal in Postgres. With `numeric(5,2)` or unbounded `numeric`, INR prices fit exactly.
- The choice to use `numeric` not `integer paise` is a UX choice: `total_price_inr = 250.50` reads naturally; storing as `25050` paise would require conversion at every read.
- Postgres `numeric` is slower than `integer` for arithmetic but fits the use case (single-user inserts, not millions-per-second).
- The CHECK constraints cap at sane values: `total_price_inr ≤ 10000`, `unit_price_inr ≤ 2000`, `avg_price_inr ≤ 2000`. (`20250426120000_initial_schema.sql`.)
- The downside: `numeric` columns come back from supabase-js as strings (Postgres → JSON → JS string). The repository coerces with `Number()` (e.g., `getDailySummary` in `src/db/repositories/summary.ts`).

**Anti-answers.**

- "Use `float8`" — floating-point loses precision on exact paise values like `0.10`.
- "Use `integer paise` always" — pedantic; the storage layer doesn't care.

**Follow-ups.**

1. What's the migration if you switch to paise integers?
2. What's the cost difference between `numeric` and `integer` at scale?

**Tags.** money, numeric, storage, inr

---

## Section 11 — Cross-platform parity (web / mobile)

The codebase is a monorepo: `web/` (Next.js 14 App Router), `app/` (Expo Router SDK 56), `src/` (shared domain). Both web and mobile import from `src/` via `@/` (web uses `@web/` for web-specific). The shared code is *most* of the codebase — domain, repositories, validation, types, Zustand stores.

Where they differ is at the edge: server loaders (web has `web/lib/server/data.ts`), realtime foreground triggers (web uses `visibilitychange`, mobile uses `AppState`), the character mood bus (web uses `window.dispatchEvent`, mobile uses `DeviceEventEmitter`).

This split is intentional. The two surfaces have different failure modes (mobile flakiness, server component crashes), and forcing identical code would mean both inherit the worst of each.

### 11.1 — The shared vs surface-specific split

> **Medium / Data-analytics / 5 min**

**Question.** Open `src/domain/calc.ts` and `web/lib/server/data.ts`. The same domain logic is imported by both web and mobile; only the data-loaders are web-specific. Walk through the boundary.

**Why this matters.** A clean shared/surface split is what makes the codebase maintainable across two platforms.

**Expected answer.**

- `src/` is the shared codebase: domain, repositories, validation, types, Zustand stores. Both web and mobile import from here.
- `web/lib/server/` is web-specific: server loaders (`getServerProfile`, `getServerLogs`) that run inside Next.js Server Components. The web app uses these instead of browser-client repos for SSR.
- `web/components/` is web UI; `src/components/` is shared UI primitives.
- `app/` is mobile UI (Expo Router), using shared `src/` for everything.
- The mobile has no `server/` directory — all data fetching is client-side (no SSR).

**Anti-answers.**

- "Duplicate the domain logic per platform" — that's the textbook mistake; the shared layer prevents drift.

**Follow-ups.**

1. What's the migration to add a third platform (e.g., desktop)?
2. How are web-specific types (e.g., `FormData`) handled?

**Tags.** web, mobile, monorepo, parity

---

### 11.2 — The SSR crash that forced `web/lib/server/data.ts`

> **Hard / Data-analytics / 8 min**

**Question.** Open `web/lib/server/data.ts` and `src/db/repositories/_supabase.ts`. The codebase has a rule "server components must NOT call browser-client repos." Walk through why and the crash that motivated it.

**Why this matters.** The boundary between server and client code is a hard one. Crossing it is a runtime crash.

**Expected answer.**

- `getSupabase()` (browser) calls `createBrowserSupabase()`, which references `window`. On the server, `typeof window === 'undefined'` is true; the constructor crashes.
- Server components in Next.js 14 App Router call repo functions. If a repo uses the browser client, the call crashes on the server.
- `web/lib/server/data.ts` is the server-side equivalents: `getServerProfile()`, `getServerLogs()`, `getServerBrandsWithVariants()`. These use a server-side Supabase client (`createServerSupabase()`) that doesn't reference `window`.
- The crash happened on `/history` SSR — fixed by switching from `getBrandsWithVariants` (browser repo) to `getServerBrandsWithVariants` (server loader).
- `src/lib/supabase.ts` has a guard: in production web, it throws if `Platform.OS === 'web'` and the code is server-side.

**Anti-answers.**

- "Browsers and servers are the same runtime" — no; `typeof window` differs.
- "Use `try/catch` to handle" — the crash is at import time, before try/catch.

**Follow-ups.**

1. What's the env var that forces server-side construction?
2. What's the migration if a new server-side feature needs data access?

**Tags.** web, ssr, server-components, supabase-guard

---

### 11.3 — `RealtimeRefresher` is duplicated by design

> **Medium / Data-analytics / 5 min**

**Question.** Open `src/components/realtime/RealtimeRefresher.tsx` (mobile) and `web/components/realtime/RealtimeRefresher.tsx` (web). Both subscribe to the same 5 tables with the same filter, but trigger different refresh actions. Walk through the duplication.

**Why this matters.** Two implementations of the same subscription is intentional but easy to break.

**Expected answer.**

- Both files subscribe to the 5 tables in publication (`cigarette_logs`, `goals`, `user_profiles`, `brands`, `brand_variants`) with `user_id=eq.<uid>` filter.
- Mobile triggers `useSession.refresh*` calls (the Zustand store) on change.
- Web triggers `router.refresh()` (Next.js server revalidation) on change.
- The foreground trigger differs: web uses `visibilitychange`, mobile uses `AppState` to detect foreground.
- The duplication is deliberate — both files stay in parity intentionally, and the foreground trigger is the only intended difference.
- Drift risk: if mobile adds a new table subscription, web doesn't get it. The team has a manual parity check in the CI smoke tests.

**Anti-answers.**

- "Share via a library" — the cross-platform abstraction would obscure the deliberate differences.
- "Use a polling fallback" — realtime is the primary path; polling defeats the purpose.

**Follow-ups.**

1. What's the migration to add a new table to realtime publication?
2. How is parity enforced in CI?

**Tags.** realtime, refresher, parity, web-vs-mobile

---

### 11.4 — The character mood bus

> **Easy / Data-analytics / 3 min**

**Question.** Open `src/lib/character/mood.ts` (mobile) and `web/lib/character/mood.ts` (web). The character mood bus uses different mechanisms (`DeviceEventEmitter` vs `window.dispatchEvent`) on the two platforms. Why?

**Why this matters.** A cross-platform event bus is a common pattern; the implementation differs by runtime.

**Expected answer.**

- Mobile (React Native) uses `DeviceEventEmitter` for fire-and-forget events that don't need React context.
- Web (browser) uses `window.dispatchEvent(new CustomEvent('character:mood', {detail}))` for the same purpose.
- The events are themed: `character:mood`, `character:milestone`, `character:farewell`. The UI overlays listen for these events and react.
- The bus is fire-and-forget — the sender doesn't wait for any consumer.
- The two implementations are kept in parity by convention, not by code sharing (the runtime APIs are incompatible).

**Anti-answers.**

- "Use React Context" — that requires a wrapping Provider; the bus is intentionally Provider-free for cross-cutting reach.

**Follow-ups.**

1. What's the migration to add a new event type?
2. How is the bus tested?

**Tags.** character, mood-bus, events, cross-platform

---

### 11.5 — `useSession` is the central cache

> **Medium / Data-analytics / 5 min**

**Question.** Open `src/store/session.ts`. The `useSession` Zustand store is the central cache for profile, logs, brands, goals, summary. Walk through its boot and refresh lifecycle.

**Why this matters.** A central cache is the linchpin of a performant app; understanding it is required.

**Expected answer.**

- On boot, `useSession.boot()` runs `maybeSyncDefaultBrandCatalog` then fetches `profile`, `logs` (90d), `brands`+`variants`, `goals`, `summary` in `Promise.all`. (`src/store/session.ts`.)
- The `summary` is `DailySummaryRow[]`, the canonical pre-aggregated daily totals. Floored at `max(onboardedAt, daysAgoIst(365))`.
- Each `refresh*` method re-fetches its slice; `refreshAll` re-fetches everything.
- Writes (e.g., `addLog`, `updateGoal`) follow up with `refreshSummary()` to keep dashboard in step.
- The cache is in-memory only — cleared on logout via `useSession.reset()`.
- The `boot` is idempotent; safe to call multiple times (e.g., on tab focus).

**Anti-answers.**

- "Re-fetch everything on every write" — wasteful; only the summary needs re-fetch.
- "Persist to AsyncStorage" — durability is provided by the database, not the cache.

**Follow-ups.**

1. What's the migration if a new entity is added?
2. How is `summarySinceYmd` derived?

**Tags.** session, store, cache, boot

---

### 11.6 — Onboarding draft is not persisted

> **Easy / Data-analytics / 3 min**

**Question.** Open `src/store/onboardingDraft.ts`. The onboarding draft store is deliberately not persisted. Why?

**Why this matters.** What to persist and what not to persist is a UX decision; understanding the trade-off matters.

**Expected answer.**

- The onboarding draft holds in-progress consent checkboxes, baseline numbers, goal choices.
- Persistence would mean: a user who closes the app mid-onboarding returns to where they left off.
- The decision: drafts are session-scoped. Logout or app close clears them; re-onboarding starts fresh.
- Why: consent is a fresh decision; persisted drafts could mean a user "consented" to a version they never reviewed.
- The reset hook is `useSession.reset()`, which calls `useOnboardingDraft.getState().clear()`.

**Anti-answers.**

- "Persist for UX" — UX win at the cost of consent freshness; the team chose consent.
- "Don't track draft at all" — that loses in-progress state within a session.

**Follow-ups.**

1. What's the migration if you want to persist drafts on web only?
2. How is `onboardingStep` (different from draft) persisted?

**Tags.** onboarding, draft, persistence, consent

---

### 11.7 — The Expo/Hermes ESM fix

> **Hard / Both / 8 min**

**Question.** Open `metro.config.js` and search for `supabase-js`. The Metro config forces `@supabase/supabase-js` to use the CJS bundle because Hermes can't compile the ESM `import(var)` syntax. Walk through the issue.

**Why this matters.** A build-time fix is the kind of detail that distinguishes an experienced team.

**Expected answer.**

- `@supabase/supabase-js` ships ESM with `import(var)` dynamic imports. Hermes (Expo's JS engine) cannot parse that syntax at compile time.
- The `metro.config.js` resolver forces `@supabase/supabase-js` → `dist/index.cjs` — the CommonJS bundle. (`metro.config.js`.)
- The fix is a single `resolveRequest` block that checks the module name and returns the CJS path.
- Without this, the app crashes at runtime when Supabase is imported.
- This is one of the few places where the build config differs by platform; web doesn't need it.

**Anti-answers.**

- "Just upgrade Supabase" — newer versions have similar issues; the constraint is Hermes.
- "Use a polyfill" — polyfills don't fix parser issues.

**Follow-ups.**

1. What's the migration to drop the workaround?
2. When does Hermes add ESM support?

**Tags.** expo, hermes, esm, metro-config

---

### 11.8 — The mobile number `+91` regex

> **Easy / Both / 3 min**

**Question.** Open `src/lib/validation.ts` and search for `mobile_e164`. The `mobileE164` regex is `^\+91[6-9]\d{9}$`. Walk through the constraints.

**Why this matters.** Locale-aware validation is a common requirement; the regex encodes the rules.

**Expected answer.**

- `^\+91` — country code for India.
- `[6-9]` — first digit of mobile number (Indian mobile numbers start with 6, 7, 8, or 9 — never 0, 1, 2, 3, 4, 5).
- `\d{9}$` — remaining 9 digits of the 10-digit mobile number.
- Total: +91 + 10 digits, all numeric, first digit 6-9.
- The CHECK constraint in `user_profiles.mobile_e164` is broader: `^\+[1-9][0-9]{7,14}$` (any valid E.164). The app-side regex is tighter for India-only.
- The DB allows non-Indian numbers (in case the product expands); the app restricts at input.

**Anti-answers.**

- "Use a library" — over-engineering for one country.
- "Allow any 10-digit number" — allows landline numbers (which start with other digits).

**Follow-ups.**

1. What's the migration to support multi-country?
2. What happens if a user tries to enter a US number?

**Tags.** mobile, validation, india, regex

---

## Section 12 — Failure modes & migration discipline

The codebase treats failures as first-class. Every write path goes through `parseOrThrow` → `try { ... } catch (mapDbError)` → `toSafeErrorMessage`. The `error_events` table captures client-side errors. The `UNSAFE_FRAGMENTS` regex list prevents infrastructure details from leaking to UI.

Migration discipline is the operational backbone. The repo has 30 migrations; the live DB has its own version stamp. Forward-fix migrations are the pattern: when an edited migration drifts from prod, the fix is a new migration that re-applies the change. The migration ledger (`docs/deployment/migration-ledger-map.md`) documents which is which.

The CI smoke test (`scripts/sql/smoke.sql`) is the safety net: it asserts critical objects exist (RPCs, constraint, view) on every PR. Without it, migration drift would only surface in prod.

### 12.1 — The error taxonomy

> **Medium / Both / 5 min**

**Question.** Open `src/lib/errors.ts`. The `AppError` class has typed `code: AppErrorCode`. Walk through the codes and the safe-message discipline.

**Why this matters.** Errors are a UX surface; the discipline around them is a signal of engineering maturity.

**Expected answer.**

- Codes: `validation_error`, `authentication_error`, `authorization_error`, `not_found`, `conflict`, `rate_limited`, `dependency_failure`, `timeout`, `internal_error`.
- `AppError` carries `code` + `message`; `SAFE_MESSAGES` and `SPECIFIC_MESSAGES` map codes to user-friendly copy.
- `describeError` passes through authored validation messages but filters out infrastructure details: "constraint", "relation", "violates", "syntax", "sql", "pgrst", "null value", "column", "duplicate key", "permission denied for", "function", "database", "supabase". (`src/lib/errors.ts`.)
- Length cap 160 chars on safe messages.
- `classifyError` is a heuristic for when the error isn't an `AppError` (e.g., a thrown exception from a library).
- Result: a database constraint violation never leaks "duplicate key value violates unique constraint" to the user; they get "This brand already exists."

**Anti-answers.**

- "Show the raw error" — leaks infrastructure; security risk.
- "Generic 'Something went wrong'" — useless UX; the `SPECIFIC_MESSAGES` map covers most cases.

**Follow-ups.**

1. What's the migration to add a new error code?
2. How are errors logged to `error_events`?

**Tags.** error, taxonomy, safe-message, ux

---

### 12.2 — `UNSAFE_FRAGMENTS` regex list

> **Easy / Both / 3 min**

**Question.** Open `src/lib/errors.ts` and search for `UNSAFE_FRAGMENTS`. The list contains: "constraint", "relation", "violates", "syntax", "sql", "pgrst", "null value", "column", "duplicate key", "permission denied for", "function", "database", "supabase." Why this list?

**Why this matters.** The list is the explicit barrier between internal errors and UI copy.

**Expected answer.**

- These fragments are the recognizable parts of Postgres / PostgREST / Supabase error messages.
- If any of them appear in the user-facing message, the user sees infrastructure details.
- The list isn't exhaustive — it's the obvious tells. Postgres raises hundreds of specific errors; the list catches the prefix-fragments that are most likely to leak.
- `describeError` checks the message against this list; if any fragment matches, the message is replaced with the `SAFE_MESSAGES[code]` fallback.

**Anti-answers.**

- "Postgres error messages are safe to show" — they reveal schema, sometimes column values; not safe.

**Follow-ups.**

1. What's the migration to add a new fragment?
2. How are false positives handled (e.g., "syntax" in a UI sentence)?

**Tags.** error, unsafe-fragments, security, ux

---

### 12.3 — The 3-second Edge Function timeout

> **Medium / Both / 5 min**

**Question.** Open `supabase/functions/_shared/`. The `parseEdgeFunctionError` and `withTimeout` helpers use a 3-second timeout. Walk through why.

**Why this matters.** An Edge Function that hangs takes seconds-to-minutes to fail; a 3s cap is the UX fix.

**Expected answer.**

- Cloudflare's Edge Gateway returns a 524 (timeout) after ~30 seconds. Without an in-function timeout, the client waits the full duration.
- `withTimeout(promise, 3000)` rejects after 3 seconds; the caller treats the rejection as a `dependency_failure` (mapped from `EDGE_TIMEOUT`).
- Result: a downstream service (e.g., MSG91) that's hanging gets a fast UI failure.
- The 3-second value is configurable; the default trades off UX responsiveness vs. tolerance for slow calls.

**Anti-answers.**

- "Let it time out at the gateway" — too long for UX.
- "Show a spinner indefinitely" — spinner hides the failure from the user.

**Follow-ups.**

1. What's the migration to raise the timeout?
2. What error does a 3s timeout raise?

**Tags.** edge-function, timeout, ux, gateway

---

### 12.4 — The `error_events` ingest pipeline

> **Medium / Both / 5 min**

**Question.** Open `src/lib/errors.ts` and search for `logClientError`. The function inserts into `error_events` best-effort. Walk through the swallow-and-continue pattern.

**Why this matters.** Observability that fails should never break the user flow.

**Expected answer.**

- `logClientError(error, context)` calls `supabase.from('error_events').insert(...)`. The function wraps the call in `try { ... } catch (e) { /* swallow */ }`.
- If the insert fails (network, RLS, server), the error is swallowed. The user flow continues.
- The constraint: `category <> 'compliance.delete'` for client-insertable rows. Logged errors can't pretend to be forensic compliance events.
- Result: the app never crashes because of observability. The trade-off is that some errors don't get logged.

**Anti-answers.**

- "Throw on insert failure" — the user flow crashes when observability is broken.
- "Buffer errors locally" — over-engineering for a v1 product.

**Follow-ups.**

1. What's the migration if you want buffered errors?
2. How is the buffer drained?

**Tags.** error, observability, swallow, swallow-and-continue

---

### 12.5 — Migration ledger drift

> **Hard / Database-engineer / 8 min**

**Question.** Open `docs/deployment/migration-ledger-map.md`. The ledger maps repo migration filenames to live `supabase_migrations.schema_migrations` rows. Walk through why the ledger drifts and how the team handles it.

**Why this matters.** A migration system that lies is worse than no system.

**Expected answer.**

- The Supabase CLI tracks applied migrations in `supabase_migrations.schema_migrations` with the *apply-time* version.
- When a migration is applied via MCP/dashboard (not `supabase db push`), the version is re-stamped to the apply time, not the file name's embedded version.
- Example: repo has `20260626120000_rate_limit_window_created_at.sql`; live shows `20260626141028` (the apply timestamp).
- The drift is *cosmetic* — every repo migration's effects are live (verified via `pg_proc`, `pg_constraint`, `pg_publication_tables`).
- Trust object-level checks, not the ledger. The ledger is for human review; it's not the source of truth.
- The team's response: forward-fix migrations when drift is discovered, not editing applied migrations.

**Anti-answers.**

- "Edit the applied migration to match the file" — forbidden; never edit applied migrations.
- "Reset the schema_migrations table" — dangerous; loses the apply record.

**Follow-ups.**

1. How is drift detected in CI?
2. What's the migration to reconcile the ledger?

**Tags.** migration, drift, ledger, ops

---

### 12.6 — The forward-fix migration pattern

> **Medium / Database-engineer / 5 min**

**Question.** List the migrations that are forward-fixes (drift repairs, not new features). What do they share?

**Why this matters.** Forward-fix migrations are the codebase's discipline; understanding the pattern is required for ops.

**Expected answer.**

- `20260523081444_align_onboarding_step_constraint.sql` — `onboarding_step` CHECK widened to add `'usage'` (was missing on prod).
- `20260523092053_add_list_logs_page.sql` — forward-creates the `list_logs_page` RPC (drift fix from a previously edited migration).
- `20260523171527_fix_list_logs_page_date_cast.sql` — adds `::date` cast.
- `20260524050357_add_daily_summary.sql` — forward-creates `v_daily_summary_user`.
- `20260619000000_error_events_compliance_check.sql` — re-creates the CHECK constraint.
- `20260620130000_realtime_enable.sql` — re-applies realtime publication.
- `20260629000000_erase_pepper_guard.sql` — fail-closed pepper guard.
- `20260706120000_erase_pepper_vault_fallback.sql` — Vault fallback for pepper.
- Shared: each has a header comment explaining the drift or missed prod state. Each is idempotent (`IF NOT EXISTS`, `CREATE OR REPLACE`).

**Anti-answers.**

- "Edit the original migration" — forbidden; never edit applied migrations.

**Follow-ups.**

1. What's the migration if you discover a missing constraint today?
2. How is the forward-fix committed (new branch, fixup commit)?

**Tags.** migration, drift, forward-fix, ops

---

### 12.7 — The CI smoke test

> **Medium / Database-engineer / 5 min**

**Question.** Open `scripts/sql/smoke.sql`. The CI smoke asserts: critical RPCs exist, `error_events_compliance_delete_null_user_check` constraint, `error_events_insert` policy, absence of `error_events_delete`/`_update` policies, `idx_logs_brand` index, `brand_variants` ON DELETE RESTRICT, `v_daily_summary_user` view. Walk through why each assertion matters.

**Why this matters.** A CI smoke that catches the right things is the difference between "ship broke nothing" and "ship silently removed a constraint."

**Expected answer.**

- RPC existence: ensures `create_log_with_rate_limit` etc. are present — the signed-in API.
- `error_events_compliance_delete_null_user_check`: enforces forensic row anonymization.
- `error_events_insert` policy: enforces the layer-1 of tamper resistance.
- Absence of `error_events_delete`/`_update` policies: confirms default-deny is in force.
- `idx_logs_brand` index: confirms keyset-pagination support.
- `brand_variants` ON DELETE RESTRICT: confirms brand-variant invariant.
- `v_daily_summary_user` view: confirms aggregate source.
- These assertions are intentionally cheap; the smoke runs in seconds, even on a small DB.

**Anti-answers.**

- "Just run the full test suite" — the unit tests don't catch migration drift; only the smoke does.

**Follow-ups.**

1. What other assertions would you add?
2. How is the smoke wired into CI?

**Tags.** ci, smoke, migration, drift-detection

---

### 12.8 — The `rls-integration` CI job

> **Medium / Database-engineer / 5 min**

**Question.** Open `.github/workflows/` and `src/tests/rls.integration.test.ts`. The `rls-integration` job runs against a dedicated CI Supabase project. What's the contract?

**Why this matters.** RLS bugs are silent at the unit-test level; integration tests against a real DB are the safety net.

**Expected answer.**

- The job: spin up CI on a separate free-tier Supabase project, apply all migrations, run `rls.integration.test.ts`.
- The tests assert: cross-user isolation on `cigarette_logs`, `record_audit_event` revoke for `authenticated`, `audit_events` SELECT visibility, `error_events` INSERT blocked for `compliance.delete` (H1 layer 1), CHECK constraint block (H1 layer 3), SELECT returns 0 `compliance.delete` rows (H1 layer 2), DELETE on `error_events` returns 0 rows (RLS default-deny), `get_daily_summary` ordering + 366-day cap + `p_to<p_from` rejection, `v_daily_summary_user` RLS respect under direct filter.
- A failure halts the merge. The job is the gate that catches RLS regressions.

**Anti-answers.**

- "RLS can be unit-tested with mocks" — partially; the integration tests catch privilege grants and view `security_invoker` configuration.

**Follow-ups.**

1. How is the CI project seeded?
2. What's the cost of running rls-integration per PR?

**Tags.** rls, ci, integration, drift-detection

---

### 12.9 — Service-role key never enters `NEXT_PUBLIC_*`

> **Easy / Database-engineer / 3 min**

**Question.** The team has a rule: `SUPABASE_SERVICE_ROLE_KEY` is server-only, never `NEXT_PUBLIC_*`, never committed. Walk through why this is a hard rule.

**Why this matters.** A leaked service-role key is a full DB compromise.

**Expected answer.**

- Service role bypasses RLS. A leaked key can read/write every row in every table.
- `NEXT_PUBLIC_*` env vars are bundled into the client JS — anyone can read them from the browser.
- Server-only: the key lives in Edge Function secrets (`supabase functions deploy --no-verify-jwt` configures via the dashboard).
- The `.env*` files are gitignored. Local dev uses `.env.example` as a template; the real values are in `.env.local` (gitignored).

**Anti-answers.**

- "Service role is just like anon, with more permissions" — anon has RLS-bounded permissions; service role has none.
- "It's OK to commit `.env.local` for now" — never.

**Follow-ups.**

1. What's the rotation procedure?
2. How are team members given access?

**Tags.** service-role, secret, env-var, security

---

### 12.10 — The `checkRateLimit` fail-closed pattern

> **Medium / Both / 5 min**

**Question.** Open `supabase/functions/_shared/rateLimit.ts`. The `consume_rate_limit` call is fail-closed (returns `{ ok: false }` on any error). Walk through why.

**Why this matters.** A rate limiter that's fail-open is no rate limiter.

**Expected answer.**

- The helper calls `consume_rate_limit` via a service-role client. If the call fails (network, DB, permission), the helper returns `{ ok: false, reason: 'rate_limit_unavailable' }`.
- The caller treats this as 429 (or equivalent). The user is throttled.
- Fail-open would mean a DB outage causes no rate limiting — abuse window.
- Fail-closed is the correct posture for rate limiting, auth, and audit. The cost is that DB outages cause user-visible throttling; the alternative (abuse) is worse.

**Anti-answers.**

- "Fail-open and degrade gracefully" — fails the rate-limit purpose.
- "Return a default of `{ ok: true }`" — that's fail-open; dangerous.

**Follow-ups.**

1. What's the migration if you want per-Edge-Function rate-limit policy?
2. How are rate-limit errors surfaced to the user?

**Tags.** rate-limit, fail-closed, security, edge-function

---

## Closing checklist for evaluators

After working through the relevant sections for the candidate's role, listen for these signals:

**For data-analytics candidates (Sections 7, 8, 10, 11 + some of 1, 12):**

- **Pass:** Can name the four windows (Day/Week/Month/Year) and explain why `periodSummary.ts` is the single source of truth. Knows `SUM(quantity)` vs `COUNT(*)` and can explain the bug it caused. Correctly identifies `local_date` as IST text and the timezone implications. Knows `round2` and the rounding discipline. Can trace a money value from log entry to chart, citing the storage and display layers.
- **Fail:** Says "the database handles aggregates"; can't name a specific RPC; doesn't know IST discipline; uses US-locale formatting; rounds before storage; can't explain why `price_source` is propagated.

**For database-engineer candidates (Sections 1, 2, 3, 4, 5, 6, 9, 12 + some of 7, 8):**

- **Pass:** Can explain the initplan pattern (Section 2.1) and why it matters for query perf. Knows `SET search_path = ''` and the attack it prevents. Can describe the audit pepper chain (GUC → Vault → fail-closed). Correctly identifies the four layers of `error_events` tamper resistance. Knows the six layers of `delete-account`. Can name every RLS policy and the corresponding table. Explains the `created_at` window choice for the log rate limit.
- **Fail:** Says "RLS is automatic in Supabase"; doesn't know what `SET search_path = ''` does; thinks the audit pepper is just a hash; can't explain the difference between `audit_events` and `error_events`; doesn't know what TOCTOU means in the rate-limiter context; thinks the `rate_limit_counters` deny policy is redundant.

**For both roles (Sections 4, 12):**

- **Pass:** Can describe the DPDP export + erase + audit trio. Knows what "DPDP-best-effort" means. Understands migration drift and the forward-fix pattern. Can describe the error taxonomy and the safe-message discipline.
- **Fail:** Doesn't know what DPDP is (or assumes full compliance); thinks audit rows are deleted with the user; doesn't know the migration ledger can drift.

**Hard-question pass:** Produces a coherent alternative and identifies the migration cost, OR defends the current choice with three concrete failure modes.

**Hard-question fail:** Vague answer ("use a queue", "use Redis", "use materialized views") without explaining the trade-off.

---

## Appendix — file:line index

A non-exhaustive map of where the most-cited files appear:

- `supabase/migrations/20250426120000_initial_schema.sql` — schema bootstrap, FK actions, `handle_new_user` trigger.
- `supabase/migrations/20260504000000_enhancements.sql` — facts, milestones, `v_mood_trigger_heatmap`, `get_random_facts`.
- `supabase/migrations/20260519100000_hardening_and_compliance.sql` — `audit_events`, `error_events`, compliance columns.
- `supabase/migrations/20260519130000_brand_catalog_expansion.sql` — 41 international brands, `sync_default_brand_catalog`.
- `supabase/migrations/20260520000000_security_correctness.sql` — `SET search_path=''`, idempotency, running mean, audit props redaction, `error_events` 4-layer, `create_log_with_rate_limit`, `v_daily_summary_user`.
- `supabase/migrations/20260521000000_audit_export_ops.sql` — `audit_events.user_id` SET NULL, keyset export, `record_audit_event` revoke.
- `supabase/migrations/20260523081444_align_onboarding_step_constraint.sql` — onboarding CHECK widen (forward-fix).
- `supabase/migrations/20260523092053_add_list_logs_page.sql` — list_logs_page (forward-fix).
- `supabase/migrations/20260523092236_add_rate_limit_counters.sql` — `rate_limit_counters` + `consume_rate_limit`.
- `supabase/migrations/20260523171527_fix_list_logs_page_date_cast.sql` — `::date` cast (forward-fix).
- `supabase/migrations/20260524050357_add_daily_summary.sql` — daily summary view (forward-fix).
- `supabase/migrations/20260531075255_lockdown_secdef_execute.sql` — EXECUTE revoke.
- `supabase/migrations/20260531080049_scale_forward_indexes.sql` — composite indexes for keyset.
- `supabase/migrations/20260601000000_catalog_2026_refresh.sql` — 2026 MRP refresh.
- `supabase/migrations/20260601120000_indian_brand_catalog_expansion.sql` — 38 Indian brands.
- `supabase/migrations/20260602000000_perf_rls_initplan_indexes.sql` — initplan RLS, `v_daily_summary_user security_invoker`.
- `supabase/migrations/20260605000000_european_brand_catalog.sql` — 22 European brands.
- `supabase/migrations/20260606000000_realtime_publications.sql` — initial publication (some drift).
- `supabase/migrations/20260616181124_profile_identity_fields.sql` — identity columns, immutability trigger.
- `supabase/migrations/20260619000000_error_events_compliance_check.sql` — layer-4 CHECK (forward-fix).
- `supabase/migrations/20260619180000_rate_limit_counters_explicit_deny.sql` — explicit deny policy.
- `supabase/migrations/20260620120000_indian_brand_catalog_2026_expansion.sql` — 17 more Indian brands.
- `supabase/migrations/20260620130000_realtime_enable.sql` — realtime publication re-apply (forward-fix).
- `supabase/migrations/20260621000000_daily_summary_sum_quantity.sql` — `SUM(quantity)` fix.
- `supabase/migrations/20260622000000_realtime_brands.sql` — brands + variants to publication.
- `supabase/migrations/20260626120000_rate_limit_window_created_at.sql` — `created_at` window.
- `supabase/migrations/20260628120000_facts_cravings.sql` — recovery category facts.
- `supabase/migrations/20260629000000_erase_pepper_guard.sql` — fail-closed pepper.
- `supabase/migrations/20260629000001_facts_cravings_category.sql` — cravings CHECK widening.
- `supabase/migrations/20260706120000_erase_pepper_vault_fallback.sql` — Vault fallback for pepper.
- `src/db/repositories/_supabase.ts` — error mapping.
- `src/db/repositories/{brands,facts,goals,logs,profile,settings,summary}.ts` — repository layer.
- `src/domain/{age,calc,correlations,goals,goalForm,health,insights,periodSummary,savings}.ts` — pure domain.
- `src/lib/{validation,errors,date,format,discreet}.ts` — shared utilities.
- `src/store/{auth,session,onboardingDraft,theme}.ts` — Zustand.
- `supabase/functions/{audit-record,delete-account,send-sms-otp}/index.ts` + `_shared/*`.
- `docs/spec/{00-glossary,01-architecture,02-data-model,03-auth,04-identity-profile,05-logging,06-goals-insights,07-celebrations,08-security-privacy,09-infra-ops}.md`.
- `docs/security/sovereignty-audit-2026-06.md`, `docs/runbooks/audit-pepper-rotation.md`, `docs/deployment/migration-ledger-map.md`.
- `DESIGN.md`, `PRODUCT.md`.

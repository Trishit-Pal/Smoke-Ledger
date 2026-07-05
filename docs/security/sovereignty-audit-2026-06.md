# Data-sovereignty audit — 2026-06

**Scope:** Smoke Ledger India live Supabase project `tvcwrsglceahkjnfuzkn`
(`Smoke-Ledger`, us-east-2). **Method:** read-only — Supabase MCP `execute_sql`
against system catalogs + `get_advisors`, plus `scripts/verify-sovereignty.mjs`
(anon client). No writes, no service-role key, no schema changes. Point-in-time
snapshot; re-run via the [`release-preflight`](../../.claude/skills/release-preflight/SKILL.md)
skill before each launch.

## Summary

| Area | Result |
|------|--------|
| RLS coverage (public tables) | ✅ All 13 tables `RLS ENABLED` |
| Anon default-deny (live probe) | ✅ 0 tenant rows readable by anon; data-rights RPCs + delete-account reject anon |
| `SECURITY DEFINER` search_path hygiene | ✅ All 15 functions pin an explicit (non-caller) search_path |
| `error_events` audit immutability | ✅ All 3 layers present (layer-3 CHECK restored via `20260619000000_error_events_compliance_check`, verified live 2026-07-05) |
| RPC grant model | ✅ Matches the by-design signed-in API surface |
| Security advisors | ✅ Only known-accepted WARN/INFO (leaked-password toggle + by-design + rate_limit_counters) |
| Performance advisors | ✅ Only 4 unused-index INFO on `cigarette_logs` (no data pre-launch) |

**One actionable finding** (MEDIUM, backlog — not fixed in this additive phase
because it requires a migration): the documented third immutability layer is
missing from the live DB. Details in §4.

## 1. RLS coverage

All 13 `public` base tables have `relrowsecurity = true`:
`audit_events`, `brand_variants`, `brands`, `cigarette_logs`, `error_events`,
`goals`, `price_entries`, `rate_limit_counters`, `reminders`, `settings_kv`,
`usage_events`, `user_facts_seen`, `user_profiles`.

`rate_limit_counters` is RLS-enabled with **no policy** — intentional
(service-role-only, hard default-deny). Confirmed below: an anon `SELECT` is
rejected with `42501`.

## 2. Anon default-deny (live, `verify-sovereignty.mjs`)

Every tenant table returned **0 rows or a permission rejection** to the anon
client; `rate_limit_counters` hard-denied (`42501`); the three data-rights RPCs
(`export_account_data`, `erase_account_data`, `record_audit_event`) rejected the
anon caller; and `POST /functions/v1/delete-account` without a JWT returned
**401**. 17/17 invariants hold. Reproduce:

```bash
NEXT_PUBLIC_SUPABASE_URL=… NEXT_PUBLIC_SUPABASE_ANON_KEY=… npm run verify:sovereignty
```

## 3. SECURITY DEFINER hygiene

15 `SECURITY DEFINER` functions in `public`. 13 pin `search_path = ''` (empty —
the convention for the user-facing API). Two pin an explicit, non-caller path
appropriate to their job and are therefore **not** vulnerable to search-path
hijack:

| Function | Pinned search_path | Verdict |
|----------|--------------------|---------|
| `refresh_seed_prices_from_catalog` | `smoke_seed, public` | ✅ pinned (reads the seed catalog) |
| `rls_auto_enable` | `pg_catalog` | ✅ pinned (admin/DDL helper) |
| all other 13 | `''` | ✅ |

No function inherits the caller's search_path. No action required.

## 4. `error_events` audit immutability — MEDIUM finding — **RESOLVED 2026-07-05**

> **Status update (2026-07-05):** migration
> `20260619000000_error_events_compliance_check.sql` (live ledger row
> `20260619075741`) added the layer-3 constraint. Verified in `pg_constraint`:
> `error_events_compliance_delete_null_user_check`
> `CHECK (category <> 'compliance.delete' OR user_id IS NULL)`. All three
> layers are now live. Original finding kept below for the record.

Genuine compliance-delete audit rows are written by the edge function
(service-role) with `user_id = NULL`. Intended enforcement is three layers; the
live DB has the first two but **not** the third:

| Layer | Mechanism | Live status |
|-------|-----------|-------------|
| 1 | RLS INSERT policy `error_events_insert` — `WITH CHECK (user_id = auth.uid())` so `authenticated` cannot write a null-user (real) compliance row | ✅ present |
| 2 | No UPDATE/DELETE policy for `authenticated` → genuine rows are immutable to users (only `error_events_select` with `USING (user_id = auth.uid())` and the insert policy exist) | ✅ present |
| 3 | DB CHECK constraint forcing `user_id IS NULL` when `category = 'compliance.delete'` (documented as `error_events_compliance_delete_null_user_check`) | ❌ **absent** — only `*_category_len_check`, `*_details_size_check`, `*_message_len_check` exist; no such constraint and no enforcing trigger |

**Impact:** the *real* audit trail remains tamper-proof — genuine rows are
invisible (`user_id = NULL ≠ auth.uid()`) and unmodifiable by users. The gap is
defense-in-depth: an authenticated user can insert a **self-attributed**
`compliance.delete` row (`user_id =` their own uid, visible only to themselves).
Any analytics/query that filters `category = 'compliance.delete'` **without** also
requiring `user_id IS NULL` could be polluted by such forged self-rows.

**Recommendation (backlog, needs a migration — out of scope for this
additive-only phase):** either (a) add the CHECK constraint to restore the
documented layer-3 invariant, or (b) require `user_id IS NULL` in every
compliance-delete query and amend the docs to describe 2-layer enforcement.
This is a textbook case of the repo-migrations-vs-live drift noted in the
project's verification guidance — the docs claim a constraint the live DB lacks.

## 5. RPC grant model

The 11 `authenticated`-EXECUTE SECURITY DEFINER RPCs are the **signed-in API
surface** and are correct by design (`create_log_with_rate_limit`,
`erase_account_data`, `export_account_data`, `get_daily_summary`,
`get_health_milestones`, `get_random_facts`, `list_logs_page`, `mark_fact_seen`,
`refresh_seed_prices_from_catalog`, `seed_default_brands_if_empty`,
`sync_default_brand_catalog`). `record_audit_event` is rejected for anon
(verified §2). The Supabase advisor lists the 11 as
`authenticated_security_definer_function_executable` WARNs — **accepted by
design**, not action items.

## 6. Advisors

- **Security:** `rls_enabled_no_policy` INFO on `rate_limit_counters`
  (intentional); 11 `authenticated_security_definer_function_executable` WARNs
  (by design); `auth_leaked_password_protection` WARN (operator toggle — tracked
  in the ops checklist). No new/unexpected advisor.
- **Performance:** 4 `unused_index` INFO on `cigarette_logs`
  (`idx_logs_brand_id`, `idx_logs_user_ts_brand`, `idx_logs_user_created`,
  `idx_logs_user_ts_trigger`) — expected with no production data yet; revisit
  post-launch once query patterns are real.

## Reproduce this audit

```bash
# anon default-deny (no secrets beyond the public anon key)
NEXT_PUBLIC_SUPABASE_URL=… NEXT_PUBLIC_SUPABASE_ANON_KEY=… npm run verify:sovereignty

# catalog-level checks (read-only) via Supabase MCP:
#   - RLS:        pg_class.relrowsecurity for nspname='public'
#   - search_path: pg_proc.proconfig where prosecdef
#   - audit:      pg_policy + pg_constraint + pg_trigger on error_events
#   - advisors:   get_advisors(security) + get_advisors(performance)
```

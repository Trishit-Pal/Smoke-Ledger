---
section: security-privacy
sources:
  - supabase/migrations/**
  - supabase/functions/**
  - web/middleware.ts
  - web/lib/supabase/server.ts
  - web/lib/supabase/admin.ts
  - web/app/auth/callback/route.ts
  - docs/security/**
last_verified_commit: bf62af4
status: current
---

# Security and Privacy

## Purpose

Every row in the database belongs to exactly one user, and no code path should ever let one user read or modify another user's data. Beyond that basic isolation guarantee, the system needs a small number of privileged operations — deleting an account, exporting all data, recording compliance audit events — that require elevated authority without handing that authority to the client. This section describes how those two problems are solved and how the DPDP-oriented deletion flow keeps a verifiable audit record even after the user's identity is gone.

## What the user experiences

From a user's perspective, the security model is invisible until they need it. If they open the app on a different device, they see only their own data. If they tap "Erase data" in Settings, everything disappears and onboarding resets — but they are still logged in. If they tap "Delete account", their login is removed and they are signed out. In both cases they receive no error, no partial state, and no confirmation that anyone else's data was involved.

The only visible privacy surface is the data export: a JSON file containing every log, goal, brand, reminder, setting, audit event, and profile field that belongs to them. The export paginates in chunks of 5 000 rows and produces a `truncated: true` flag if the safety cap of 200 pages is ever reached (roughly 270 years of daily use at 10 sticks per day — effectively never).

## How it works

### The RLS model

Every table in the `public` schema has Row Level Security enabled. This was confirmed live against project `tvcwrsglceahkjnfuzkn` on 2026-06-19 — all 13 base tables have `relrowsecurity = true`:

`audit_events`, `brand_variants`, `brands`, `cigarette_logs`, `error_events`, `goals`, `price_entries`, `rate_limit_counters`, `reminders`, `settings_kv`, `usage_events`, `user_facts_seen`, `user_profiles`.

The policy shape for most user-owned tables is a single FOR ALL policy that gates both `USING` and `WITH CHECK` on `user_id = (select auth.uid())`. The `(select ...)` wrapper is important: it causes Postgres to evaluate `auth.uid()` once as an InitPlan rather than once per row, which matters for table scans on large log sets. The rewrite was applied in `supabase/migrations/20260602000000_perf_rls_initplan_indexes.sql:22–46`.

`rate_limit_counters` is the exception. It has RLS enabled but carries no policy at all, making it default-deny to every non-service-role caller. Only the `consume_rate_limit` SECURITY DEFINER function can touch it, and that function is granted only to `service_role`. An anon `SELECT` returns `42501`. This table is intentionally invisible to both `anon` and `authenticated` roles — nothing about its contents should ever be client-readable.

**Realtime is gated by the same RLS.** `cigarette_logs`, `goals`, `user_profiles`, `brands`, and `brand_variants` are in the `supabase_realtime` publication (`supabase/migrations/20260620130000_realtime_enable.sql`, brands added in `20260622000000_realtime_brands.sql`). Supabase applies each table's RLS SELECT policy before delivering any `postgres_changes` event to a subscriber, so realtime cannot leak another user's rows — a subscriber only receives changes to rows it could already SELECT (`user_id = auth.uid()` / `id = auth.uid()`). The client-side `filter` is defense-in-depth, not the primary guard. `REPLICA IDENTITY FULL` on the `user_id`-filtered tables affects only the internal WAL stream (so DELETE events carry `user_id`); it exposes nothing extra to clients.

`audit_events` and `error_events` have split policies. `audit_events` allows SELECT (own rows only) but has no INSERT policy for `authenticated` — clients cannot write directly to it; they call Edge Functions which use the service-role client. `error_events` allows SELECT and INSERT for own rows, but has no UPDATE or DELETE policy for `authenticated`, so users cannot modify rows once written. The INSERT policy explicitly blocks `category = 'compliance.delete'` for authenticated users (`supabase/migrations/20260520000000_security_correctness.sql:254–255`).

### SECURITY DEFINER + search_path hygiene

All 16 `SECURITY DEFINER` functions in `public` pin an explicit `search_path`. Fourteen pin `search_path = ''` (the empty string), which means every object reference inside the function body must be schema-qualified or the function errors. Two pin a non-empty path appropriate to their job:

- `refresh_seed_prices_from_catalog` pins `smoke_seed, public` because it needs to read the seed catalog schema.
- `rls_auto_enable` pins `pg_catalog` because it is a DDL helper that works in system catalogs.

No function inherits the caller's search_path. This matters because a SECURITY DEFINER function runs with the privileges of the function owner (typically the Supabase table owner), not the calling role. If it inherited the caller's search_path, a sufficiently creative caller could shadow `public.some_table` with a same-named table in a schema they control and redirect the function's queries. Pinning to `''` closes that vector entirely. The previous 15 functions were confirmed live via `pg_proc.proconfig` on 2026-06-19.

**anon default-deny.** `20261030000000_security_hardening.sql` revokes every `anon` grant on public tables, sequences and functions, removes the default grants to `anon` for future objects, and drops the built-in PUBLIC `EXECUTE` default for functions the migration role creates. `anon` also inherits `EXECUTE` through PUBLIC on functions that already exist, so every `SECURITY DEFINER` function is revoked `FROM PUBLIC, anon` explicitly (enforced by `src/tests/security-migrations.test.ts`). `scripts/sql/smoke.sql` fails CI if `anon` can execute any public `SECURITY DEFINER` function or holds any public table privilege.

The user-facing RPCs that `authenticated` may call are: `create_log_with_rate_limit`, `erase_account_data`, `export_account_data`, `get_daily_summary`, `get_health_milestones`, `get_random_facts`, `list_logs_page`, `mark_fact_seen`, `refresh_seed_prices_from_catalog`, `seed_default_brands_if_empty`, `sync_default_brand_catalog`.

The service-role-only / internal functions — `consume_rate_limit`, `handle_new_user`, `record_audit_event`, `rls_auto_enable`, `purge_rate_limit_counters` — have had `EXECUTE` revoked from both `anon` and `authenticated`. `handle_new_user` fires as a trigger on `auth.users`; trigger execution does not require an EXECUTE grant on the function, so signup is unaffected. The former `auth_email_exists` email-existence oracle is dropped by the hardening migration.

### The DPDP export and erase RPCs

`export_account_data` (`supabase/migrations/20260521000000_audit_export_ops.sql:29–287`) returns a versioned JSON payload. The first page includes profile, brands, goals, settings, reminders, price entries, usage events, audit events, and facts-seen. Subsequent pages return only the next chunk of cigarette logs, using `(ts_utc, id)` DESC keyset cursors for stable, gap-free pagination. The RPC is bounded: `p_limit` is clamped between 100 and 5 000. Each call to the first page appends an `account_data_exported` row to `audit_events` so there is a record of every export request.

`erase_account_data` (`supabase/migrations/20260521000000_audit_export_ops.sql:303–369`) runs as the calling user (it reads `auth.uid()` internally — the Edge Function intentionally calls it with the user's bearer token, not the service-role client, so `auth.uid()` resolves correctly). It:

1. Computes `user_hash = sha256(uid || ':' || pepper)` using `extensions.digest` and the `app.audit_pepper` GUC (or the Vault secret `audit_pepper`).
2. Rewrites all `audit_events` rows for this user: nulls out `user_id`, replaces `props_json` with `{"hashed_user_id": "<hash>"}`.
3. Patches all `error_events` rows for this user: adds `hashed_user_id` to `details_json`, nulls out `user_id`.
4. Deletes all product data (logs, brands, variants, goals, reminders, settings, price entries, usage events, facts seen).
5. Resets the profile row, including the otherwise-immutable `full_name`, `date_of_birth`, `gender`, plus `mobile_e164` and `place` (it sets the transaction-local `app.erasing` flag, which `enforce_profile_identity_rules` honours), and sets `deleted_at = now()`.
6. Re-seeds default brands via `smoke_seed.apply_default_brands(uid)`.
7. Inserts a final `account_data_erased` audit event with `prior_identity_erased: true` (still attributed to the live user, since auth deletion comes later). That row is the record that the user's earlier name / DOB / gender existed before they re-entered new ones.

After `erase_account_data` returns, the `delete-account` Edge Function calls `auth.admin.deleteUser(userId)`, which cascades through foreign keys and removes anything the erase step missed (defense-in-depth against future schema drift). If `erase_account_data` fails for any reason, the function aborts without calling `deleteUser` — the user's auth row stays intact and they can retry (`supabase/functions/delete-account/index.ts:183–194`).

### The peppered audit hash

The pepper is a 32-byte random secret stored as the `AUDIT_PEPPER` Edge Function environment variable and surfaced inside the DB as the `app.audit_pepper` GUC. Two functions use it:

- `delete-account/index.ts` — `hashWithPepper(user.id, AUDIT_PEPPER)` is written into the compliance delete row in `error_events` before the user is erased, and the IP is hashed the same way for the audit row and rate-limit key. The function returns `server_misconfigured` (500) if `AUDIT_PEPPER` is unset rather than storing a reversible hash; `send-sms-otp` does the same, since it keys the phone rate-limit bucket on the peppered hash.
- `audit-record/index.ts:81` — the same hash appears in log output when a user hits the audit-record rate limit.

The hash is computed in `supabase/functions/_shared/hash.ts` using `crypto.subtle.digest('SHA-256', ...)`. The pepper is what makes the retained audit rows non-reversible: once `auth.users` is purged, the hashed id has no public counterpart to correlate against. Rotation of the pepper (procedure in `docs/runbooks/audit-pepper-rotation.md`) severs forensic continuity across the rotation boundary — existing hashes in `error_events` remain inert.

Inside the DB the same `<id>:<pepper>` form is expressed using `extensions.digest` (pgcrypto): `encode(extensions.digest(uid::text || ':' || pepper, 'sha256'), 'hex')` (`20261030000000_security_hardening.sql`). Rows anonymized before that migration used `uid || pepper` with no colon; to correlate one, hash the candidate id both ways.

### Compliance delete row tamper-resistance

A `compliance.delete` row in `error_events` is the surviving proof that a deletion happened. It is written by the service-role client in `delete-account/index.ts:164–169` with `user_id = null`, so RLS SELECT (which requires `user_id = auth.uid()`) makes it invisible to any authenticated user. Three layers enforce this:

**Layer 1 — RLS INSERT policy.** `error_events_insert` (`supabase/migrations/20260520000000_security_correctness.sql:254–255`) allows authenticated users to insert rows where `user_id = auth.uid() AND category <> 'compliance.delete'`. They cannot insert a null-user row, and they cannot insert a row in the compliance.delete category at all.

**Layer 2 — No UPDATE or DELETE policy.** `authenticated` has no policy for UPDATE or DELETE on `error_events`, so RLS default-deny applies. A user cannot modify or delete any `error_events` row, including rows they wrote themselves.

**Layer 3 — CHECK constraint.** `error_events_compliance_delete_null_user_check` enforces `category <> 'compliance.delete' OR user_id IS NULL` at the DB level. This closes the gap where future code might accidentally insert a user-owned `compliance.delete` row that would then be readable by that user.

Its history is the repo's canonical migrations-can-lie example: the constraint was declared in `20260520000000_security_correctness.sql:271–277`, but that block was edited after the migration had already been applied, so it never reached the live DB. The June 2026 sovereignty audit (`docs/security/sovereignty-audit-2026-06.md:§4`) correctly found it absent; `20260619000000_error_events_compliance_check.sql` (live ledger row `20260619075741`) restored it idempotently. Last verified live via `pg_constraint` on 2026-07-06.

### Service-role-only surfaces

The following are reachable only with the service-role key and are never handed to browser clients:

- `consume_rate_limit` RPC — backs the Edge Function rate limiter; `EXECUTE` granted only to `service_role` (`supabase/migrations/20260523092236_add_rate_limit_counters.sql:62–63`).
- `rate_limit_counters` table — RLS enabled, no policy, hard default-deny to all non-service-role callers. Emails, phone numbers and IPs are stored only as keyed hashes: edge functions use `hashWithPepper(value, AUDIT_PEPPER)` (`_shared/hash.ts`), the web limiter an HMAC keyed on the service-role key. Per-user buckets in `audit-record` and `delete-account` still key on the raw user UUID (`user:<id>`). The hardening migration deletes every pre-hashing row once, enables `pg_cron` (guarded) and schedules `purge_rate_limit_counters()` daily at 03:17 to drop rows older than 2 days. The migration only warns if pg_cron cannot be enabled; `scripts/sql/smoke.sql` fails if pg_cron is installed but the job is missing. Verify production after deploy with `select * from cron.job`.
- `record_audit_event` RPC — `EXECUTE` revoked from `authenticated` in `supabase/migrations/20260521000000_audit_export_ops.sql:295–297`; re-granted only to `service_role`. The `audit-record` Edge Function verifies the caller's JWT with the anon client first, then writes through the service-role client.
- `auth.admin.deleteUser` — called only by `delete-account/index.ts:198`; requires `SUPABASE_SERVICE_ROLE_KEY`, which is an Edge Function secret and a server-side Vercel env var, never a `NEXT_PUBLIC_*` value.

The `audit-record` Edge Function (`supabase/functions/audit-record/index.ts`) validates the incoming bearer token via `supabase.auth.getUser()` on the anon client before touching the service-role client, which means a request without a valid JWT is rejected at line 69 before any write happens. The allowlist of valid event types and categories lives in `supabase/functions/_shared/auditAllowlist.ts:3–28`. Props are redacted through a PII denylist (email, phone, Aadhaar, PAN, OTP, tokens, etc.) in `redactAuditProps` (`supabase/functions/_shared/auditAllowlist.ts:74–101`) and the parallel `_redact_audit_props` SQL function (`supabase/migrations/20260520000000_security_correctness.sql:149–188`).

### Origin allowlist and CORS

Edge Functions check `req.headers.get('origin')` against an allowlist in `supabase/functions/_shared/cors.ts:38–49`. Non-browser clients (native mobile, curl) send no `Origin` header and are accepted — the bearer token is the real gate. In production, `ALLOWED_ORIGINS` must be a comma-separated list of explicit origins; the wildcard `*` is only accepted when `ENVIRONMENT != production`. Disallowed origins receive no `Access-Control-Allow-Origin` header rather than the literal string `'null'`.

### Re-authentication gate on account deletion

`delete-account/index.ts:139–147` checks that `user.last_sign_in_at` is within the configured window (default 15 minutes, tunable via `REAUTH_WINDOW_MIN`). This blocks a stolen refresh token from being used to delete the account; the attacker would need a recent full authentication, not just a long-lived session token.

The Edge Function also applies dual rate limiting: per-IP (hashed with SHA-256) and per-user, both capped at 5 requests per 10 minutes. Both use `consume_rate_limit` via the service-role client and fail closed — if the Postgres call fails, the function returns 429 rather than silently disabling the gate.

## Invariants

These rules must not break:

1. All 13 public base tables have RLS enabled. A new table that stores user data must have `ENABLE ROW LEVEL SECURITY` in its migration before the migration lands on production.

2. Every SECURITY DEFINER function in `public` must pin `search_path` explicitly. `search_path = ''` is the default; any deviation requires a written justification in the migration comment (see the two exceptions above).

3. `rate_limit_counters` must have no RLS policy. Its protection is the absence of any policy — default-deny — combined with `EXECUTE` being restricted to `service_role` on `consume_rate_limit`.

4. `record_audit_event` must not be callable by `authenticated`. The grant history in `20260521000000_audit_export_ops.sql:295–297` and `20260531075255_lockdown_secdef_execute.sql:33–39` enforces this; any migration that re-grants `EXECUTE` to `authenticated` would be a regression.

5. `compliance.delete` rows in `error_events` must have `user_id = null`. The CHECK constraint `error_events_compliance_delete_null_user_check` enforces this at the DB level. Do not drop this constraint.

6. `erase_account_data` must be called before `auth.admin.deleteUser`. If the erase fails, deletion must abort. The ordering in `delete-account/index.ts:183–198` enforces this.

7. `AUDIT_PEPPER` must never appear in source code, logs, or environment variables accessible to client bundles. It lives only in the Edge Function secrets dashboard and in the `app.audit_pepper` GUC (which is set per `docs/runbooks/audit-pepper-rotation.md`).

8. The `v_daily_summary_user` view must have `security_invoker = true` so that RLS on the underlying `cigarette_logs` table applies when authenticated users query it directly. Set in `supabase/migrations/20260602000000_perf_rls_initplan_indexes.sql:57`.

## Edge cases and gotchas

**Erase vs delete are different operations.** "Erase data" wipes product tables and anonymizes audit rows but keeps the auth identity — the user can log back in and re-onboard. "Delete account" removes the auth identity entirely. Callers that conflate the two will produce confusing UI; the distinction is documented in `docs/deployment/production-ops-checklist.md:200–204`.

**`erase_account_data` must run as the user, not as service-role.** The function reads `auth.uid()` internally. Calling it with a service-role client would yield `auth.uid() = null` and the function would raise `42501`. The Edge Function deliberately passes the user's bearer token (`supabaseUser.rpc('erase_account_data')` at `delete-account/index.ts:183`).

**Anonymized audit rows are invisible to the user after erase.** Once `erase_account_data` nulls out `user_id`, the SELECT policy (`user_id = auth.uid()`) can no longer match those rows. An export performed after erase will show an empty `auditEvents` array. This is correct behavior, not data loss.

**The compliance delete audit insert is best-effort.** The `try/catch` at `delete-account/index.ts:157–173` catches audit insert failures and logs a warning rather than aborting. A failed audit insert means the compliance record may be missing, but the user-requested deletion proceeds. This is intentional: the alternative — blocking account deletion because the audit table was temporarily unavailable — would be a worse outcome for the user.

**Export pagination uses a `(ts_utc, id)` composite cursor, not a numeric offset.** This is stable under concurrent inserts. An offset-based cursor would drift if new rows were written during a multi-page export. The cursor semantics are defined at `supabase/migrations/20260521000000_audit_export_ops.sql:62–65`.

**The error_events INSERT policy was tightened twice.** The initial policy in `20260519100000_hardening_and_compliance.sql:68` allowed `user_id IS NULL OR user_id = auth.uid()` (permissive). It was replaced in `20260520000000_security_correctness.sql:254–255` to require `user_id = auth.uid() AND category <> 'compliance.delete'` (restrictive). The CHECK constraint was added in the same migration. Any audit of the policy history should be read in migration order.

**The log rate limit counts on `created_at`, not `ts_utc`.** Backdated logs (up to 24h) made `ts_utc` user-controlled, so counting the 50-per-hour window on it let a user evade the cap by backdating every insert. `supabase/migrations/20260626120000_rate_limit_window_created_at.sql` moved the window to the server-set `created_at`. Own-account abuse only, but it protects free-tier write volume.

**The `v_daily_summary_user` view had an RLS bypass until migration `20260602000000`.** Before that migration added `security_invoker = true`, the view ran with owner privileges and bypassed RLS — a signed-in user could read any other user's daily aggregates by querying the view directly with a `user_id` filter. The fix is in place. The `get_daily_summary` RPC path was never affected (it filters by `auth.uid()` explicitly), but direct PostgREST access to the view was the hole.

## Tests

**Unit — props redaction.** `src/tests/services.audit.test.ts` tests `redactAuditProps` directly: strips PII denylist keys (email, password, token), truncates long strings to 200 characters, and drops non-primitive values. Also tests `isAuditSuccessStatus`.

**Unit — export pagination.** `src/tests/exportAccountData.test.ts` tests the client-side pagination loop in `exportAccountData()`: loops until `hasMore = false`, merges log pages, throws on RPC error, sets `truncated = true` when the 200-page cap is hit (runs exactly 200 RPC calls), and sets `truncated = false` when the RPC signals natural completion.

**Integration — RLS cross-user isolation.** `src/tests/rls.integration.test.ts` runs against a live Supabase CI project (skipped when `E2E_*` env vars are absent). It proves:
- User B cannot read or delete a log row written by User A.
- `record_audit_event` is rejected (`42501`) for `authenticated` callers after the revoke.
- User A can read their own `audit_events`.
- `error_events` INSERT with `user_id = null` and `category = 'compliance.delete'` is blocked for authenticated users (H1 layer 1).
- `error_events` INSERT with `user_id = auth.uid()` and `category = 'compliance.delete'` is blocked by the CHECK constraint (H1 layer 3).
- SELECT on `error_events` returns zero `compliance.delete` rows for any authenticated user (H1 layer 2 / SELECT policy).
- DELETE on `error_events` affects 0 rows for authenticated users (RLS default-deny, no DELETE policy).
- `get_daily_summary` returns rows in DESC date order, rejects ranges over 366 days, and rejects `p_to < p_from`.
- `v_daily_summary_user` view respects RLS: User B cannot see User A's rows even via a direct `user_id` filter on the view.

The `rls-integration` CI job is configured as a required branch protection check (`docs/deployment/production-ops-checklist.md:§6e`).

**Live sovereignty probe.** `scripts/verify-sovereignty.mjs` (invoked as `npm run verify:sovereignty`) tests 17 invariants against the live project using only the public anon key: zero rows readable across all tenant tables, anon rejection of all data-rights RPCs, and `POST /functions/v1/delete-account` returning 401 without a JWT. Results are documented in `docs/security/sovereignty-audit-2026-06.md`.

## Open gaps

**`app.audit_pepper` was found unset on the live DB (2026-07-05).** The pepper guard (below) is live, so every `erase_account_data` call currently fails with `P0001` until the operator runs `ALTER DATABASE postgres SET app.audit_pepper = '<AUDIT_PEPPER value>'` in the SQL editor. This is fail-closed working as designed — erasure is blocked rather than writing a reversible hash — but it means the DPDP erase right is unavailable until the GUC is set. Tracked as an open operator action.

**Leaked-password protection is a dashboard toggle, not enforced by code.** The Supabase advisor flags `auth_leaked_password_protection` as a WARN because the toggle must be enabled manually in the dashboard (Authentication → Security → Password Strength). It cannot be set via migration. The ops checklist tracks it (`docs/deployment/production-ops-checklist.md:§2`), but there is no automated gate that fails the build if it is off.

## Resolved gaps

**AUDIT_PEPPER guard added** (`supabase/migrations/20260629000000_erase_pepper_guard.sql`). `erase_account_data` now raises `P0001` immediately if `current_setting('app.audit_pepper', true)` returns an empty string, preventing a trivially reversible audit hash on freshly linked CI/staging projects where only the Edge Function secret is configured.

**Stale spec manifest resolved.** `web/lib/server/auth.ts` did not exist — the web app's server-side auth logic lives in `web/middleware.ts` (session gate, consent funnel, CSP), `web/lib/supabase/server.ts` (server Supabase client), `web/lib/supabase/admin.ts` (service-role client), and `web/app/auth/callback/route.ts` (OAuth/magic link callback). The `sources:` frontmatter has been updated to reflect the real files.

**The `compliance.delete` CHECK constraint discrepancy is resolved.** The June 2026 sovereignty audit marked `error_events_compliance_delete_null_user_check` as absent (MEDIUM finding) — correctly: the `20260520000000` constraint block was edited post-apply and never reached live. `20260619000000_error_events_compliance_check.sql` restored it; re-verified live via `pg_constraint` on 2026-07-06. The finding is closed.

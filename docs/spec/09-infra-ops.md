---
section: infra-ops
sources:
  - package.json
  - web/package.json
  - metro.config.js
  - app.json
  - app.config.js
  - eas.json
  - .github/**
  - docs/deployment/**
  - docs/runbooks/**
last_verified_commit: 12e2d88
status: current
---

# Infrastructure & Ops

## Purpose

Smoke Ledger India is a single-developer product running entirely on free tiers: Supabase for the database and Edge Functions, Vercel for the Next.js web app, and Expo Application Services (EAS) for mobile builds. This section describes what those tiers actually allow, how the CI pipeline guards the product before anything reaches users, what the deployment sequence looks like, and which runbooks exist for the things that go wrong.

## What the user experiences

Users don't see any of this directly, but they feel it. If the Supabase free tier gets paused (after a week of inactivity), their app stops working and they get auth errors. If the built-in Supabase mailer hits its hourly cap during a signup surge, they never receive a confirmation email and believe the product is broken. If `ALLOWED_ORIGINS` is not set on the edge functions, the delete-account flow returns a 403 and they can't leave. The ops work here is what keeps those failure modes from reaching them.

## How it works

### The three platforms

**Supabase** hosts the Postgres database, the Row-Level Security policies, the stored RPCs (`create_log_with_rate_limit`, `erase_account_data`, `export_account_data`, and the others in `scripts/sql/smoke.sql`), and two Deno Edge Functions: `supabase/functions/delete-account/index.ts` and `supabase/functions/audit-record/index.ts`. The free tier gives one active project, 500 MB database, 5 GB bandwidth, 500 K Edge Function invocations per month, and 500 MB Edge Function memory. The project's real name is `Smoke-Ledger`, region `us-east-2`, ref `tvcwrsglceahkjnfuzkn` (recorded in `docs/security/sovereignty-audit-2026-06.md`). After one week of zero API calls, Supabase pauses the project automatically — this is the most common production availability risk.

**Vercel** hosts the Next.js web app (`web/`). The free Hobby tier gives unlimited personal deployments, 100 GB bandwidth per month, and functions up to 300 seconds of execution (the limit was 60 s before Fluid compute; the ops checklist's older "10 s" figure predates it). Configuration lives in `web/vercel.json` (framework detection only — Next.js, `npm run build`). The required environment variables are `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SUPPORT_EMAIL`, and `SUPABASE_SERVICE_ROLE_KEY` (server-only, never `NEXT_PUBLIC_*`) as listed in `docs/deployment/production-ops-checklist.md:69-73`. Ask the ledger adds five server-only variables: `ANTHROPIC_API_KEY`, `LEDGER_CHAT_ENABLED` (the feature is off and its launcher hidden unless this is `true`), `LEDGER_CHAT_MODEL` (default `claude-haiku-5-5`), `LEDGER_CHAT_DAILY_CAP_USER` (20) and `LEDGER_CHAT_DAILY_CAP_GLOBAL` (500). Its route sets `maxDuration = 30` and `preferredRegion = 'cle1'` so the tool queries run next to the `us-east-2` database; the hard spend cap is a monthly limit on the key in the Anthropic console, and the `audit-record` Edge Function must be redeployed when the audit allowlist gains an event (it did for `ledger_chat_consent_toggled`).

**EAS** builds the React Native / Expo mobile app. `eas.json` defines three profiles: `development` (internal APK with dev client), `preview` (internal APK on the `preview` channel), and `production` (AAB on the `production` channel, `autoIncrement: true`, targeting the internal track of the Play Store as a draft). The `preview` and `production` profiles carry blank `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` and `EXPO_PUBLIC_WEB_BASE_URL` placeholders that the owner fills, plus `EXPO_PUBLIC_LEDGER_CHAT_ENABLED=true` (`src/tests/easChatFlag.test.ts` pins both); Expo reads these at build time, so a chat flag change needs a new build. iOS builds are configured in the native config but iOS distribution is not yet active. The `app.config.js` sets `runtimeVersion: { policy: 'appVersion' }`, which pins OTA update delivery to a specific native binary version — a JS-only fix can ship without a store review, but any change that touches native code requires a full build and store release. The app identifier is `app.smokeledger.india` on both platforms (`app.config.js:20,27`).

The `metro.config.js` contains one noteworthy workaround: it forces `@supabase/supabase-js` to resolve to the CommonJS build (`dist/index.cjs`) instead of the ESM build. The ESM build uses a dynamic `import(variableSpecifier)` for optional OpenTelemetry support; Hermes cannot statically compile a dynamic import with a non-literal specifier and fails the EAS production build. This fix affects only that one package (`metro.config.js:19-31`).

### Email delivery

Supabase's default SMTP on the free tier allows only a few auth emails per hour per project. During any kind of signup testing, the API returns success while no email is actually queued. The production ops checklist requires a custom SMTP provider (Resend is documented: `smtp.resend.com`, port 465 or 587, `~100 emails/day` on its free tier). Without custom SMTP, signup confirmation and password reset are effectively unreliable for real users. The full troubleshooting guide is in `docs/deployment/auth-email-delivery.md`.

### Edge Function secrets

Both `delete-account` and `audit-record` require four secrets set via the Supabase dashboard under Edge Functions → Secrets: `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`, `ALLOWED_ORIGINS` (comma-separated, no wildcard in production), and `AUDIT_PEPPER`. The `AUDIT_PEPPER` is a shared secret used to hash user IDs in audit rows before the underlying `auth.users` record is purged, so that a deletion can be proven without retaining re-identifiable data (`supabase/functions/delete-account/index.ts:156`, `supabase/functions/audit-record/index.ts:81`). Its rotation procedure lives in `docs/runbooks/audit-pepper-rotation.md`.

The `audit-record` function applies a per-user rate limit of 10 events per 60 seconds by default, overridable via `AUDIT_RATE_LIMIT_MAX` and `AUDIT_RATE_LIMIT_WINDOW_SEC` env vars (`supabase/functions/audit-record/index.ts:17-21`). The `delete-account` function applies both a per-IP and a per-user rate limit of 5 attempts per 10 minutes, and additionally enforces a 15-minute re-auth window (`REAUTH_WINDOW_MIN`, `delete-account/index.ts:43-45`). Both rate limiters use Deno KV and fail closed — if KV is unavailable, the function returns 429 rather than silently bypassing the limit.

### CI pipeline

The CI workflow (`.github/workflows/ci.yml`) runs five jobs in parallel on every push and pull request to `main` or `master`: `verify`, `db-smoke`, `rls-integration`, `secrets` and `audit`. It runs with a read-only token (`permissions: contents: read`), every action is pinned to a commit SHA, and superseded pull-request runs are cancelled (never `main` runs, whose secret scan covers only their own push).

From September to late October 2026 the workflow ran **zero jobs**: a `secrets.*` reference in a step `if:` is not allowed, so GitHub rejected the whole file and red merges went through (the repo is private on the free plan, so branch protection is unavailable). The authenticated-E2E step now tests a job-level `HAS_E2E_LOGIN` env flag instead, and `src/tests/ci-workflow.test.ts` fails on any `secrets.` inside an `if:`, any unpinned action, or a missing `permissions` block.

**`verify`** is the standard quality gate. It installs both `package.json` and `web/package.json` dependencies, then runs in sequence: root typecheck (`npm run typecheck`), root tests (`npm run test`), root lint (`npm run lint`), web typecheck, web lint, web unit tests (Vitest), `npm run build` in `web/`, Playwright browser install (Chromium only), and the E2E smoke suite (`npm run test:e2e:smoke`). The smoke suite runs `web/e2e/auth-smoke.spec.ts` and `web/e2e/security.spec.ts` — landing page structure, auth page field presence, legal pages, redirect protection, CSP and frame-denial headers, and the CSP nonce propagation test. It also runs the spec tooling tests and `spec:drift` (advisory). The smoke suite additionally loads every public route and fails on any CSP violation. An optional authenticated E2E step runs only when `E2E_LOGIN_EMAIL` and `E2E_LOGIN_PASSWORD` secrets are present.

**`secrets`** downloads gitleaks 8.30.1, verifies its sha256, and scans the pushed range with `--redact` (it never prints a secret). It fails loudly when the range base does not exist, because gitleaks would otherwise exit 0 with no findings. The checkout does not persist the token.

**`audit`** runs `npm audit --omit=dev` for root and `web/`. It blocks at `--audit-level=critical` (both trees are at zero critical) and reports `--audit-level=high` as advisory. The known high-severity leftovers are the Expo-SDK-bound packages (`expo-router`, `@expo/cli`, `decode-uri-component`, `query-string`), `image-size` (pinned `^1` by metro; no 1.x release is patched) and `zod` (needs a 3 → 4 move together with `@hookform/resolvers` 5).

**Weekly posture audit** (`.github/workflows/posture-audit.yml`, Mondays): a full-history redacted gitleaks scan that fails the run, plus `npm audit` reported to the job summary only. **Dependabot** (`.github/dependabot.yml`) proposes weekly updates for root npm, web npm and GitHub Actions, grouping minor and patch bumps.

**`db-smoke`** starts a local Supabase database with `npx --yes supabase@<version> db start` (every Supabase call in CI, here and in `rls-integration` and `responsive-e2e`, goes through the workflow-level `SUPABASE_CLI_VERSION`, now `2.122.1`: an unpinned `npx supabase` resolves the latest release on each run, so a new major, 3.0.0 on 2026-11-02, would change CI with no commit; bump it deliberately), applies all migrations via `... db reset --no-seed`, then runs `scripts/sql/smoke.sql` via `psql`. That SQL file asserts the existence of the critical RPCs (`export_account_data`, `create_log_with_rate_limit`, `record_audit_event`), the `audit_events` table, the `error_events_compliance_delete_null_user_check` constraint, the `error_events_insert` RLS policy, the absence of `error_events_delete` and `error_events_update` policies, the `idx_logs_brand` index, the `brand_variants` ON DELETE RESTRICT constraint, and the `v_daily_summary_user` view and `get_daily_summary` RPC. Later blocks assert that `anon` can execute no SECURITY DEFINER function and holds no table privilege, that the payload size caps exist, that the rate-limit purge is scheduled when pg_cron is installed, that `authenticated` cannot INSERT into `cigarette_logs` directly, and that the triggers the clients rely on exist (`trg_user_profiles_onboarding_step_monotonic`, `goals_stamp_completed_at`, `trg_user_profiles_marketing_consent_null`, with the old marketing CHECK absent). The jobs that check out code (`db-smoke`, `rls-integration`, `responsive-e2e`) set `persist-credentials: false`, so the token is not left in the workspace for the CLI steps.

**`responsive-e2e`** builds a throwaway local Supabase from the PR's migrations (no secrets, and the specs refuse any non-local URL) and runs the dev servers. The responsive sweep covers every page at every viewport and engine for overflow, target size and iOS input zoom. The job sets `LEDGER_CHAT_ENABLED: 'true'` (no Anthropic key: the specs mock `/api/ledger-chat`), so the sweep also checks that the Ask dock fits each viewport. A second step, "Functional E2E (chat, dock, consent, goals)", then runs `ledger-chat.spec.ts`, `ask-dock.spec.ts`, `consent.spec.ts`, `consent-chat.spec.ts` (the one spec that stores a "Yes" chat opt-in) and `goals.spec.ts` on Chromium and fails if any spec was skipped or none ran, because those specs skip themselves without a seedable stack and a silent skip would be a false pass. Production keeps the flag off; the mobile flag `EXPO_PUBLIC_LEDGER_CHAT_ENABLED` is a build-time variable set per EAS profile (`.env.example`; `eas.json` carries a blank `EXPO_PUBLIC_WEB_BASE_URL` that must be filled in before the mobile chat can work).

**`rls-integration`** is the most important job and is deliberately mandatory — the workflow file says so explicitly at `ci.yml:102-103`: "this job is the sole automated safety net for cross-tenant data leakage." It will hard-fail if any of the six required secrets are absent (`E2E_SUPABASE_URL`, `E2E_SUPABASE_ANON_KEY`, `E2E_USER_A_EMAIL`, `E2E_USER_A_PASSWORD`, `E2E_USER_B_EMAIL`, `E2E_USER_B_PASSWORD`). Before running the tests, it calls `node scripts/verify-backend.mjs` to confirm that required RPCs are present on the CI project; a stale schema here fails early with a clear error. The actual tests are in `src/tests/rls.integration.test.ts` and cover cross-user isolation on `cigarette_logs`, the `record_audit_event` revoke, `audit_events` SELECT visibility, `error_events` INSERT permissions, the H1 compliance-delete tamper-resistance invariants, and the F1a daily-summary RPC behaviour. The job uses a concurrency group (`rls-integration-${{ github.ref }}`, `cancel-in-progress: false`) to serialise runs against the shared CI Supabase project.

The CI project must be a **separate** free-tier Supabase project — not production, not local. Its two test users are created once manually in the Supabase Auth dashboard. Migrations must be applied to it manually whenever a new migration is merged (`npm run db:push` against the CI project ref).

### Deployment sequence

The correct deploy order, from `docs/deployment/production-ops-checklist.md:58-65`:

1. `npm run db:push` — push migrations to Supabase
2. `npm run functions:deploy:all` — deploy both edge functions (deploy edge functions **before** any client builds that expect the current RPC surface)
3. `npm run verify:backend` — confirm RPCs exist, edge functions are listed, `record_audit_event` is blocked for unauthenticated callers

Vercel deploys automatically on merge to the main branch (Vercel's GitHub integration). EAS production builds are triggered manually with `eas build --platform android --profile production` and submitted to the Play Store internal track as a draft.

### Verification scripts

Four scripts live in `scripts/` and are part of the standard ops workflow:

`scripts/verify-backend.mjs` (`npm run verify:backend`) checks RPC existence, the `record_audit_event` revoke, and edge function deployment against the linked project. It requires `SUPABASE_URL` and `SUPABASE_ANON_KEY` and optionally accepts E2E credentials for an export-pagination smoke test.

`scripts/verify-sovereignty.mjs` (`npm run verify:sovereignty`) probes all 13 tenant tables and 3 data-rights RPCs with an anon client and asserts that every probe returns zero rows or a permission rejection. It also hits `POST /functions/v1/delete-account` without a JWT and expects 401. This script is the live enforcement of the 17 invariants documented in `docs/security/sovereignty-audit-2026-06.md`.

`scripts/preflight-launch.mjs` (`npm run preflight:launch`) audits the Supabase Auth dashboard config via the Management API (custom SMTP, email confirmation, site URL, redirect allowlist, captcha, HaveIBeenPwned check) and runs a real signup→confirm→login→reset→cleanup loop. It should be run against staging, not production. Full detail in the release-preflight skill (`.claude/skills/release-preflight/SKILL.md`).

`scripts/verify-delete-resignup.mjs` proves the deletion contract end-to-end: a deleted account is inaccessible, the `auth.users` row is hard-deleted, and the same email can re-register as a fresh account with a new UUID and zero data. It requires the service-role key and should be run against staging.

### The migration ledger lies (by re-stamping)

Migrations applied via the Supabase MCP or dashboard get recorded under the
apply-time version, not the repo file's version, so `supabase migration list`
shows false "local-only" rows. The canonical repo-file ↔ live-ledger mapping
lives in `docs/deployment/migration-ledger-map.md` (audited 2026-07-05: every
repo migration's effects are live; all drift is cosmetic). When in doubt, trust
object-level checks (`pg_proc`, `pg_constraint`, `pg_publication_tables`), not
the ledger.

### Spec drift detection

`npm run spec:drift` (which runs `scripts/spec/drift-check.mjs`) reports any section of this spec whose declared source globs have changed since `last_verified_commit`. It is not a CI gate today, but it is the signal to run `/spec-update`.

## Invariants

The rules here that must not quietly break:

**`rls-integration` must never be optional.** The CI workflow has no `if:` guard on that job, and it will exit 1 if secrets are absent. If branch protection is ever relaxed to allow a merge past a failing `rls-integration` check, the sole automated cross-tenant isolation guard disappears. The branch protection rule must include `rls-integration` as a required status check (`.github/workflows/ci.yml:100-103`, `docs/deployment/production-ops-checklist.md:163-169`).

**Edge functions must be deployed before client builds.** Any client build that stops calling the `record_audit_event` RPC directly and instead calls the edge function must deploy the function first. Deploying in reverse order produces 404 errors for in-flight clients (`docs/deployment/production-ops-checklist.md:65`).

**`AUDIT_PEPPER` must be set to the same value on both edge functions.** `delete-account` and `audit-record` both hash `user.id:AUDIT_PEPPER`. If they diverge, the same user's hash looks different in the two audit streams, breaking forensic correlation. Rotation must happen atomically across both functions (`docs/runbooks/audit-pepper-rotation.md`).

**The delete-account function fails closed on erase failure.** If `erase_account_data()` returns an error, the function aborts without calling `auth.admin.deleteUser`. The user's data and auth row stay intact and the user can retry. The function never deletes the auth row over an unverified purge (`supabase/functions/delete-account/index.ts:183-194`).

**The CI project must stay schema-current.** `verify-backend.mjs` runs before the RLS integration tests. If the CI project's schema is behind the repo's migrations, that step fails before any test runs, making the failure visible and attributable. Applying migrations to the CI project is a manual step a maintainer must run after any new migration is merged.

**The `ALLOWED_ORIGINS` edge function secret must not include `*`.** Both functions check `originAllowed()` before doing any work, and the implementation refuses a wildcard in production. An unconfigured origin returns 403 (`supabase/functions/delete-account/index.ts:71-83`).

## Edge cases & gotchas

**Supabase free tier auto-pause.** After one week of zero API calls the project pauses and all connections fail. There is no warning. Unpausing requires logging into the Supabase dashboard and clicking "Resume". This is the most likely availability incident for a pre-launch product with sporadic traffic.

**Supabase built-in mailer.** The free-tier default SMTP allows only a few auth emails per hour per project. It can return HTTP 200 to the client while silently dropping the email. Without custom SMTP, any period of signup testing will hit this limit and make the product look broken to real users. The fix (custom SMTP via Resend or equivalent) is documented in `docs/deployment/auth-email-delivery.md:78-99` and is a launch blocker per the ops checklist.

**EAS `runtimeVersion` and OTA.** The `appVersion` policy means an OTA update (EAS Update) will only install on devices running a binary with the matching `version` field. If `version` is bumped in `app.config.js` without a new native build being distributed, the OTA update is effectively dead — no installed device matches. JS-only changes should deploy as OTA updates without bumping `version`; native-touching changes require a full EAS build and store release.

**Hermes + `@supabase/supabase-js` ESM dynamic import.** Without the `metro.config.js` CJS override, `expo export` (and any EAS production Android build) fails during Hermes bytecode compilation. The workaround forces the CJS entry for that one package (`metro.config.js:20-31`). If `@supabase/supabase-js` is upgraded, confirm the CJS build path has not moved.

**CI project concurrency and test-row cleanup.** `rls-integration` sets `cancel-in-progress: false` because cancelling a run mid-flight skips the `afterAll` cleanup in `src/tests/rls.integration.test.ts`, leaving probe rows in the CI project. Those orphaned rows are not dangerous but they make subsequent runs slightly noisier. If CI queue depth becomes a problem, flipping to `cancel-in-progress: true` is acceptable at the cost of some test-row leakage (`.github/workflows/ci.yml:113-116`).

**`delete-account` rate limiter with Deno KV.** The per-IP and per-user rate limits use Deno KV as their backing store. If KV is unavailable (Supabase infrastructure issue), the function returns 429 rather than open-running. This is intentional fail-closed behaviour (`delete-account/index.ts:93-100`), but it means a KV outage blocks legitimate account deletions.

**Play Store submission track.** `eas.json` submits to the `internal` track with `releaseStatus: draft` and `changesNotSentForReview: false`. This means the first submission will prompt for review. Changing `releaseStatus` to `completed` promotes the build to the full internal testing track, which requires the Play Console's internal testing track to be configured first.

**`SUPABASE_SERVICE_ROLE_KEY` on Vercel must stay server-only.** It is used by `/api/auth/login` and the delete-account edge function. If it were ever set as `NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY` it would be embedded in the client bundle and expose full admin access. The checklist item at `docs/deployment/production-ops-checklist.md:71` is explicit, but Vercel will not refuse the misconfiguration.

## Tests

**Unit and domain tests** (`npm run test`, Jest): 29 test files under `src/tests/` cover domain logic, validation, auth callbacks, repositories, event shapes, rate limiting, and audit service behaviour. These are the fastest gate and run first in the `verify` CI job.

**Web unit tests** (`cd web && npm run test`, Vitest): isolated unit tests for web-specific code, including cookie options, auth redirect handling, login hints, and shared schemas.

**E2E smoke** (`npm run test:e2e:smoke`): runs `web/e2e/auth-smoke.spec.ts` and `web/e2e/security.spec.ts` with Playwright against a running Next.js dev server (port 4173). These tests require no credentials — they verify page structure, headers, redirect rules, and the CSP nonce invariant. The Playwright config retries once in CI (`web/playwright.config.ts:8`).

**RLS integration** (`npm test -- rls.integration.test.ts`): runs against the live CI Supabase project. Twelve assertions cover cross-user isolation on logs, audit event visibility, error event insertion and tamper-resistance (H1), and the F1a daily-summary RPC. This is the only test that proves the database's security model actually works at runtime.

**Backend verification** (`npm run verify:backend`): not a test runner but a post-deploy assertion script. Checks RPC existence, the `record_audit_event` revoke, and edge function deployment. Runs in the `rls-integration` CI job before the Jest tests.

**Sovereignty verification** (`npm run verify:sovereignty`): probes 13 tenant tables and 3 data-rights RPCs with an anon client. Point-in-time output is recorded in `docs/security/sovereignty-audit-2026-06.md`. Reproducing it requires only the public anon key.

**Migration smoke** (`scripts/sql/smoke.sql`): a plain SQL `DO` block run via `psql` in the `db-smoke` CI job. Asserts the structural invariants on the Postgres schema, including the H1 tamper-resistance constraint and the F1a view.

**DB-smoke job**: spins up a local Supabase instance, resets the schema with all migrations, runs the SQL smoke file, and tears down. This is the CI guard for migration correctness — it catches `CREATE FUNCTION`/`CREATE TABLE` failures before they reach a shared project.

## Open gaps

**No E2E coverage for the authenticated web flows in CI unless secrets are set.** The full Playwright suite (`web/e2e/authenticated-flows.spec.ts`, `web/e2e/data-export-and-deletion.spec.ts`, and `web/e2e/goals.spec.ts`, which is also in the `test:e2e:authed` script and skips unless the service-role seed environment is set) only runs when `E2E_LOGIN_EMAIL` and `E2E_LOGIN_PASSWORD` are present. CI currently only guarantees the unauthenticated smoke tests. Any regression in authenticated dashboard, export, or deletion flows will not be caught by CI unless those secrets are configured.

**No iOS distribution.** `eas.json` configures only `android` build types at all three profiles. The `ios` block in `app.config.js` sets a bundle identifier (`app.smokeledger.india`) but no EAS submit config exists for iOS. Apple Developer Program enrollment and TestFlight setup are prerequisites that are not yet done.

**Supabase free-tier pause is unmonitored.** There is no alerting when the project approaches the auto-pause threshold or when it actually pauses. The first signal is user-reported auth failures. A cron ping (even a single scheduled RPC call) would keep the project alive, but none is configured.

**CI project schema must be kept current manually.** There is no automated step that applies new migrations to the CI Supabase project. If a maintainer forgets to run `npm run db:push` against the CI project after merging a migration, the `verify-backend.mjs` step in `rls-integration` will fail, blocking all PRs until someone notices and applies the migration.

**`error_events` layer-3 constraint — resolved 2026-06-19.** The 2026-06 sovereignty audit (`docs/security/sovereignty-audit-2026-06.md:§4`) found `error_events_compliance_delete_null_user_check` absent from the live production project despite being declared in an earlier migration (a migrations-can-lie gap). It is now applied and confirmed present in the live DB via `pg_constraint`. The fix-forward migration `supabase/migrations/20260619000000_error_events_compliance_check.sql` adds it idempotently (`IF NOT EXISTS`), so a fresh CI project converges to the same state. The `db-smoke` CI job (`scripts/sql/smoke.sql:38-44`) continues to assert its existence.

**`verify-delete-resignup.mjs` is not a CI gate.** This script proves the end-to-end deletion contract (inaccessibility, hard delete, fresh re-signup) but it is not run in the CI workflow. It requires the service-role key and creates/deletes real users, so it is intentionally a manual pre-release step. That means a regression in the deletion flow would not be caught until a human runs the script.

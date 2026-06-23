# QA / Test Runbook

How to run each test layer, what it touches, and the safety rules. The suite is
built in phases; this doc grows with each phase.

## Layers

| Layer | Tool | Target | Touches prod? |
|---|---|---|---|
| Unit / domain | Jest (root), Vitest (`web/`) | none (pure) | no |
| Unauthenticated smoke E2E | Playwright | local `next dev`, public pages | no |
| Authenticated / functional E2E | Playwright | local `next dev` → **prod** Supabase, throwaway accounts | yes (auto-cleaned) |
| RLS / authz integration | Jest | dedicated test Supabase users | yes (a test project) |
| Performance / load | Jest + SQL | **local** `supabase start` only | never |

## Commands

```bash
# Unit
npm test                 # root (Jest)         — from repo root
cd web && npm test       # web (Vitest)

# E2E smoke (no creds, no DB) — safe anywhere
cd web && npm run test:e2e:smoke

# E2E authenticated / functional (seeds + tears down throwaway PROD accounts)
cd web
cp .env.e2e.example .env.e2e      # then fill in real prod anon + service-role keys
npm run test:e2e:authed           # or: npm run test:e2e  (runs everything)
```

`web/.env.e2e` is gitignored. Playwright auto-loads it (see `playwright.config.ts`)
and boots `next dev` on port 4173 pointed at the `E2E_SUPABASE_*` project.

## How authenticated E2E stays safe on prod

- Accounts are created via the service role with `email_confirm: true` (no email
  step) and a unique `e2e+…@smoke-ledger-e2e.test` address — see `e2e/_helpers/seed.ts`.
- The `seeded`/`onboarded` fixtures (`e2e/_helpers/fixtures.ts`) create the user,
  then do all pre-`use` seeding inside a `try` so the `finally` always deletes it.
  FK `ON DELETE CASCADE` removes profile/logs/goals/brands; `error_events` is
  `ON DELETE SET NULL`, so `deleteUser` deletes those rows explicitly first.
- Specs **skip** entirely when `SUPABASE_SERVICE_ROLE_KEY` / URL / anon are absent
  (`canSeed()` is false), so nothing runs — and nothing hits prod — on an
  unconfigured machine or in CI without secrets.
- Teardown self-check: `countLeftoverTestUsers()` should return 0 after a run.
- **Load / heavy-volume perf is enforced local-only**: `perf.integration.test.ts`
  skips unless the target URL is `127.0.0.1`/`localhost` — it can never seed or
  load a remote (prod) DB even if `.env.e2e` holds prod creds.

### Gotchas
- `reuseExistingServer` is on locally: if a `next dev` is already on :4173 with a
  different env, Playwright reuses it and ignores the config's Supabase mapping.
  Stop any stray dev server before running the authed suite against a new target.

## Phase status

- **A (done):** seeding/teardown harness, fixtures, env-driven config, fixed
  `authenticated-flows.spec.ts`.
- **B (done):** functional flow specs — onboarding→done, dashboard timeframe
  (Day/Week/Month/Year reconciliation), log entry, cross-device realtime sync.
  Run with `npm run test:e2e:authed` (needs `.env.e2e`).
- **C (done):** RLS/authz extended (brands, brand_variants, goals isolation +
  anon RPC/select rejection in `src/tests/rls.integration.test.ts`); web hardening
  (`web/e2e/security-extra.spec.ts` — protected-route redirects + bad-login, in
  smoke); authed input-validation + sign-out (`web/e2e/auth-session.spec.ts`).
  Run RLS with `npm test -- rls.integration` (needs `E2E_SUPABASE_*` + two users).
- **D (done):** local perf (`src/tests/perf.integration.test.ts` — `get_daily_summary`
  SUM(quantity) at volume + budget, pagination, concurrency burst; run `npm run test:perf`
  with `E2E_SUPABASE_*` + `SUPABASE_SERVICE_ROLE_KEY` pointed at a **local** stack);
  regression guard (`web/__tests__/supabaseGuard.test.ts` — browser client refuses a
  server context); engine edge cases (empty account, gap-day savings) in
  `src/tests/periodSummary.test.ts`.

## Remaining follow-ups (noted, not blocking)
- UI input-validation breadth (signup DOB<18, more settings fields) beyond the mobile rule.
- Wire the authenticated + perf suites into CI once secrets/a test project are provisioned.

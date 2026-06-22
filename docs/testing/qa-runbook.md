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
- The `seeded` fixture (`e2e/_helpers/fixtures.ts`) deletes the user in `finally`;
  FK `ON DELETE CASCADE` removes its profile/logs/goals/brands.
- Specs **skip** entirely when `SUPABASE_SERVICE_ROLE_KEY` / URL / anon are absent
  (`canSeed()` is false), so nothing runs — and nothing hits prod — on an
  unconfigured machine or in CI without secrets.
- Teardown self-check: `countLeftoverTestUsers()` should return 0 after a run.
- **Never** run load or heavy-volume seeding against prod — use a local stack.

## Phase status

- **A (done):** seeding/teardown harness, fixtures, env-driven config, fixed
  `authenticated-flows.spec.ts`.
- **B (done):** functional flow specs — onboarding→done, dashboard timeframe
  (Day/Week/Month/Year reconciliation), log entry, cross-device realtime sync.
  Run with `npm run test:e2e:authed` (needs `.env.e2e`).
- **C (planned):** RLS/authz, web hardening, input/abuse, auth/session.
- **D (planned):** local perf/load, edge/negative/regression.

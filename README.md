# Smoke Ledger

Web-first smoking reduction and cessation support product with shared Expo mobile client and a single hosted Supabase backend.

## Product Position

- Primary launch surface: Next.js web (`web/`).
- Secondary client: Expo mobile (`app/`), using the same backend contracts.
- Audience: adults (18+).
- Scope: behavior tracking and cessation support, not diagnosis or medical treatment.

## Architecture

- **Frontend (web)**: Next.js 14 App Router in `web/`.
- **Frontend (mobile)**: Expo Router in `app/`.
- **Backend**: Supabase Auth + Postgres + RLS + Edge Functions.
- **Shared logic**: `src/domain` (pure calculations), `src/db/repositories` (data access), `src/lib/validation` (input validation).

## Prerequisites

- Node.js 20+
- npm 10+
- Supabase CLI
- Supabase project (free tier is sufficient for development)

## Environment Setup

### Root env (Expo/shared client)

1. Copy `.env.example` to `.env` (or run `npm run setup:env`).
2. Set:
   - `EXPO_PUBLIC_SUPABASE_URL`
   - `EXPO_PUBLIC_SUPABASE_ANON_KEY`
   - `EXPO_PUBLIC_WEB_BASE_URL` (hosted legal/support pages for mobile links)

Never place `service_role` keys in client env files.

### Web env

Create `web/.env.local` and set:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_SUPPORT_EMAIL` (recommended for legal/support pages)
- `SUPABASE_SERVICE_ROLE_KEY` (server-only, **not** `NEXT_PUBLIC_*`) — optional; powers `/api/auth/login-hint` for explicit “no account” vs “wrong password” messages. Omit to fall back to generic invalid-credentials copy.

Optional: `NEXT_PUBLIC_TURNSTILE_SITE_KEY` for Cloudflare Turnstile on login/signup (see [production ops checklist](docs/deployment/production-ops-checklist.md)).

## Database Setup

Apply migrations in order:

1. `supabase/migrations/20250426120000_initial_schema.sql`
2. `supabase/migrations/20260504000000_enhancements.sql`
3. `supabase/migrations/20260519100000_hardening_and_compliance.sql`
4. `supabase/migrations/20260519130000_brand_catalog_expansion.sql`
5. `supabase/migrations/20260520000000_security_correctness.sql`
6. `supabase/migrations/20260521000000_audit_export_ops.sql`
7. `supabase/migrations/20260601000000_catalog_2026_refresh.sql` — 2026 MRP updates + `refresh_seed_prices_from_catalog` RPC

Run from repo root:

```bash
npm run db:push
npm run verify:backend
```

`verify:backend` checks core RPCs (including `sync_default_brand_catalog` and `refresh_seed_prices_from_catalog`). If a catalog RPC is missing, re-run `db:push`. Catalog price sources: [docs/catalog/2026-cigarette-mrp-sources.md](docs/catalog/2026-cigarette-mrp-sources.md).

Full production checklist: [docs/deployment/production-ops-checklist.md](docs/deployment/production-ops-checklist.md).

## Edge Function Setup

Deploy account deletion and audit functions:

```bash
npm run functions:deploy:all
npm run verify:backend
```

Verify function secrets in Supabase dashboard:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Enable email auth and password reset in Supabase Auth providers.

For signup confirmation and magic-link delivery (SMTP, rate limits, dashboard checks), see [docs/deployment/auth-email-delivery.md](docs/deployment/auth-email-delivery.md).

## Local Development

Install dependencies:

```bash
npm install
```

Run mobile:

```bash
npm run start
```

Run web:

```bash
cd web
npm install
npm run dev
```

## Scripts

### Root

- `npm run start` — Expo dev server
- `npm run typecheck` — TypeScript checks
- `npm run test` — Jest unit tests
- `npm run lint` — ESLint
- `npm run db:push` — push Supabase migrations
- `npm run verify:backend` — post-push RPC and edge-function smoke checks
- `npm run functions:deploy:delete-account` — deploy delete-account function

### Web (`web/`)

- `npm run dev` — Next.js dev server
- `npm run build` — production build
- `npm run start` — production server
- `npm run typecheck` — TypeScript checks
- `npm run lint` — ESLint
- `npm run test:e2e` — Playwright E2E (requires Supabase + test user for authenticated specs)
- `npm run test:e2e:smoke` — auth redirect + security smoke subset

## Legal and Compliance Endpoints

Deploy these public routes and link them in app/store metadata:

- `/privacy` — Privacy Policy
- `/terms` — Terms of Service
- `/support` — Support and data rights contact

Public pages (legal, support, auth) include a fixed **Go to Homepage** link (bottom-right) that navigates to `/` via Next.js App Router. The landing page (`/`) showcases product features with interactive demo previews.

Canonical documents in repository:

- `docs/legal/privacy-policy.md`
- `docs/legal/terms-of-service.md`

## Data and Security Baseline

- Authentication required for all product data.
- RLS enabled on exposed tables.
- Per-user isolation enforced in policies and repository queries.
- Input validation centralized in `src/lib/validation.ts`.
- Account deletion uses an authenticated Edge Function and admin delete.
- No third-party ad SDKs.

### Web auth and sessions

- **Password login** uses `POST /api/auth/login` so httpOnly Supabase auth cookies respect the remember-me policy (not client-only `signInWithPassword`).
- **Remember me** is off by default. Unchecked → session cookies (logout when browser closes). Checked → persistent cookies via `sl_remember_me=1`.
- Email-link and phone OTP flows unchanged; session exchange via `/auth/callback`.
- Brand catalog sync runs at most **once per browser tab** per catalog version (`CATALOG_SYNC_VERSION` in `src/lib/catalogVersion.ts`); bump the version when catalog migrations change.

### Optional RLS integration test

`src/tests/rls.integration.test.ts` verifies cross-user isolation with two authenticated test accounts.

Set these env vars before running `npm test`:

- `E2E_SUPABASE_URL`
- `E2E_SUPABASE_ANON_KEY`
- `E2E_USER_A_EMAIL`
- `E2E_USER_A_PASSWORD`
- `E2E_USER_B_EMAIL`
- `E2E_USER_B_PASSWORD`

If env vars are not set, the RLS integration suite is skipped.

### Optional Playwright E2E (web)

From `web/`, with the dev server started by Playwright or already running:

```bash
cd web
npm run test:e2e:smoke
```

For authenticated flows and session-cookie checks (`e2e/security.spec.ts`, `e2e/authenticated-flows.spec.ts`), set:

- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` (or `E2E_SUPABASE_*` equivalents in CI)
- `E2E_LOGIN_EMAIL` / `E2E_LOGIN_PASSWORD` (or `E2E_USER_A_*` for multi-user RLS jobs)

Specs skip automatically when credentials are missing.

## Deletion and Export Policy

- Users can erase in-app data or request full account deletion.
- Deletion removes auth identity plus associated app data.
- Export and erase flows use server-side RPC operations (`export_account_data`, `erase_account_data`).

## Medical Disclaimer

Smoke Ledger is cessation support software for behavior tracking. It is not a medical device and does not provide diagnosis, treatment, or emergency services.

## Troubleshooting

- **Windows + OneDrive install issues:** if `npm install` fails with EPERM, try `npm install --ignore-scripts` temporarily, then run `npm run typecheck` and `npm run test`.
- **ESLint optional native resolver warnings:** this repo relies on TypeScript (`tsc`) as import truth.

## Legacy Notes

Legacy SQLite references remain in source history, but Supabase Postgres migrations in `supabase/migrations/` are the active schema source of truth.

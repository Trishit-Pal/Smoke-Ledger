# Smoke Ledger

Smoke Ledger helps you track smoking, see what it costs, and work toward cutting back or quitting — on your terms. The web app in `web/` is the main experience; an Expo mobile client in `app/` shares the same backend. Built for adults (18+). It supports behavior tracking and cessation goals — not diagnosis or medical treatment.

## What you get

- **One-tap logging** — record a cigarette in seconds, with brand and context when you want them.
- **Daily dashboard** — today’s count, spend, and progress at a glance.
- **Trends** — spot patterns over days and weeks.
- **Goals, history, and export** — deeper tools inside the app after you sign up.
- **India-first** — INR pricing, local brand catalog with 2026 MRP data.
- **Private and ad-free** — your data stays yours; no third-party ad SDKs.

## The web experience

When you open `/`, you get the full marketing page: a hero (“Know every stick. Spend less. Quit on your terms.”), trust highlights, how-it-works steps, privacy and FAQ sections, and three live-style previews — **quick log**, **dashboard**, and **trends** — using demo data, not your account. Goals, history, and export are mentioned on the page but live inside the signed-in app.

Every page has a sun/moon button in the **top-right** to switch dark or light mode. Your choice is saved in the browser under `smoke-ledger-theme` and survives refresh. Dark is the default; there is no “follow system” option.

On privacy, terms, support, and auth pages, a small **Go to Homepage** link sits **bottom-right** so you can always get back to `/`. It is hidden on the landing page itself.

## How it’s built

One Supabase project powers everything: Auth, Postgres with row-level security, and Edge Functions. Shared business logic lives in `src/` so web and mobile stay aligned.

- **Web** — Next.js 14 App Router (`web/`)
- **Mobile** — Expo Router (`app/`)
- **Backend** — Supabase Auth + Postgres + RLS + Edge Functions
- **Shared code** — `src/domain` (calculations), `src/db/repositories` (data access), `src/lib/validation` (input checks)

## Getting started

You’ll need Node.js 20+, npm 10+, the Supabase CLI, and a Supabase project (the free tier is fine for development).

### Environment

**Root (Expo / shared client)**

Copy `.env.example` to `.env` (or run `npm run setup:env`), then set:

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `EXPO_PUBLIC_WEB_BASE_URL` — hosted legal/support URLs for mobile deep links

Never put `service_role` keys in client env files.

**Web**

Create `web/.env.local`:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_SUPPORT_EMAIL` — recommended for legal/support pages
- `SUPABASE_SERVICE_ROLE_KEY` — server-only (**not** `NEXT_PUBLIC_*`); required by `/api/auth/login` and the account-deletion edge function

Optional: `NEXT_PUBLIC_TURNSTILE_SITE_KEY` for Cloudflare Turnstile on login/signup ([production ops checklist](docs/deployment/production-ops-checklist.md)).

### Install and run

```bash
npm install
```

**Web** (from `web/`):

```bash
cd web
npm install
npm run dev
```

**Mobile**:

```bash
npm run start
```

## Database and backend

Apply migrations in this order:

1. `supabase/migrations/20250426120000_initial_schema.sql`
2. `supabase/migrations/20260504000000_enhancements.sql`
3. `supabase/migrations/20260519100000_hardening_and_compliance.sql`
4. `supabase/migrations/20260519130000_brand_catalog_expansion.sql`
5. `supabase/migrations/20260520000000_security_correctness.sql`
6. `supabase/migrations/20260521000000_audit_export_ops.sql`
7. `supabase/migrations/20260601000000_catalog_2026_refresh.sql` — 2026 MRP updates + `refresh_seed_prices_from_catalog` RPC

From the repo root:

```bash
npm run db:push
npm run verify:backend
```

`verify:backend` smoke-checks core RPCs, including `sync_default_brand_catalog` and `refresh_seed_prices_from_catalog`. If a catalog RPC is missing, run `db:push` again. Price sources: [docs/catalog/2026-cigarette-mrp-sources.md](docs/catalog/2026-cigarette-mrp-sources.md).

Deploy Edge Functions (account deletion and audit):

```bash
npm run functions:deploy:all
npm run verify:backend
```

In the Supabase dashboard, confirm function secrets: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`. Enable email auth and password reset under Auth providers.

For signup confirmation, magic links, and SMTP setup, see [auth email delivery](docs/deployment/auth-email-delivery.md). Full production checklist: [production ops checklist](docs/deployment/production-ops-checklist.md).

## Security and auth

Product data requires authentication. RLS is on for exposed tables; policies and repository queries keep each user’s data isolated. Input validation is centralized in `src/lib/validation.ts`. Account deletion goes through an authenticated Edge Function with admin delete.

**Web login and sessions**

Password login uses `POST /api/auth/login` so httpOnly Supabase cookies follow the remember-me policy — not a client-only `signInWithPassword`. Remember me is off by default: unchecked means session cookies (gone when the browser closes); checked sets persistent cookies via `sl_remember_me=1`. Email-link and phone OTP flows are unchanged; sessions exchange through `/auth/callback`.

Brand catalog sync runs at most **once per browser tab** per catalog version (`CATALOG_SYNC_VERSION` in `src/lib/catalogVersion.ts`). Bump that version when catalog migrations change.

**Data rights**

Users can export or erase in-app data, or request full account deletion (auth identity plus app data). Export and erase use server-side RPCs: `export_account_data`, `erase_account_data`.

**Optional RLS integration test**

`src/tests/rls.integration.test.ts` checks cross-user isolation with two test accounts. Set before `npm test`:

- `E2E_SUPABASE_URL`
- `E2E_SUPABASE_ANON_KEY`
- `E2E_USER_A_EMAIL` / `E2E_USER_A_PASSWORD`
- `E2E_USER_B_EMAIL` / `E2E_USER_B_PASSWORD`

The suite skips if these are unset.

**Optional Playwright E2E (web)**

Smoke tests cover the landing page, auth fields, legal routes, the homepage link, and the theme toggle on `/` and `/login`:

```bash
cd web
npm run test:e2e:smoke
```

For authenticated flows and session-cookie checks (`e2e/security.spec.ts`, `e2e/authenticated-flows.spec.ts`), also set:

- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` (or `E2E_SUPABASE_*` in CI)
- `E2E_LOGIN_EMAIL` / `E2E_LOGIN_PASSWORD` (or `E2E_USER_A_*` for multi-user jobs)

Specs skip when credentials are missing.

## Scripts

Handy commands from the repo root:

- `npm run start` — Expo dev server
- `npm run typecheck` — TypeScript checks
- `npm run test` — Jest unit tests
- `npm run lint` — ESLint
- `npm run db:push` — push Supabase migrations
- `npm run verify:backend` — post-push RPC and edge-function checks
- `npm run functions:deploy:delete-account` — deploy delete-account function

From `web/`:

- `npm run dev` — Next.js dev server
- `npm run build` — production build
- `npm run start` — production server
- `npm run typecheck` — TypeScript checks
- `npm run lint` — ESLint
- `npm run test:e2e` — full Playwright suite (needs Supabase + test user for auth specs)
- `npm run test:e2e:smoke` — public-page and security smoke subset

## Legal pages

Ship and link these in app and store metadata:

- `/privacy` — Privacy Policy
- `/terms` — Terms of Service
- `/support` — Support and data-rights contact

Canonical source files in the repo: `docs/legal/privacy-policy.md`, `docs/legal/terms-of-service.md`.

## Troubleshooting

- **Windows + OneDrive:** if `npm install` fails with EPERM, try `npm install --ignore-scripts`, then run `npm run typecheck` and `npm run test`.
- **ESLint resolver warnings:** TypeScript (`tsc`) is the source of truth for imports here.

## Disclaimer

Smoke Ledger is cessation support software for behavior tracking. It is not a medical device and does not provide diagnosis, treatment, or emergency services.

## Legacy note

Older SQLite references may appear in history, but Supabase Postgres migrations in `supabase/migrations/` are the active schema source of truth.

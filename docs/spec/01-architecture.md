---
section: architecture
sources:
  - src/store/**
  - src/lib/supabase.ts
  - web/lib/server/**
  - app/_layout.tsx
  - metro.config.js
last_verified_commit: b9ac848
status: current
---

# Architecture

## Purpose

Smoke Ledger India is one product running on two runtimes: a React Native / Expo app (iOS and Android, with a dev-only Expo web path) and a Next.js web app under `web/`. Both share business logic from a single `src/` directory. The two runtimes never diverge on what a cigarette log _is_ or how its numbers work — that is the whole point of the monorepo structure.

## What the user experiences

Users open the native app or the web dashboard and see the same data. They can log a cigarette on their phone and see it reflected in the web trends view because both clients write to and read from the same Supabase database, scoped to their user ID by Row-Level Security. The app boots and is ready within a single splash-screen window; the web app returns server-rendered pages that feel instant because data is fetched on the server before anything reaches the browser.

## How it works

### Monorepo layout

The repository root is the Expo/React Native project. The `web/` subdirectory is a self-contained Next.js project with its own `package.json`, `node_modules`, and `tsconfig.json`. They share everything under `src/`:

```
/                   ← Expo project root (package.json, tsconfig.json, metro.config.js)
  app/              ← Expo Router file-based screens
  src/
    domain/         ← pure functions, no I/O (calc.ts, savings.ts, insights.ts, …)
    db/
      repositories/ ← one file per table; all DB reads/writes live here
    lib/
      supabase.ts   ← Supabase client singleton (native/dev-web)
      validation.ts ← Zod schemas; single source of truth for allowed values
    store/          ← Zustand stores (session.ts, auth.ts, theme.ts)
    types/
      index.ts      ← shared TypeScript interfaces (CigaretteLog, UserProfile, …)
  web/              ← Next.js project
    app/            ← App Router pages and layouts
    lib/
      server/
        data.ts     ← server-side data fetching (React cache + Next.js unstable_cache)
      supabase/     ← server/admin Supabase clients for Next.js
    middleware.ts   ← auth guard + CSP nonce + onboarding-step enforcement
  supabase/
    migrations/     ← versioned SQL migrations
    functions/      ← Edge Functions (delete-account, audit-record)
```

### The five layers and why they exist that way

**Domain (`src/domain/`).** Pure TypeScript functions with no imports from Supabase, no async, no side effects. `calc.ts` contains everything from `deriveUnitPrice` to `smokeFreeStreak` (`src/domain/calc.ts:30–331`). This layer runs identically on the native app, the web server, and in Jest. Nothing in here can accidentally hit the network.

**Validation (`src/lib/validation.ts`).** Zod schemas for every value that can reach the database. `CigaretteLogSchema`, `ProfilePatchSchema`, `GoalSchema`, and so on are defined once and used by the repository layer before issuing any parameterized statement (`src/lib/validation.ts:89–290`). The schemas are also the source of truth for allowed enum values (trigger tags, moods, context tags, purchase modes). If a value passes Zod, it will pass the matching Postgres `CHECK` constraint — they are kept in sync intentionally.

**Repository (`src/db/repositories/`).** One file per database table. Each function calls `requireUserId()` to confirm the caller is authenticated before touching data (`src/db/repositories/_supabase.ts:4–12`). Writes always run through `parseOrThrow(SomeSchema, input, 'label')` before the Supabase call. DB errors are mapped to typed `AppError` codes (`authentication_error`, `rate_limited`, `conflict`, etc.) so callers never see raw Postgres error strings (`src/db/repositories/_supabase.ts:27–68`). The native app talks to the same repository functions as the server; the difference is which Supabase client they receive.

**Store (`src/store/`).** Four Zustand stores. `useSession` is the in-memory cache for the current user's data (`src/store/session.ts`): it holds the last 90 days of logs, all brands, all goals (any status), the profile, and the canonical per-day daily summary (`summary`, up to 365 days, floored at onboarding via `summarySinceYmd` so "saved" never counts pre-onboarding days), plus a per-session `achievementDismissCount` (drives celebration suppression — see Celebrations). It populates itself on `boot()` with five parallel Supabase calls, exposes per-slice `refresh*` actions plus a `refreshAll()`, wraps goal CRUD (`addGoal`/`updateGoal`/`setGoalStatus`/`removeGoal`), and is reset to empty on sign-out. `refreshSummary()` deliberately keeps the previous rows on a transient failure so a refresh after a log write never blanks the dashboard totals. Beside it, `ledgerTimeZone()`, `ledgerToday()` and `ledgerDaysAgo()` give native screens the profile country's zone (IST when none) for stamping logs and reading "today". `useAuth` holds only the Supabase `Session` object and an `initialized` flag (`src/store/auth.ts`). `useThemeStore` manages light/dark/system preference and persists it to AsyncStorage non-blockingly (`src/store/theme.ts:22–26`). `useOnboardingDraft` (`src/store/onboardingDraft.ts`) holds the multi-step onboarding wizard's in-progress field values so back/forward navigation doesn't lose them; it is in-memory only and cleared on onboarding completion and on logout (via `useSession.reset()`). The stores are deliberately narrow: domain computation is never done inside them.

**Server layer (`web/lib/server/data.ts`).** Next.js Server Components cannot use the Zustand stores — they run on the server, not in the browser. The server layer replicates the same data-fetching logic using React's `cache()` for per-request deduplication and Next.js `unstable_cache` for cross-request caching of slow or rarely-changing data like brands (`web/lib/server/data.ts:345–361`). Profile, logs, goals, and brands are fetched with the SSR Supabase client which reads its session from cookies set by `@supabase/ssr`. The page-level helpers (`getDashboardData`, `getTrendsPageData`, etc.) compose these cached fetchers and run everything in parallel with `Promise.all`.

### Data flow: logging a cigarette (native app)

1. The UI screen calls `useSession((s) => s.addLog)` with a `LogDraft`.
2. `addLog` in `session.ts` calls `logsRepo.createLog(draft)`.
3. `createLog` validates the draft against `CigaretteLogSchema`, then calls the `create_log_with_rate_limit` Supabase RPC (`src/db/repositories/logs.ts:203–246`). The RPC is a Postgres function that checks the rate limit and inserts the row atomically; it also accepts a `client_op_id` so a retry on a flaky network returns the original row rather than duplicating the entry.
4. The returned row is mapped from snake_case to camelCase and prepended to the in-memory `logs` array in the store — no re-fetch needed.

Cross-device/cross-screen freshness is handled by `RealtimeRefresher` (`src/components/realtime/RealtimeRefresher.tsx` native, `web/components/realtime/RealtimeRefresher.tsx` web), mounted once at the root. It subscribes to Supabase realtime CDC on `cigarette_logs`/`goals`/`user_profiles`/`brands`/`brand_variants` (filtered to the current user) and, on a change, calls the matching `useSession.refresh*` (native) or `router.refresh()` (web), debounced. The two files are kept in deliberate parity — same channel name, same subscription set — with the foreground trigger as the only intended difference (AppState native, `visibilitychange` web). Native additionally re-pulls on screen focus and app-foreground as a fallback (`src/hooks/useRefreshOnFocus.ts`), since mobile sockets drop while backgrounded.

### Data flow: viewing the dashboard (web)

1. Next.js calls `getDashboardData()` in the page's Server Component (`web/lib/server/data.ts:377–386`).
2. `getDashboardData` fetches the profile first (its `onboardedAt` floors the summary range), then four cached fetchers in parallel: `getServerLogs` (60-day window — still powers quick-log inference, insights, and the week strip), `getServerGoals`, `getServerBrandsWithVariants`, and `getServerDailySummary` (up to 365 days — the single source of truth for the dashboard's timeframe totals). `toDailySummaryRow()` adapts the server rows to the domain engine's shape.
3. Each fetcher calls `requireServerUserId()` which redirects to `/login` if the session is missing — no page-level auth guard needed.
4. Domain functions in `src/domain/` process the returned arrays in the Server Component or a Client Component to produce the numbers the user sees. No business logic runs inside Next.js route handlers.

### The `@/` alias and how it crosses runtimes

Both runtimes use `@/` to import from `src/`. In the native app, `tsconfig.json` maps `"@/*": ["./src/*"]` (`tsconfig.json:6`). In the web project, `web/tsconfig.json` maps `"@/*": ["../src/*"]` (`web/tsconfig.json:24`) and additionally maps several `@/lib/...` paths to web-specific shims (`web/tsconfig.json:19–27`). This means `src/domain/calc.ts` imports as `@/domain/calc` on both platforms without any change — but `src/lib/supabase.ts` (which uses `expo-secure-store`) is silently replaced by `web/lib/supabase/client` on the Next.js side.

The webpack config makes those shims explicit for the build: `web/next.config.mjs:56–78` uses `webpackConfig.resolve.alias` to point the absolute path of `../src/lib/supabase` to `./lib/supabase/client`, and does the same for `secureStore`, `catalogStorageNative`, `haptics`, `useTheme`, and `useReduceMotion`. Any RN-specific module that leaks into `src/` must get a shim entry here.

### The Metro / Hermes shim

Expo SDK 53+ enables package-exports resolution by default. When it resolves `@supabase/supabase-js`, the `import` condition in the package's exports map points to `dist/index.mjs`. That ESM file uses a dynamic `import(variableSpecifier)` for optional OpenTelemetry support. Hermes' bytecode compiler — used in EAS production Android builds — cannot statically compile a dynamic import with a non-literal specifier and fails the entire build.

The fix in `metro.config.js:19–31` intercepts the resolution of `@supabase/supabase-js` and returns the CJS build (`dist/index.cjs`) instead. The CJS build uses `require()` for the same optional dependency, which Metro/Hermes handle gracefully (the dependency is absent, so it resolves to `null` via the library's own `.catch(() => null)`). All other packages are left to resolve normally.

### The live database

The Supabase project `tvcwrsglceahkjnfuzkn` (region: us-east-2) holds these public tables, all with RLS enabled:

| Table | Purpose |
|---|---|
| `user_profiles` | One row per user. Baseline, consent timestamps, identity fields, onboarding state. FK → `auth.users`. |
| `brands` | User's cigarette brand catalog (seeded from defaults + user-added). |
| `brand_variants` | Variants per brand with rolling price statistics (`price_sum_inr`, `price_count`). |
| `cigarette_logs` | Every logged cigarette. Dual timestamp: `ts_utc` (absolute) + `local_date`/`local_hour` (derived in the ledger's zone, the profile country's, IST when there is none, for chart bucketing). `client_op_id` enables safe retries. |
| `goals` | Reduction/quit goals. `meta_json` holds type-specific configuration. |
| `settings_kv` | Arbitrary per-user key/value store (e.g. `consent.analyticsOptIn`). |
| `reminders` | Push notification schedules (schema exists; no rows yet). |
| `usage_events` | Analytics events written from the client (opt-in). |
| `audit_events` | Server-side record of account-level actions (delete, export, etc.). |
| `error_events` | Client-reported errors from `logClientError`. |
| `rate_limit_counters` | Sliding-window counters used by Postgres RPCs to enforce per-user rate limits. Identities are stored as keyed hashes, and rows older than two days are purged daily (`purge_rate_limit_counters`, scheduled by pg_cron). |
| `price_entries` | Intended for crowd-sourced pricing data (0 rows; not yet in use). |
| `user_facts_seen` | Tracks which motivational facts a user has seen. |

Every table uses `user_id = auth.uid()` RLS policies so no query from a client can touch another user's data. The `cigarette_logs` table additionally enforces constraints at the Postgres level (`quantity` 1–100, `purchase_mode` enum, `craving` 0–10, `total_price_inr` max ₹10,000) that mirror the Zod schemas exactly.

## Invariants

- Every repository write runs the input through the matching Zod schema via `parseOrThrow` before issuing a Supabase call. There is no write path that bypasses this (`src/lib/validation.ts:281–289`).
- `requireUserId()` (native) and `requireServerUserId()` (web) are called at the top of every function that touches user data. No repository function is callable anonymously.
- Domain functions in `src/domain/` have zero imports from `src/db/`, `src/lib/supabase`, or `src/store/`. They take plain arrays and return plain values. This is enforced structurally: nothing in that directory does async work.
- The `@/lib/supabase` import resolves to different files on native vs. web (via tsconfig paths and webpack alias), but both expose the same function signature. Code in `src/` that imports `getSupabase()` works on both platforms without modification.
- `src/lib/supabase.ts` throws at production web runtime: `if (Platform.OS === 'web' && process.env.NODE_ENV === 'production') throw new Error(...)` (`src/lib/supabase.ts:12–19`). This prevents the native-flavored client (which uses AsyncStorage for tokens) from ever running in production web, where the Next.js cookie-based client must be used instead.

## Edge cases & gotchas

**Numeric columns from Postgres arrive as strings.** Both `user_profiles.baseline_per_day` (a `numeric(5,2)`) and `brand_variants.avg_price_inr` are returned as strings by `supabase-js` because the JS driver cannot safely represent all Postgres `numeric` values as IEEE 754 floats. Every `rowToProfile` and `rpcRowToLog` mapper coerces these with `Number()`. If you add a new `numeric` column and forget to coerce, you will get silent string concatenation instead of arithmetic — the comment pattern `// numeric(x,y) is returned as string by the pg driver` marks every such coercion site.

**The `listLogs` helper is capped at 200 rows.** `listLogs` in `logs.ts` is a legacy flat-array helper. It internally delegates to `listLogsPage`, which uses a keyset-paginated RPC. If the result is capped and there is a next cursor, it fires `logClientError` as a migration hint (`src/db/repositories/logs.ts:333–338`). New code that needs deep history should use `listLogsPage` directly and loop over pages.

**`boot()` fetches a 90-day window, not the full history.** The session store loads only the last 90 days of logs on startup to keep the payload small (`src/store/session.ts`). History does not use `HISTORY_LOG_LOOKBACK_DAYS`. Web History calls `list_logs_page` with no `fromDate` (200-row keyset + Load older). Native History merges the 90-day boot slice with Load older; if the store is empty it fetches the first unbounded page so logs older than 90 days still appear.

**Web `unstable_cache` and the service-role key.** `getServerBrandsWithVariants` uses `unstable_cache` (Next.js Data Cache) for cross-request caching, but only when a service-role key is available. Inside `unstable_cache` callbacks, cookies are forbidden — so the RLS client cannot be used. The admin client bypasses RLS, but every query inside the cached callback is explicitly scoped to `userId` (`web/lib/server/data.ts:304–361`). If the service-role key is absent, the function falls back to the per-request RLS client, uncached.

**Expo web is dev-only.** `src/lib/supabase.ts` emits a `console.warn` in non-production Expo web builds reminding developers that tokens land in AsyncStorage there. The production web path is always the Next.js app.

## Tests

- `src/tests/calculations.test.ts` — unit tests for every function in `src/domain/calc.ts` and `src/domain/savings.ts`. No mocks; pure in/out.
- `src/tests/validation.schemas.test.ts` — verifies `YmdSchema`, `IdSchema`, and `GoalSchema` accept valid inputs and reject invalid ones (including impossible calendar dates like `2025-02-30`).
- `src/tests/repositories.test.ts` — repository tests with Supabase mocked via `jest.mock('@/lib/supabase')`. Verifies RPC call shapes, error mapping, pagination cap warning, and `listLogsPage` cursor logic.
- `src/tests/rls.integration.test.ts` — integration tests for RLS policies (requires a live Supabase test project; not part of the default `npm test` run).
- `src/tests/insights.test.ts`, `src/tests/health.test.ts`, `src/tests/correlations.test.ts`, `src/tests/goals.test.ts` — domain layer tests for the other files in `src/domain/`.

Run all unit tests: `npm test` from the repo root (uses `ts-jest`, environment: `node`).

## Open gaps

- **History is lifetime keyset pagination.** Web `getHistoryPageData` / `fetchMoreHistoryLogs` omit `fromDate` so `list_logs_page` returns this user's logs since the first entry, 200 at a time. Native History probes `listLogsPage` without a date cap (including when the 90-day store is empty). Dashboard / Trends / Goals still use their 60–90 day raw-log windows.
- **`price_entries` table is unused.** It was designed for crowd-sourced brand pricing but has 0 rows and no corresponding repository code or UI.
- **`reminders` table has no rows.** The schema exists and the `ReminderKindSchema` is defined in `src/lib/validation.ts:81`, but the notification scheduling feature is not implemented.
- **`src/store/session.ts` has no persistence.** The store is purely in-memory and always re-fetches from Supabase on `boot()`. There is no offline queue; writes made without a network connection will simply fail.

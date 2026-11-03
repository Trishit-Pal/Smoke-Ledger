# Ask the ledger everywhere: floating chat on web and mobile, strict account-only guardrails, chat e2e in CI

## Context

"Ask the ledger" (PR #103, merged 2026-11-02) is built but only reachable as a small link on Dashboard and Trends (web only). It is off in production (`LEDGER_CHAT_ENABLED=false`, no key). Its e2e spec has never run, because no CI job with a database sets the flag. The owner wants it on every signed-in page as a floating text box, on web and mobile. They want guardrails that let it read only what the reader's own account holds (logs, changes, trends, goals, shared context), with an explicit in-scope / out-of-scope list enforced in code. CI must prove the panel, consent and clearing with a mocked model.

Separately, PR #105 (feat/goals-adaptive) is red on one real discreet leak: on `/trends` in discreet mode the seeded brand name appears once in the page (3 of 5 viewports). It is fixed first (Phase 0).

## Owner decisions (2026-11-03)

| # | Decision |
|---|---|
| C1 | Form: desktop shows a docked "Ask the ledger…" text box bottom-right (Enter opens the panel with the question). Phone web shows an "Ask" pill above the bottom nav. Both can be minimised, remembered per device. |
| C2 | Pages: Dashboard, Trends, History, Goals, Settings. Not Log, onboarding, /consent, legal or public pages. |
| C3 | "Changes" adds goal history, price history and entry edit history (edited-on dates only; no before/after values exist). |
| C4 | Identity fields (name, DOB, gender, email, phone, place) stay out of the chat, as V3 promises. |
| C5 | CI: the responsive job (local Supabase) also runs ledger-chat, the new dock spec, consent and goals specs on Chromium with the flag on and the model mocked. |
| C6 | Production stays off; the owner flips it after the V3 bump, the audit-record redeploy and a live probe. |
| C7 | Fix the /trends leak on #105 first; chat work on new branch `feat/ask-everywhere` off it, its own PR into main after #105. |
| C8 | Web and mobile. |

## Guardrails (the contract; one source in code, tested)

**In scope: what the chat may read (the reader's own rows only, via RLS-scoped queries):**
- Entries in the last 90 days: time, sticks, brand alias or name, variant, price paid, purchase mode, mood before and after, trigger, craving, context, notes. In discreet mode, brands are aliased and notes and variants are dropped.
- Daily totals for up to 365 days (floored at onboarding), and the comparisons, trends, peaks and savings computed from them.
- Goals: active goals with live state and proposals (today), plus **new** goal history (paused, completed, abandoned; type, target, dates, outcome).
- **New** price history: the reader's own `price_entries` (brand alias or name, unit price, pack size, observed date), 365 days.
- **New** entry edits: entries whose `updated_at` is later than `created_at`, as "entry of <date/time> edited on <date>". No before/after values exist.
- Context line: today's date, time zone, currency, locale, baseline per day, discreet on or off.

**Out of scope: never loaded, never sent, refused if asked:**
- Identity: name, date of birth or age, gender, email, phone, place. Enforced structurally: the tool context is built from an allowlist, and a test fails if any identity key or value reaches the model payload.
- Account machinery: sign-in history, audit, error and usage/analytics events, consents, legal versions, settings other than discreet, device data.
- Anyone else's data; aggregates across users; general knowledge, news or web; tobacco product advice or recommendations; prices not in the reader's ledger.
- Health: medical advice, diagnosis, health claims, cessation methods (one-sentence redirect, existing).
- Judgement and pressure: praise, scolding, streak language, nagging (existing word ban).
- Anything older than the windows above; forecasts beyond the existing `spend_outlook`.

**Enforcement (each with a test):**
1. **Scope as data.** `src/domain/ledgerChat/scope.ts` holds IN_SCOPE and OUT_OF_SCOPE lines. The system prompt renders them verbatim, and the consent notice renders the in-scope summary. A test asserts every line appears in both.
2. **Allowlisted context.** `buildToolContext` copies only allowlisted profile fields. A test fails if a fixture profile's identity values appear anywhere in the serialised context or tool results.
3. **Figures guard** (existing, digits). It is extended to **number words**: English cardinals above "two", hundred, thousand, lakh, crore, percent, and Hinglish ek–das. These count as figures unless they are in a duration or time context. Discreet mode blocks them outright. This closes the open gap N2.
4. **Consent current.** The route returns 403 `consent_outdated` when `consentsOutdated(profile)` is true, besides the existing chat opt-in check. This fails closed, and also covers mobile, whose gate has gaps.
5. **Off-topic, health and injection** (existing prompt rules, now driven by scope.ts). Tool data is data, never instructions. Prompt-content tests pin the refusal sentences.
6. **Caps and size** (existing): 20 per user and 500 overall per day, 800-character answer, sanitised plain text, no links.

## Approach

**Web dock.** A client `AskLedgerDock` is mounted once in `web/app/(app)/layout.tsx`. The layout reads `isLedgerChatEnabled()` (`web/lib/server/ledgerChat/enabled.ts`) and passes a boolean, with no data load per page view. The dock hides itself on `/log` via `usePathname`. On first open it calls a new **GET `/api/ledger-chat`**, using the same `resolveChatCaller` and the same gates, which returns `{ consented, discreet, currency, starters }`. Starters come from the existing `starterQuestions` and `buildToolContext` (`src/domain/ledgerChat/starters.ts`, `context.ts`), so the panel no longer needs page props. `AskLedgerPanel` gains an `initialQuestion`. The page links on Dashboard and Trends are removed (the dock replaces them).

**Mobile.** The service `src/services/ledgerChat.ts` POSTs and GETs `${EXPO_PUBLIC_WEB_BASE_URL}/api/ledger-chat` with the session token as Bearer (the route already supports it). It adds:
- an `app/ask.tsx` modal screen with the consent notice from shared text, the starters, the answer and labelled rows masked via `src/lib/discreet.ts`;
- a floating `AskPill` in `app/(tabs)/_layout.tsx` on every tab except Log;
- the build-time flag `EXPO_PUBLIC_LEDGER_CHAT_ENABLED`, default false; a 503 is shown calmly;
- the opt-in toggle in mobile Settings › Privacy, writing `consent.ledgerChatOptIn` in settings_kv and the `ledger_chat_consent_toggled` audit row, as on web.

The mobile transcript lives in memory only. It holds no device store, and closing the screen clears it.

**Shared.** The notice text moves from `web/components/chat/notice.ts` to `src/domain/ledgerChat/notice.ts`, and web re-exports it. The row display and masking helpers are reused from `src/lib/discreet.ts`.

**New tools** (`src/domain/ledgerChat/tools.ts`, same `runTool` and outcome shape, so the figures guard harvests them):
- `goal_history`
- `price_history`
- `entry_edits`

The route adds two cheap loads: `loadGoals(db, userId, { activeOnly: false })` and the reader's price entries for 365 days (new `loadPriceEntries` in `web/lib/server/data.ts`). Edits come from the logs already loaded; the log row maps `updated_at`.

**Lifecycle.** A new registry row `web.chatDockMinimised` is a device preference: not personal and kept. Mobile adds no store.

**Analytics.** `ledger_chat_opened { surface: 'dock'|'pill'|'link', page }` is sent only under the existing analytics opt-in. It carries no question text.

## Phases

### Phase 0: green PR #105 (on feat/goals-adaptive)
Verified when: the responsive-e2e check passes on #105.
- **0.1 Find and fix the /trends discreet brand leak (S).** Trace every brand render on Trends with discreet on (brand list, donut legend, tooltip and data table, BarChart3D, the insights and paragraph copy). Mask it at the render site with `maskBrandAt`/`brandAlias`. Add a unit test on the leaking component. Verify with `cd web && npx vitest run` and CI on #105. Files: `web/app/(app)/trends/TrendsClient.tsx` or the chart component found. Blocked by: none.

### Phase 1: guardrails and data scope (shared, risk first)
Verified when: root jest and web vitest pass, including the new scope, allowlist, number-word and consent tests.
- **1.1 scope.ts plus the prompt rendered from it, plus the notice moved to src/domain (S).** Tests: every scope line appears in the prompt and the notice. Files: `src/domain/ledgerChat/{scope,notice}.ts`, `web/lib/server/ledgerChat/prompt.ts`, `web/components/chat/notice.ts`. Blocked by: 0.1.
- **1.2 Allowlisted context and the identity-leak test (S).** Files: `src/domain/ledgerChat/context.ts`, `src/tests/ledgerChatContext.test.ts`. Blocked by: 1.1.
- **1.3 Number-word guard (S).** Figures, durations, discreet. Files: `src/domain/ledgerChat/guard.ts`, `web/lib/server/ledgerChat/turn.ts`, a guard test. Blocked by: none.
- **1.4 Route: consent_outdated gate plus GET (state and starters) (S).** Files: `web/app/api/ledger-chat/route.ts`, `web/__tests__/ledgerChatRoute*.test.ts`. Blocked by: 1.1.
- **1.5 Tools goal_history, price_history, entry_edits plus loaders (M).** Files: `src/domain/ledgerChat/tools.ts`, `web/lib/server/data.ts`, the route, the log mapper (updatedAt). Blocked by: 1.2.

### Phase 2: web floating dock
Verified when: web vitest, typecheck and lint pass and `next build` is green. The new `ask-dock.spec.ts` passes locally with `--list` and in CI.
- **2.1 AskLedgerDock in the (app) layout, the GET on open and the panel initialQuestion; remove the page links (M).** It needs:
  - a desktop box and a phone pill above the bottom nav (z-index under modals, safe-area aware);
  - Esc and focus handling;
  - a reduced-motion fallback;
  - DESIGN.md tokens (editorial, quiet, no alarm colour).

  Files: `web/components/chat/AskLedgerDock.tsx`, `AskLedgerPanel.tsx`, `web/app/(app)/layout.tsx`, `DashboardClient.tsx`, `TrendsClient.tsx`. Blocked by: 1.4.
- **2.2 Minimise per device plus the lifecycle row plus analytics opened (S).** Files: the dock, `src/lib/privacy/lifecycle.ts`, `web/lib/privacy/clearDevice.ts`, `src/constants/events.ts`. Blocked by: 2.1.
- **2.3 ask-dock.spec.ts (S).** The dock shows on dashboard, trends, history, goals and settings, and is absent on log, consent and onboarding. Enter opens the panel prefilled. Minimise persists. A 390px viewport shows the pill and no overflow. Blocked by: 2.1.

### Phase 3: mobile
Verified when: root jest, typecheck and lint pass, and a manual Expo run shows the pill, consent, an answer and masking.
- **3.1 ledgerChat service (fetch, Bearer, error mapping) plus tests (S).** Files: `src/services/ledgerChat.ts`, `src/tests/ledgerChatService.test.ts`. Blocked by: 1.4.
- **3.2 app/ask.tsx screen: consent notice, starters, answer, rows masked (M).** Blocked by: 3.1.
- **3.3 AskPill in the tabs layout (not Log) plus EXPO_PUBLIC flag plus the Settings opt-in toggle (S).** Files: `app/(tabs)/_layout.tsx`, `app/(tabs)/settings.tsx`, `.env.example`. Blocked by: 3.2.

### Phase 4: CI
Verified when: on the new PR, the responsive-e2e job shows the chat, dock, consent and goals specs passing.
- **4.1 Responsive job (S).**
  - Job-level env `LEDGER_CHAT_ENABLED: 'true'`, so the responsive sweep also checks the dock fits every viewport.
  - A new step after the sweep runs `npx playwright test ledger-chat.spec.ts ask-dock.spec.ts consent.spec.ts goals.spec.ts` (Chromium project) on the same local stack.
  - Specs must not depend on edge functions; an audit-record failure must leave the UI working (check, fix if not).

  Files: `.github/workflows/ci.yml`, possibly `web/e2e/_helpers/*`. Blocked by: 2.3.

### Phase 5: docs and owner steps
Verified when: `npm run spec:test` and `spec:drift` pass and the promise tests pass.
- **5.1 Policy and docs (S).**
  - The privacy page and policy doc list the new chat data (goal history, price history, edit dates). The promise tests are updated.
  - Owner-actions gains a "Turn on Ask the ledger" section: key, flag, the audit-record redeploy, the EXPO_PUBLIC flag in the mobile build, a live probe, after the V3 bump.
  - Spec 01, 03 and 08 and the glossary are refreshed via `.claude/skills/spec-update`.
  - Memory is updated.

  Blocked by: 3.3, 4.1.

## Decision log

| Decision | Chosen | Why |
|---|---|---|
| Data for starters on a global dock | GET on first open | Layout stays query-free; free-tier cost only when used |
| Mobile transcript | Memory only | No new device store, nothing to clear or disclose; web keeps its device transcript |
| Mobile flag | Build-time EXPO_PUBLIC flag | No per-launch probe request; server 503 still handled |
| Number words | Treated as figures | Closes N2; the prompt already forbids figures, so cost is a rare retry |
| Consent check in route | Fail closed on outdated versions | Server-side guardrail; mobile gate has gaps |
| Edit history | Edited-on dates only | No before/after values are stored; analytics events are opt-in, unlinked and out of scope |

## Not yet specified
- Phase 0: which component leaks the brand on /trends. Found by tracing at pickup. If tracing fails, run the responsive spec locally against Docker Supabase.
- Phase 3: whether the Expo tab bar overlays any existing floating element (FAB). Checked at pickup.

## Always / Never
- Always: reader's own data only; every scope line enforced by a test; discreet masking at render sites (web and mobile rows) and aliasing before the model; calm editorial copy; reduced-motion fallback; TDD; no new dependency.
- Never: identity, account-machinery or analytics data in the chat; turning the production flag on; pushing to main or applying migrations; a chat box on Log, onboarding, /consent, legal or public pages; storing questions or answers server-side.

## Verification
1. Root: `npm run typecheck && npx jest && npm run lint`. Web: `cd web && npm run typecheck && npm run lint && npx vitest run && npx next build`.
2. `E2E_RESPONSIVE=1 npx playwright test --list` and `npx playwright test ledger-chat.spec.ts ask-dock.spec.ts consent.spec.ts goals.spec.ts --list` compile. CI runs them on the local stack.
3. CI on #105 is green after Phase 0. CI on the new PR shows the responsive-e2e job running the chat, dock, consent and goals specs.
4. Manual web (dev, flag on, mocked or real key): the dock is on 5 pages and not on Log; Enter opens the prefilled panel; discreet masks rows. An identity question ("what's my name?") gets the out-of-scope sentence.
5. Manual mobile (Expo, flag on, base URL to a dev server): the pill is on 5 tabs, the consent toggle works, and an answer appears with rows masked in discreet mode.

## Progress
| Phase | Status |
|---|---|
| 0 Leak fix on #105 | done (3aa2f5f on feat/goals-adaptive) |
| 1 Guardrails & scope | pending |
| 2 Web dock | pending |
| 3 Mobile | pending |
| 4 CI | pending |
| 5 Docs | pending |

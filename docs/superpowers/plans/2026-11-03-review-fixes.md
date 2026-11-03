# Review fixes — HIGH + release gate, then the MEDIUM groups

Workflow: superpowers:subagent-driven-development (fresh implementer per task, TDD, task review after each, final whole-branch review per phase). Implementers load `ponytail:ponytail`; UI tasks also load `frontend-design:frontend-design` and read PRODUCT.md + DESIGN.md. The opt-in decision is recorded as an ADR (engineering:architecture format). Repo plan copy: `docs/superpowers/plans/2026-11-03-review-fixes.md` (Task 0).

## Context

A six-reviewer split review of `f032200..312eafd` (2026-11-03) found four HIGH defects, a release gate that code does not enforce, and ~20 MEDIUM defects. Everything up to 029c645 is already in Production (merging to main auto-deploys Vercel). The "Ask the ledger" chat is off in Production behind `LEDGER_CHAT_ENABLED` and is about to be turned on; PR #107 (this branch, `docs/ask-everywhere-policy`) must merge first.

- **H1 (live now):** spend caps propose and accept values > 1,000, but `GoalSchema` (`src/lib/validation.ts:154,173,320`) and the DB CHECK `goals_target_value_check` (`supabase/migrations/20260519100000_hardening_and_compliance.sql:205`, `target_value double precision`) cap every type at 1,000. ₹200/day → weekly proposal ₹1,260 → save throws. Same 1,000 used as `MAX_REANCHOR_VALUE` (`src/domain/goalProposals.ts:38`).
- **H2:** web Settings renders the chat switch with no flag check (`web/app/(app)/settings/SettingsClient.tsx:1151`), and the opt-in is a bare `true` (`settings_kv` key `consent.ledgerChatOptIn`), so an opt-in given to #103's narrower notice carries over at turn-on.
- **H3:** `AskLedgerPanel.tsx:148-185` reads hideTotals/currency/locale from GET once per mount (`fetchedRef`); the dock lives in `web/app/(app)/layout.tsx`; Settings only calls `router.refresh()` → stale masking.
- **H4:** mobile `textFaint` (`src/constants/theme.ts`, light `#A9B3BF` ≈2.0:1, dark `#5A6673` ≈3.3:1) fails AA; consent copy uses it (`app/consent.tsx:98-120`, `app/onboarding/privacy.tsx:304`). Web already fixed this token (`web/app/globals.css`: `--text-faint` `#64707D` / `#7D8896`, pinned by `web/__tests__/tokenContrast.test.ts`).
- **Release gate:** `LEGAL_VERSIONS.privacy` (`src/lib/legal.ts`) is still `2026-11-02` though the policy text changed 2026-11-03; the bump waits on the EU representative (O1, `src/tests/legal-release-gate.test.ts`). Nothing stops the chat being switched on in Production before the bump.

## Decisions

| # | Decision | Chosen |
|---|---|---|
| D1 | Release gate | **Code gate; bump waits** (user). Production chat is off, whatever the flag says, until `LEGAL_VERSIONS.privacy > '2026-11-02'`. Preview/dev/CI unaffected (`VERCEL_ENV !== 'production'`), so owner-actions §8 step 3 "Preview first" still works. |
| D2 | H2 shape | **Version the opt-in** (user). `value_json` holds `LEDGER_CHAT_NOTICE_VERSION` (string) instead of `true`; only the current version counts. Off stays `false`. No migration: existing `true` rows read as "not consented". |
| D3 | Mobile MEDIUM group | **Included** (user), as its own tasks in Phase B. |
| D4 | H1 limit | Per unit: sticks ≤ 1,000 (unchanged), money (`spend_cap_daily`) ≤ 100,000 — covers ₹1,000/day × 30 with headroom; EUR is far below. One shared `maxTargetFor(type)`; DB CHECK becomes per-type. |
| D5 | Re-anchor above the max | Return no proposal rather than a clamped value whose copy ("is where you are now") would be false (also closes the LOW copy finding). |
| D6 | H3 shape | Re-read GET state on **every open** (reset `fetchedRef`/`stateLoadRef`, clear `state` and `revealed` on close, so figures stay masked until fresh state lands). The GET cap was sized for opens (`DEFAULT_STATE_CAP` = "dock opens per reader per day"). No layout profile read. |
| D7 | H4 shape | Align mobile `textFaint` with the web AA values (`#64707D` light, `#7D8896` dark): root-cause fix for all 60 usages, not per-screen swaps. New root jest contrast test for the mobile theme. |
| D8 | Branches / PRs | Phase A on `fix/review-highs` from 312eafd (includes #107; shrinks to our commits once #107 merges) → PR into main. Phase B on `fix/review-mediums` from Phase A's tip → PR into main after A merges (CI only runs on PRs into main). Push by URL; `gh --repo Trishit-Pal/Smoke-Ledger`. Push/PR only after the user approves at finishing. |
| D9 | Workspace | Branch in the main checkout, no `.claude/worktrees` (root jest ignores `\.claude\` → zero tests there). |
| D10 | Models | Implementers: sonnet (opus for Task 3 and Task 7). Task reviewers: sonnet. Final phase reviews: opus. |
| D11 | Scope | HIGH, release gate, MEDIUM groups Chat / Accessibility / Goals-privacy-CI / Mobile. LOW findings are out of scope except where a task's own fix closes one (D5, D6 `revealed`). |

## Always / Never (global constraints for every task)

- TDD: failing test first, then code. One runnable check per non-trivial branch. Fix root causes where all callers route through.
- Never `true`-check the chat opt-in anywhere; always `isCurrentChatOptIn(value)`.
- Discreet masking happens at every render site; fail closed (mask) while state is unknown.
- Tokens, not literals; teal = positive only, terracotta for concern, never alarm-red; reduced-motion fallback for any motion; AA in light and dark.
- Money/calendar follow the reader's country (INR/IST unless EU).
- Root jest runs from the repo root (`npx jest <path>`); web tests `cd web && npx vitest run <path>`. Write regex/backslash code with Edit/Write, never shell heredocs.
- Every changed behaviour gets a code comment where the *why* is non-obvious (no narration comments). Mark deliberate shortcuts `ponytail:` with their ceiling.
- No new dependencies. No edits to `LEGAL_VERSIONS` or `EU_REPRESENTATIVE`.
- Implementers never dispatch subagents.

## Phase A — HIGH + release gate (branch `fix/review-highs`)

### Task 0 — Branch and plan copy (XS)
Create `fix/review-highs` from 312eafd. Copy this plan to `docs/superpowers/plans/2026-11-03-review-fixes.md`; commit `docs(plan): review fixes`.

### Task 1 — H1: goal targets bounded per unit (M, sonnet)
- `src/lib/validation.ts`: export `MAX_STICK_TARGET = 1_000`, `MAX_MONEY_TARGET = 100_000`, `maxTargetFor(type)`. `GoalSchema`: `targetValue` `.positive().max(MAX_MONEY_TARGET)` plus a refine that applies `maxTargetFor(type)`. `GoalPatchSchema` and `ImportGoalSchema` use `MAX_MONEY_TARGET` (the DB per-type CHECK is the authority for patches). `currentBaseline` unchanged.
- `src/domain/goalProposals.ts`: start proposals return `null` when the value exceeds `maxTargetFor(type)`; replace `MAX_REANCHOR_VALUE` with `maxTargetFor(goal.type)` and return `null` above it (D5).
- `src/domain/goalForm.ts:164`: reject `v > maxTargetFor(form.type)` with `Enter a target no higher than <formatted max>.` (use the existing money/number formatter the form already uses).
- Migration `supabase/migrations/20261105100000_goal_target_by_unit.sql`: drop `goals_target_value_check`, add `CHECK (target_value > 0 AND target_value <= CASE WHEN type = 'spend_cap_daily' THEN 100000 ELSE 1000 END)`; idempotent like its neighbours; header comment says why and that `src/lib/validation.ts` mirrors it.
- `scripts/sql/smoke.sql`: assert via `pg_get_constraintdef` that the constraint mentions `spend_cap_daily` and `100000`.
- Tests: `src/tests/goalProposals.test.ts` (weekly ₹200/day → 1,260 accepted by `GoalSchema`; re-anchor above max → null), `goalForm.test.ts` (max per type), `validation.schemas.test.ts` (sticks 1,001 rejected, money 100,000 accepted, 100,001 rejected), a migration test parsing the new CHECK numbers against `MAX_*` constants so SQL and Zod can't drift.
- `docs/legal/owner-actions.md` §1 step 2: add the migration to the ordered list (apply before or with the deploy; deploying web first is no worse than today).

### Task 2 — Release gate in code (S, sonnet)
- `src/lib/legal.ts`: `CHAT_UNDISCLOSED_PRIVACY = '2026-11-02'` (the last privacy version that does not describe the chat's full scope) and `isChatPolicyLive(privacy = LEGAL_VERSIONS.privacy)` → `privacy > CHAT_UNDISCLOSED_PRIVACY`. Comment ties it to owner-actions §8 step 1.
- `web/lib/server/ledgerChat/enabled.ts`: `isLedgerChatEnabled()` = flag && (`process.env.VERCEL_ENV !== 'production'` || `isChatPolicyLive()`). Every web surface (layout dock, route GET/POST, Task 3's Settings gate) already routes through it.
- `src/lib/askPill.ts` `isLedgerChatEnabled(flag, privacy = LEGAL_VERSIONS.privacy)`: flag && `isChatPolicyLive(privacy)` (mobile builds have no Preview; the web route enforces the gate for them too).
- Tests: `src/tests/askPill.test.ts` (flag on + old privacy → false; + newer → true), new `web/__tests__/ledgerChatEnabled.test.ts` (production + old → false; preview + old → true; flag off → false). Extend `legal-release-gate.test.ts`: `CHAT_UNDISCLOSED_PRIVACY` equals its `PUBLISHED.privacy`.
- `docs/legal/owner-actions.md` §8 step 1: note the chat now refuses to start in Production until the bump; also fix the duplicate "## 8" heading numbering.

### Task 3 — H2: versioned chat opt-in; Settings switch behind the flag (M, opus)
- `src/domain/ledgerChat/notice.ts`: `LEDGER_CHAT_NOTICE_VERSION = '2026-11-03'` and `isCurrentChatOptIn(value: unknown): boolean` (`value === LEDGER_CHAT_NOTICE_VERSION`). Re-export from `web/components/chat/notice.ts` like the rest.
- Writers store the version on opt-in, `false` on opt-out: `web/components/chat/AskLedgerPanel.tsx:256`, `SettingsClient.tsx:449`, `src/services/ledgerChat.ts` `setLedgerChatOptIn`.
- Readers use `isCurrentChatOptIn`: `web/app/api/ledger-chat/route.ts` `readChatOptIn`, `web/lib/server/data.ts:562-568`, `src/services/ledgerChat.ts` `readLedgerChatOptIn`.
- Audit: add `noticeVersion` to `ledger_chat_consent_toggled` props (`src/services/audit.ts:95`, `web/app/api/audit/schema.ts`, check `supabase/functions/_shared/auditAllowlist.ts` lets the key through); both writers send it. owner-actions §8 step 2 already says redeploy `audit-record`.
- Flag gate: `web/app/(app)/settings/page.tsx` passes `chatEnabled={isLedgerChatEnabled()}`; `SettingsClient` renders the "Ask the ledger" row and its notice dialog (~1151-1173, ~1230) only when true.
- Drift test (`web/__tests__/ledgerChatScope.test.ts`): pin a sha256 of `LEDGER_CHAT_NOTICE_TEXT` beside `LEDGER_CHAT_NOTICE_VERSION`; on mismatch fail with "notice text changed: bump LEDGER_CHAT_NOTICE_VERSION and update this hash".
- Update tests that pin `setSetting('consent.ledgerChatOptIn', true)` (`web/__tests__/ledgerChatPanel.test.ts:40,134`, `src/tests/ledgerChatService.test.ts:178-195`, route handler tests) and the e2e seed (`web/e2e/ledger-chat.spec.ts:86` → the version). Add: a stored `true` reads as not consented (route GET returns `consented: false`).
- ADR `docs/architecture/ledger-chat-consent-adr.md`: context, options (version / one-time reset / boolean), decision D2, consequences (each notice change re-asks; mobile and web must ship the same version).

### Task 4 — H3: panel re-reads its state on every open (S, sonnet)
- `AskLedgerPanel.tsx` open effect: on close, reset `fetchedRef`, `stateLoadRef`, set `state` to `null` and `revealed` to an empty set; on open, always load. `hidden` stays `true` while `state` is `null` (existing fail-closed default). Update the "read from GET once per mount" comments here and in `web/app/(app)/layout.tsx`.
- Test: extend `web/e2e/ask-dock.spec.ts` (GET is mocked there): open → close → toggle Hide totals in Settings → reopen → amount masked. If a vitest unit can drive the effect without new deps, add it; otherwise source-order checks are not enough on their own: the e2e is the gate (runs in CI).

### Task 5 — H4: mobile faint text meets AA (S, sonnet)
- `src/constants/theme.ts`: `textFaint` light `#64707D`, dark `#7D8896` (the web values), comment pointing at the web token.
- New `src/tests/themeContrast.test.ts`: text/textMuted/textFaint on bg/card/bgElevated ≥ 4.5 in both themes (same WCAG formula as `web/__tests__/tokenContrast.test.ts`).
- DESIGN.md: note mobile and web faint tokens now match.

### Task 6 — Phase A docs and memory (S, controller + spec-update)
- Run the `spec-update` skill for sections touched (goals 06, security-privacy 08, data-model 02).
- Memory: update `ledger-chat-roadmap.md` (versioned opt-in, code gate, Settings switch now flag-gated, turn-on still needs bump + `audit-record` redeploy + new goals migration); add `[[goal-target-limits]]` only if a non-obvious fact remains after the code says it (otherwise skip). Update MEMORY.md index.
- Final Phase A review (opus) → one fix wave → superpowers:finishing-a-development-branch (push + PR with the user's OK).

## Phase B — MEDIUM groups (branch `fix/review-mediums` from Phase A tip)

### Chat (bites once the flag is on)
### Task 7 — Discreet and verified-figure guard (M, opus)
- `src/domain/ledgerChat/guard.ts`: treat every Unicode decimal digit as a digit (normalise `\p{Nd}` to ASCII before `NUMBER_TOKEN`, `u` flag); add `zero`; in `harvest`, don't mine numbers out of date/time strings (ISO dates, hours) — figures come from numeric fields only; drop the "rounds to an allowed integer" pass at line 81 (decimals pass only via the `toFixed` forms `addNumber` already adds).
- `src/lib/discreet.ts:59` `maskNumbers`: mask Unicode digits too.
- `web/lib/server/ledgerChat/prompt.ts`: in discreet mode the reply language is English (one line), so the English+Hinglish word list is complete. `ponytail:` comment names the ceiling (non-English discreet replies) and the upgrade (per-language word lists).
- Tests: `src/tests/ledgerChatGuard.test.ts` with the five strings from the review, date-component cases, "₹18.40" vs allowed 18.

### Task 8 — Tool rows per call; bounded tool text (S, sonnet)
- Row ids unique per tool call (suffix the call index) where `turn.ts:133` dedupes; both September and October rows render.
- `src/domain/ledgerChat/tools.ts`: brand/variant/trigger/context/mood strings pass through the same trim + control-char strip as notes (reuse that helper; pick a cap constant in `types.ts`).
- Tests in `ledgerChatTools.test.ts` / `ledgerChatTurn.test.ts`.

### Task 9 — Late answers and the caller guard (S, sonnet)
- `AskLedgerPanel.tsx` `send`: a clear/sign-out/discreet/opt-out bumps a generation ref; a response from an older generation is dropped, never saved.
- `web/lib/server/ledgerChat/auth.ts`: real unit tests of `resolveChatCaller` (mock the supabase client): cross-origin cookie request refused; Bearer with unconfirmed email refused; valid Bearer accepted.

### Accessibility — web and mobile chat
### Task 10 — Web chat panel a11y (S, sonnet + frontend-design)
- Answers inside the `aria-live="polite"` region (or announce the newest answer there); focus returns to the dock control on close (`onCloseAutoFocus`); on open focus the question box (`onOpenAutoFocus`), never "Clear conversation"; dock Minimise/Show move focus to the swapped control.
- Test: e2e keyboard checks in `ask-dock.spec.ts`; replace the string-only `aria-live` assertion.

### Task 11 — Warn text uses the ink token (XS, haiku, batch)
`var(--warn-earth)` → `var(--warn-earth-ink)` for text at `web/app/consent/ConsentClient.tsx:161`, `web/app/(auth)/login/page.tsx:756`, `web/app/onboarding/privacy/OnboardingPrivacyClient.tsx:199`, `web/app/(app)/history/HistoryClient.tsx:519`. Extend `tokenContrast.test.ts` with `--warn-earth-ink` on bg/card.

### Mobile
### Task 12 — Mobile Ask screen (M, sonnet + frontend-design)
- `app/ask.tsx`: KeyboardAvoidingView `behavior` `'height'` on Android (match `app/log/new.tsx`), `keyboardVerticalOffset` for the iOS page sheet; ScrollView ref + `scrollToEnd` on new content; announce a new answer (`AccessibilityInfo.announceForAccessibility`) and put answers in the live region; reset `waitingTaken` when a new consent prompt appears; Close/Not now fall back to `router.replace('/(tabs)')` when `!router.canGoBack()`.
- `src/components/ask/LedgerChatSetting.tsx`: switch reflects saved state only; a flip back during confirm cancels without writing a setting or audit row.
- Tests: extract pure helpers into `src/lib/askView.ts` where logic branches (waiting-question reset, back fallback) and test them.

### Task 13 — Mobile root guard and consent row labels (S, sonnet)
- `app/_layout.tsx`: one guard for every non-auth route (session → onboarding → `consentGateRedirect`), reusing the `(tabs)/_layout.tsx` logic (move, don't copy); closes owner-actions §8 "Mobile app/log/new and app/goals/new are not behind the consent gate" (tick it).
- `app/onboarding/privacy.tsx:320` `ConsentRow`: Switch gets `accessibilityLabel` = the row label.
- Test: pure route-guard decision function tested in `src/tests/consent-gate-wiring.test.ts`.

### Task 14 — Mobile delete/withdraw safety (S, sonnet)
- `app/(tabs)/settings.tsx:890-899`: `?action=delete` resumes only if this device started the re-auth detour (a SecureStore nonce with a short expiry set before the detour, consumed on resume); otherwise ignore the param.
- `:851,915`: write `consent_revoked` only after the erase/delete succeeds; keep the `withdraw` flag across the resume.
- Tests in `src/tests/consentWithdrawal.test.ts` / `deleteUserAccount.test.ts` for order and the nonce.

### Task 15 — Old builds and `marketing_consent_at` (XS, sonnet)
Migration `20261105110000_marketing_consent_null_trigger.sql`: replace the CHECK `user_profiles_marketing_consent_unused` with a BEFORE INSERT/UPDATE trigger that sets `marketing_consent_at := NULL`, so an old build's consent write succeeds instead of failing 23514. SECURITY INVOKER, `search_path` pinned. Migration test + smoke.sql existence check; owner-actions §1 migration list.

### Goals, privacy and CI
### Task 16 — Goal reconcile and completion dates (S, sonnet)
- `src/db/repositories/goals.ts` / `src/services/goalReconcile.ts`: status transitions update `WHERE status = 'active'` and report rows changed; 0 rows = not applied (no "Quit day." moment). Meta write merges onto the current row's meta rather than replacing it.
- `completedAt` formatted in the reader's zone (existing `ledgerTimeZone` / `timezoneForCountry`): `web/app/(app)/goals/GoalCard.tsx:115`, `app/(tabs)/goals.tsx:259`.
- Tests: `goalReconcile.test.ts`, `goalCardModel`/view tests.

### Task 17 — Analytics consent cache cleared on erase (XS, haiku)
Call `invalidateAnalyticsConsentCache()` (`src/services/analytics.ts`) in the erase paths (`SettingsClient.tsx:727-744`, `app/(tabs)/settings.tsx:916-919`), as delete already does. Test beside `deleteUserAccount.test.ts`.

### Task 18 — CI pin and DB tests (S, sonnet)
- Add `supabase` as an exact-version root devDependency so `npx supabase` resolves locally; `persist-credentials: false` on checkouts in the jobs that run it (`.github/workflows/ci.yml`).
- Jest parity test: the rank table in `20261101120000_onboarding_step_monotonic.sql` matches `ONBOARDING_STEP_INDEX` (`src/lib/onboardingSteps.ts`); smoke.sql checks `keep_onboarding_step_monotonic` and `goals_stamp_completed_at` triggers exist.

### Task 19 — Phase B docs and memory (S, controller + spec-update)
spec-update for touched sections (08 security-privacy, 06 goals, 01 architecture); memory updates (ledger-chat-roadmap open items closed; local-dev-environment if anything new bit). Final Phase B review (opus) → one fix wave → finishing-a-development-branch.

## Verification

- Per task: the task's tests red→green; then `npx jest` (repo root) and `cd web && npx vitest run`; `npm run typecheck` (root) and `cd web && npm run typecheck`; `npm run lint`, `cd web && npm run lint`.
- E2E: `cd web && npx playwright test e2e/ask-dock.spec.ts e2e/ledger-chat.spec.ts --list` compiles locally (authed specs skip without `web/.env.e2e`); CI's responsive-e2e job runs them with the flag on (non-production, so D1 doesn't block it) and fails on any skip.
- DB: CI db-smoke applies the new migrations and runs `scripts/sql/smoke.sql`.
- Manual after deploy (owner): Preview with `LEDGER_CHAT_ENABLED=true` → chat works; Production with the flag → dock absent and route 503 until the bump; a weekly ₹1,260 cap saves in Production after the migration is applied.
- Known local noise: `security-migrations.test.ts` CRLF failure; OneDrive `.next` read errors under multi-engine Playwright (rerun one engine).

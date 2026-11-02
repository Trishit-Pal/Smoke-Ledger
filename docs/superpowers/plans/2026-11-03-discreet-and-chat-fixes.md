# Discreet-mode leaks, chat log window, panel sign-in, celebrations spec

Branch: `feat/goals-adaptive` (unpushed, head 1fb59db) — the user chose to land these here. Workflow as before: subagent-driven, TDD, task review after each task, final branch review. Repo plan copy: `docs/superpowers/plans/2026-11-03-discreet-and-chat-fixes.md` (Task 0).

## Context

The adaptive-goals final summary listed five pre-existing gaps the user now wants fixed. An audit (2026-11-03) found the discreet-mode gap is wider than the two named items: 13 render sites still show stick counts, money, or brand names while discreet mode is on. The user chose to fix all 13. Discreet mode is a shoulder-surfing threat model ("numbers, brands, notes" in `src/lib/discreet.ts`), enforced only at render sites (memory: discreet-masking-is-render-site). The existing e2e only catches currency-symbol amounts, which is why bare counts, sr-only cells and brand names slipped through.

The other three items: the Ask-the-ledger route loads at most 200 log rows over 90 days (`web/app/api/ledger-chat/route.ts:30`), so for a heavy smoker its goal/pattern answers disagree with Home (which now loads up to 2000); the chat panel's sign-in lookup has no error handling (`web/components/chat/AskLedgerPanel.tsx` ~113-124); spec section 07 celebrations is `drifting` over 8 changed source files.

## Decisions

| # | Decision | Chosen |
|---|---|---|
| D1 | Masking scope | All 13 leaks (user) |
| D2 | Where | Same branch, feat/goals-adaptive (user) |
| D3 | Masked brand names | Distinct aliases "Brand A", "Brand B"… by display order (reuse the chat's `brandAlias`), never one shared "Brand hidden" — keeps lists readable and React keys unique |
| D4 | Masked figures | Existing helpers only: `maskCount` (`•••`), `maskInr`, `maskNumbers` |
| D5 | Mobile Trends deck | Mirror web: under discreet the whole deck reads "Period totals — hidden." |
| D6 | Chat log cap | Reuse the Home/Goals ceiling (2000 rows); model-facing `recent_entries` keeps its own 200-row slice, so model input does not grow |
| D7 | Panel sign-in | Reuse `sessionUserId` (`src/lib/goals/sessionUserId.ts`), which never rejects |
| D8 | Component tests | `renderToStaticMarkup` (react-dom/server, already installed) in vitest for chart components — no new deps; a stronger discreet e2e for CI. Vitest only includes `__tests__/**/*.test.ts`, so these are `.test.ts` files using `React.createElement` (no config change) |

## Leaks to fix (from the audit)

Web (`web/components/charts/`, call sites in `web/app/(app)/trends/TrendsClient.tsx`):
1. `ChartDataTable` value, cap and label cells raw — LineChart.tsx:90, BarChart.tsx:88, Donut.tsx:55 never pass a formatter.
2. Hour-of-day BarChart (TrendsClient ~515): tooltip and table raw counts (no `formatY`).
3. `BarChart3D` (~539): visible per-bar counts and aria-label raw.
4. `Heatmap` (~491): per-cell `<title>` and aria-label peak count raw.
5. `Donut` (~600): default tooltip shows brand name and raw spend.
6. Brand list (~630): brand names raw.
7. Brand list share % (~641): raw (mobile already masks it).

Mobile (`app/(tabs)/trends.tsx`, `src/components/charts/`):
8. Deck sentences ~490 and ~491: raw stick count and average.
9. "Around X a day" ~521: raw.
10. Hour BarChart ~570 and weekday BarChart ~582: max label raw (no `formatY`).
11. `MoodTriggerMatrixView`: no `formatCount` — pair count and cell counts raw (MoodTriggerMatrix.tsx:48, :89).
12. Brand list names ~672: raw.

## Tasks

### Task 0 — Plan copy (XS)
Copy this plan to `docs/superpowers/plans/2026-11-03-discreet-and-chat-fixes.md` with `### Task N` headings; commit.

### Task 1 — Shared masking primitives (S)
Files: `src/lib/discreet.ts`, `src/domain/ledgerChat/context.ts`, `web/components/charts/ChartDataTable.tsx`, tests `src/tests/discreetNumbers.test.ts` (or new `discreet.test.ts`), `web/__tests__/chartDataTable.test.ts`.
- Move `brandAlias(index)` from `src/domain/ledgerChat/context.ts:38` into `src/lib/discreet.ts` and export it; add `maskBrandAt(name, index, discreet)` → alias when discreet, name otherwise. Chat `context.ts` imports it (behaviour unchanged; `ledgerChatTools.test.ts` brand-alias cases must still pass).
- `ChartDataTable` gains `formatValue?: (v: number) => string` and `formatLabel?: (label: string, index: number) => string`, applied to value and cap cells and row labels.
- Tests first: jest for `maskBrandAt`; vitest with `renderToStaticMarkup` that the table's `td` cells contain the formatted (masked) strings and no raw digits, and labels pass through `formatLabel`.

### Task 2 — Web chart components accept and forward formatters (S)
Files: `LineChart.tsx`, `BarChart.tsx`, `BarChart3D.tsx`, `Donut.tsx`, `Heatmap.tsx` in `web/components/charts/`; tests in `web/__tests__/chartMasking.test.ts`.
- LineChart/BarChart pass `formatY` to `ChartDataTable` as `formatValue`.
- BarChart3D gains `formatValue` for the visible value and aria-label.
- Donut gains `formatValue` and `formatLabel`; passes a recharts `Tooltip formatter` and both to its table.
- Heatmap gains `formatCount` for `<title>` and aria-label.
- Tests first (renderToStaticMarkup): each component with a masking formatter renders no raw digits in its sr-only table, aria-labels, or `<title>`s.

### Task 3 — Web Trends call sites (S)
File: `web/app/(app)/trends/TrendsClient.tsx`.
- Hour BarChart `formatY={(v) => maskCount(v, discreet)}`; BarChart3D `formatValue` same; Heatmap `formatCount` same; Donut `formatValue` via `maskInr(...)` and `formatLabel` via `maskBrandAt`; brand list names via `maskBrandAt(b.brand, i, discreet)` with keys from the index under discreet; share % via `maskCount`.
- Strengthen `web/e2e/responsive.spec.ts` discreet check: no digits in any sr-only `td` on /trends and /dashboard, no seeded brand name anywhere in `#main-content`, no digits in `[aria-label]` of chart wrappers. Seed a brand and logs so the check is not vacuous. Compile-check with `--list` (runs in CI).

### Task 4 — Mobile Trends (S)
Files: `app/(tabs)/trends.tsx`, `src/components/charts/MoodTriggerMatrix.tsx`, new pure `src/domain/trendsCopy.ts` + `src/tests/trendsCopy.test.ts`.
- Move the deck and "Around X a day" sentence builders into `trendsCopy.ts` (pure, `discreet` param; deck → "Period totals — hidden." under discreet, matching web); TDD.
- Hour and weekday BarCharts get `formatY={(v) => maskCount(v, discreet)}`.
- `MoodTriggerMatrixView` gains `formatCount` (default `String`), used for pair and cell counts; caller passes `maskCount`.
- Brand list names via `maskBrandAt`; keys from index under discreet.
- Verify: root jest, typecheck, lint.

### Task 5 — Ask the ledger log window (XS)
Files: `web/app/api/ledger-chat/route.ts`, `web/lib/server/data.ts` (export the existing 2000-row constant if not exported), `src/domain/ledgerChat/tools.ts` (the comment at ~257 that names the 200-row page), test `web/__tests__/ledgerChatRouteGuard.test.ts` or a new one.
- Route loads `loadLogsPage(... limit: <shared 2000 constant>)`; `recent_entries` keeps `RECENT_MAX_ROWS = 200`.
- Test: the route's log limit equals the shared constant (source-level, as the panel tests do) and `recent_entries` still slices to 200 (`ledgerChatTools.test.ts`).

### Task 6 — Chat panel sign-in (XS)
File: `web/components/chat/AskLedgerPanel.tsx`; test `web/__tests__/ledgerChatPanel.test.ts`.
- Replace the `getSupabase().auth.getSession().then(...)` chain with `sessionUserId(() => getSupabase().auth.getSession())`; on null, `userId` null and `turns` [] (current fallback). Keep the cancelled flag.
- Test: source no longer has an unguarded `getSession().then(`; `sessionUserId` cases already cover rejection and throw.

### Task 7 — Spec and design docs (S)
- Re-verify `docs/spec/07-celebrations.md` against the 8 drifted files (`git diff 1a40fb0..HEAD` on its sources: DashboardClient, dashboard page, login page, OnboardingDoneClient, onboarding done page, MilestoneCelebration, AccountDeletedNotice, mobile index), fix stale passages, stamp current per `.claude/skills/spec-update/SKILL.md`.
- Update sections this work touches: 06 (Trends masking, chat window), 08 security-privacy (discreet render sites, chat log window), and DESIGN.md's accessibility rule if it lists masked sites. `npm run spec:drift` must report every section ok.
- Update memory `discreet-masking-is-render-site.md` with the sr-only/aria/title/brand sites and the new e2e.

## Always / Never
- Always: mask through `src/lib/discreet.ts` helpers at the render site; tests that fail if a site leaks; terracotta/accent tokens unchanged; immutability.
- Never: mask in loaders or the API; one shared "Brand hidden" label for many rows; new dependencies; grow the model's input.

## Verification
1. Root: `npm run typecheck && npx jest` (from repo root), `npm run lint`.
2. Web: `cd web && npm run typecheck && npm run lint && npx vitest run`; `npx playwright test e2e/responsive.spec.ts e2e/ledger-chat.spec.ts --list`.
3. Spec: `npm run spec:test && npm run spec:drift` (all sections ok).
4. Manual (web): turn on discreet mode, open /trends with seeded brands and logs; hover every chart, read every caption; with a screen reader or devtools, read the sr-only tables and aria-labels — no counts, amounts or brand names. Mobile: the same on the Trends tab in Expo.
5. Heavy-logger check: seed ~25 logs/day for 30 days; Ask the ledger "How am I doing on my goal?" agrees with the Home line.

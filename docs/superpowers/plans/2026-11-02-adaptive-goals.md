# Adaptive goals — implementation plan

Spec: `docs/superpowers/specs/2026-11-02-adaptive-goals-design.md`. ADR: `docs/architecture/adaptive-goals-adr.md`. Branch: `feat/goals-adaptive` off `main`.

## Global constraints (bind every task)

- **TDD.** Write the failing test first, watch it fail, then implement. Domain tests are **jest** files in `src/tests/` run from the **repo root**: `npx jest src/tests/<file>`. Never `cd web` before running root jest. Web component tests are vitest in `web/__tests__/`.
- **Pure domain.** Everything in `src/domain/` is pure: no Supabase, no `Date.now()`, no React. `today` is always a `YYYY-MM-DD` string parameter.
- **Immutability.** Never mutate a `Goal`, its `meta`, or arrays; return new objects.
- **`meta_json` is read only through `readGoalMeta`** (Task 2). No `goal.meta?.['x'] as …` casts in new code.
- **Colour.** `var(--accent)` / `theme.accent` only for `on_track` and `met`. `var(--warn-earth)` / `theme.warnEarth` for every concern. Never `text-danger`, `theme.danger`, or red for goal state.
- **Discreet mode.** Any sentence containing a spend amount uses masked wording when `isDiscreetMode(profile)` is true (see `describeProposal`, Task 4).
- **Shared primitives (web).** `ChoiceRun`, `MetricRow`, `SectionLabel` from `@web/components/visual`. Do not re-implement them inline.
- **No new dependencies.** No notifications. No cron. No edge functions.
- **Analytics payloads** carry enums and booleans only, never ids or user text.
- Commit after each task with a conventional message ending in the attribution line `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Constants (exact values, `src/domain/goalMeta.ts`)

```ts
export const HOLD_DAYS = 14;
export const HOLD_MIN_LOGGED_DAYS = 10;
export const LOOKBACK_DAYS = 7;
export const OFF_TRACK_OVER_DAYS = 3;
export const PROPOSAL_SNOOZE_DAYS = 14;
export const MIN_LOGGED_DAYS_FOR_PROPOSAL = 7;   // within the last 30 days
export const PROPOSAL_DATA_WINDOW_DAYS = 30;
export const QUIT_DATE_PROPOSAL_DAYS = 42;
export const AT_RISK_RATIO = 0.8;
```

## Shared types (exact, introduced in Tasks 2–5)

```ts
// goalMeta.ts
export type SpendPeriod = 'day' | 'week' | 'month';
export type StepReason = 'start' | 'next' | 'reanchor' | 'edit';
export interface GoalStep { cap: number; from: string; reason: StepReason }
export type DismissKind = 'next' | 'reanchor';
export interface GoalMeta {
  startHour?: number;
  endHour?: number;
  period?: SpendPeriod;
  finalTarget?: number;
  steps?: GoalStep[];
  metOn?: string;
  dismissals?: Partial<Record<DismissKind, string>>;
}

// goalAdherence.ts
export type GoalState = 'on_track' | 'at_risk' | 'off_track' | 'met';
export interface DayAdherence { date: string; used: number; cap: number; over: boolean; logged: boolean }
export interface HoldStatus { runDays: number; isHeld: boolean }

// goalProposals.ts
export type ProposalKind = 'start' | 'next' | 'reanchor';
export interface Proposal {
  kind: ProposalKind;
  type: GoalType;
  value: number;          // cap in sticks or money; for quit_date, days until the date
  unit: 'sticks' | 'money';
  period?: SpendPeriod;   // spend caps only
  date?: string;          // quit_date only: YYYY-MM-DD
  basisAvg: number;       // the average the value came from, per day
  overDays?: number;      // reanchor only
  heldDays?: number;      // next only
}

// goalTransitions.ts
export type GoalTransition =
  | { goalId: string; kind: 'auto_complete'; reason: 'quit_date' | 'taper_done' }
  | { goalId: string; kind: 'mark_met'; meta: GoalMeta };
```

---

### Task 1: Migration, types, validation, row mappers

**Files:** `supabase/migrations/20261103000000_adaptive_goals.sql` (new), `src/types/index.ts`, `src/lib/validation.ts`, `src/db/repositories/goals.ts`, `web/lib/server/data.ts`, tests in `src/tests/validation.schemas.test.ts` (and `src/tests/security-migrations.test.ts` only if it asserts the goals type list).

1. Migration, idempotent, house style of `20260519100000_hardening_and_compliance.sql`:
   - `ALTER TABLE public.goals DROP CONSTRAINT IF EXISTS goals_type_check;` then `ADD CONSTRAINT goals_type_check CHECK (type IN ('daily_cap','spend_cap_daily','no_smoke_window','reduction_target','weekly_target','quit_date','taper'));`
   - `ALTER TABLE public.goals ADD COLUMN IF NOT EXISTS completed_at timestamptz;`
   - Function `public.goals_stamp_completed_at()` `RETURNS trigger LANGUAGE plpgsql SET search_path = public`: if `NEW.status IN ('completed','abandoned') AND OLD.status NOT IN ('completed','abandoned')` then `NEW.completed_at := now()`; elsif `NEW.status IN ('active','paused')` then `NEW.completed_at := NULL`; `RETURN NEW`. `REVOKE ALL ON FUNCTION public.goals_stamp_completed_at() FROM PUBLIC, anon, authenticated;` (copy the revoke pattern used for `enforce_profile_region` in `20261013120000_region_currency.sql`).
   - `DROP TRIGGER IF EXISTS goals_stamp_completed_at ON public.goals; CREATE TRIGGER goals_stamp_completed_at BEFORE UPDATE OF status ON public.goals FOR EACH ROW EXECUTE FUNCTION public.goals_stamp_completed_at();`
   - Backfill: `UPDATE public.goals SET completed_at = created_at WHERE status IN ('completed','abandoned') AND completed_at IS NULL;` is **not** done (we do not invent dates). Leave null.
   - `CREATE OR REPLACE FUNCTION public.export_account_data(...)`: copy the **latest** definition verbatim (find it with `grep -l "FUNCTION public.export_account_data" supabase/migrations/*` and take the newest file; it is `20260521000000_audit_export_ops.sql` unless a later one exists) and add exactly one pair, `'completedAt', g.completed_at`, after `'createdAt', g.created_at` in the goals `jsonb_build_object`. Keep its grants and `SECURITY` clause identical.
2. `src/types/index.ts`: `GoalType` gains `'taper'`; `Goal` gains `completedAt: string | null`.
3. `src/lib/validation.ts`: `GoalTypeSchema` gains `'taper'`; `ImportGoalSchema` gains `completedAt: IsoUtcSchema.nullable().optional()`.
4. `src/db/repositories/goals.ts` `Row` + `rowToGoal`, and `web/lib/server/data.ts` `GoalRow` + `mapGoal`: map `completed_at` → `completedAt` (`?? null`).
5. Fix every TypeScript error the new required field causes (test fixtures building `Goal` objects add `completedAt: null`).

**Tests first:** `ImportGoalSchema` accepts a goal with `type: 'taper'` and `completedAt` ISO string, and accepts one without `completedAt`; `GoalTypeSchema` accepts `'taper'`.
**Verify:** `npx jest src/tests/validation.schemas.test.ts src/tests/security-migrations.test.ts src/tests/repositories.test.ts` and `npm run typecheck` (root) and `cd web && npm run typecheck`. Note: `security-migrations.test.ts` has a known CRLF failure on `20261031000000_logs_insert_via_rpc.sql` on this machine; it is not a regression. Report it, do not fix it.

### Task 2: `goalMeta.ts` and `evaluateGoal` for taper and spend periods

**Files:** `src/domain/goalMeta.ts` (new), `src/domain/goals.ts`, `src/tests/goalMeta.test.ts` (new), `src/tests/goals.test.ts`.

`goalMeta.ts` exports the constants and types above plus:

```ts
export function readGoalMeta(goal: Goal): GoalMeta
// Defensive: keeps a field only when its shape is right (numbers finite, strings YYYY-MM-DD, period in the union,
// steps an array of valid GoalStep). Unknown keys dropped. Never throws.
export function spendPeriod(goal: Goal): SpendPeriod            // 'day' when absent
export function isDailyCapLike(goal: Goal): boolean             // daily_cap | taper | (spend_cap_daily && period 'day')
export function currentStepStart(goal: Goal): string            // last step's `from`, else goal.startDate
export function appendStep(goal: Goal, cap: number, from: string, reason: StepReason): GoalStep[]
// If the goal has no steps yet, the result starts with { cap: goal.targetValue, from: goal.startDate, reason: 'start' }.
// Then appends { cap, from, reason }. Returns a new array.
export function capOn(goal: Goal, ymd: string): number | null
// null when ymd < goal.startDate. Otherwise the cap of the last step with from <= ymd; with no steps, goal.targetValue.
```

`evaluateGoal` changes (signature unchanged):
- `spend_cap_daily`: window start = `today` / `startOfWeekIst(today)` / `startOfMonthIst(today)` by `spendPeriod(goal)`; `used` = sum of `spendOn` from window start to `today`. Labels: `Daily spend cap: X` / `Weekly spend cap: X` / `Monthly spend cap: X`. Explanation: `You have spent U of X today.` / `… this week.` / `… this month.` `remaining`, `atRisk`, `isOnTrack` use the same formulas as today.
- New `case 'taper'`: same arithmetic as `daily_cap` against `goal.targetValue`. Label `Taper: ${cap}/day → ${finalTarget}` (omit `→ …` if no finalTarget). Explanation `Step ${n}: ${used} of ${cap} today.` where `n = max(1, steps.length)`.

**Tests first:** readGoalMeta drops a non-numeric `finalTarget`, an invalid `period`, and a malformed step; keeps valid ones. `isDailyCapLike` for each type and period. `currentStepStart` with and without steps. `appendStep` seeds the start step once. `capOn` before start, between steps, after last step. Weekly spend sums Monday..today only; monthly sums 1st..today; old spend goal without period still daily. Taper label and explanation.
**Verify:** `npx jest src/tests/goalMeta.test.ts src/tests/goals.test.ts`.

### Task 3: `goalAdherence.ts`

**Files:** `src/domain/goalAdherence.ts` (new), `src/tests/goalAdherence.test.ts` (new).

```ts
export function dailyAdherence(goal: Goal, logs: CigaretteLog[], today: string, days = LOOKBACK_DAYS): DayAdherence[]
// Dates dayShift(today, -(days-1)) .. today, ascending. used = sticksOn (spendOn for spend caps). cap = capOn(goal, date) ?? goal.targetValue.
// over = used > cap. logged = some log has localDate === date.
export function holdStatus(goal: Goal, logs: CigaretteLog[], today: string): HoldStatus
// runDays: consecutive days ending yesterday with used <= cap, never counting a date < currentStepStart(goal). Max look-back 90 days.
// isHeld: runDays >= HOLD_DAYS AND, among the HOLD_DAYS days ending yesterday, at least HOLD_MIN_LOGGED_DAYS are logged.
// Non-daily-cap-like goals: { runDays: 0, isHeld: false }.
export function goalState(goal: Goal, logs: CigaretteLog[], today: string): GoalState
```

`goalState` rules, in order:
- Daily-cap-like: `over` = count of over days in `dailyAdherence(goal, logs, today)`. `over >= OFF_TRACK_OVER_DAYS` → `off_track`; `over >= 1` → `at_risk`; today's `used >= cap * AT_RISK_RATIO` → `at_risk`; `readGoalMeta(goal).metOn` set → `met`; else `on_track`.
- Everything else: `p = evaluateGoal(goal, logs, today)`; `!p.isOnTrack` → `off_track`; `p.atRisk` → `at_risk`; else `on_track`.

**Tests first:** one over day → at_risk; three of seven → off_track; today at 80% → at_risk; metOn and clean week → met; met but one over day → at_risk. holdStatus: 14 clean days with 10 logged → held; with 9 logged → not held; a run that would extend before the current step's start is cut at the step start; goal started 3 days ago → runDays ≤ 3. Week spend cap uses evaluateGoal rules.
**Verify:** `npx jest src/tests/goalAdherence.test.ts`.

### Task 4: `goalProposals.ts`

**Files:** `src/domain/goalProposals.ts` (new), `src/tests/goalProposals.test.ts` (new).

```ts
export function loggedDays(logs: CigaretteLog[], fromYmd: string, toYmd: string): number   // distinct localDate in range
export function hasEnoughHistory(logs: CigaretteLog[], today: string): boolean
// loggedDays over the PROPOSAL_DATA_WINDOW_DAYS ending today >= MIN_LOGGED_DAYS_FOR_PROPOSAL
export function proposeStart(
  type: GoalType, logs: CigaretteLog[], today: string,
  opts: { currency: CurrencyCode; period?: SpendPeriod },
): Proposal | null
export function proposeNext(goal: Goal, logs: CigaretteLog[], today: string, opts: { currency: CurrencyCode }): Proposal | null
export function proposeReanchor(goal: Goal, logs: CigaretteLog[], today: string, opts: { currency: CurrencyCode }): Proposal | null
export function proposalFor(goal: Goal, logs: CigaretteLog[], today: string, state: GoalState, opts: { currency: CurrencyCode }): Proposal | null
// met → proposeNext; off_track → proposeReanchor; else null.
export function describeProposal(
  p: Proposal,
  opts: { formatMoney: (n: number) => string; formatDate: (ymd: string) => string; hideMoney: boolean; currentCap?: number },
): { headline: string; basis: string; valueLabel: string }
```

Rules (`yesterday = dayShift(today, -1)`; `avg14 = rollingAvgSticks(logs, yesterday, 14)`; `avg7 = rollingAvgSticks(logs, yesterday, 7)`; spend uses `rollingAvgSpend`; money unit `step = currency === 'EUR' ? 5 : 10`):
- All functions return `null` unless `hasEnoughHistory`.
- `proposeStart`:
  - `daily_cap`, `taper`: `null` if `avg14 < 1`; else `value = max(1, round(avg14) - 1)`, unit sticks, `basisAvg = avg14`.
  - `weekly_target`: `value = round(avg14 * 7 * 0.9)`; `null` if `< 1`.
  - `spend_cap_daily`: periodDays 1 / 7 / 30; `value = round(avgSpend14 * periodDays * 0.9 / step) * step`; `null` if `<= 0`; unit money; `period` set; `basisAvg = avgSpend14`.
  - `quit_date`: `value = QUIT_DATE_PROPOSAL_DAYS`, `date = dayShift(today, 42)`, unit sticks, `basisAvg = avg14`.
  - `no_smoke_window`, `reduction_target`: `null`.
- `proposeNext` (only `isDailyCapLike`, only when `metOn` set, `null` if `dismissals.next` within `PROPOSAL_SNOOZE_DAYS` of today):
  - sticks: `floor = goal.type === 'taper' ? (finalTarget ?? 1) : 1`; taper with `targetValue <= floor` → `null`; `value = max(floor, min(cap - 1, round(avg7)))`; `null` if `value >= cap`.
  - spend (day period): `value = floor(min(cap * 0.9, avgSpend7) / step) * step`; `null` if `value <= 0 || value >= cap`.
  - `heldDays = holdStatus(goal, logs, today).runDays`.
- `proposeReanchor` (only `isDailyCapLike`, `null` if `dismissals.reanchor` snoozed): uses the 7 days ending **today**: sticks `value = min(1000, ceil(rollingAvgSticks(logs, today, 7)))`; spend `value = min(1000, ceil(avgSpend / step) * step)`; `null` if `value <= cap`. `overDays` = over count from `dailyAdherence`.
- `describeProposal` copy (exact strings; `n` = value, `per` = `a day` / `a week` / `a month`):
  - start, sticks daily/taper: headline `Start at ${n} a day?`; basis `Your last two weeks average ${basisAvg.toFixed(1)} a day.`; valueLabel `${n} / day`.
  - start, weekly: `Start at ${n} a week?`; same basis; `${n} / week`.
  - start, spend: headline `Start at ${money(n)} ${per}?`; basis `Your last two weeks average ${money(basisAvg)} a day.`; valueLabel `${money(n)} / ${day|week|month}`. When `hideMoney`: headline `Start a little under your recent spend?`, basis `Amounts are hidden in discreet mode.`, valueLabel `—`.
  - start, quit_date: headline `Quit on ${formatDate(date)}?`; basis `Six weeks from today. Your last two weeks average ${basisAvg.toFixed(1)} a day.`; valueLabel `${formatDate(date)}`.
  - next, sticks: headline `Next: ${n} a day?`; basis `Fourteen days under ${currentCap}.`; valueLabel `${n} / day`. Spend: headline `Next: ${money(n)} a day?`; masked → `Next: a little lower?`.
  - reanchor, sticks: headline `Re-anchor to ${n} a day?`; basis `Over on ${overDays} of the last 7 days. ${n} is where you are now.`; valueLabel `${n} / day`. Spend masked → `Re-anchor to where you are now?` / `Over on ${overDays} of the last 7 days.`

**Tests first:** every rule above, including `null` with 6 logged days, rounding to 10 INR and 5 EUR, snooze honoured at day 13 and expired at day 14, taper next floored at finalTarget, reanchor null when average is under the cap, masked copy contains no digits of the amount.
**Verify:** `npx jest src/tests/goalProposals.test.ts`.

### Task 5: `goalTransitions.ts` and the reconcile service

**Files:** `src/domain/goalTransitions.ts` (new), `src/services/goalReconcile.ts` (new), `src/tests/goalTransitions.test.ts` (new), `src/tests/goalReconcile.test.ts` (new).

```ts
export function planGoalTransitions(goals: Goal[], logs: CigaretteLog[], today: string): GoalTransition[]
// Only status === 'active'.
// quit_date with endDate && today >= endDate → auto_complete 'quit_date'.
// isDailyCapLike, no metOn, holdStatus(...).isHeld:
//   taper with finalTarget set and targetValue <= finalTarget → auto_complete 'taper_done'
//   otherwise → mark_met with meta = { ...readGoalMeta(goal), metOn: today }
export function applyGoalTransitions(goals: Goal[], transitions: GoalTransition[], nowIso: string): Goal[]
// Pure. auto_complete → { ...g, status: 'completed', completedAt: nowIso }. mark_met → { ...g, meta: t.meta }.

// src/services/goalReconcile.ts
export interface GoalWriter {
  setGoalStatus: (id: string, status: Goal['status']) => Promise<void>;
  updateGoal: (id: string, patch: GoalPatchInput) => Promise<unknown>;
}
export async function reconcileGoals(
  goals: Goal[], logs: CigaretteLog[], today: string, writer: GoalWriter, nowIso = new Date().toISOString(),
): Promise<{ goals: Goal[]; applied: GoalTransition[] }>
// Plans, then writes each transition sequentially (auto_complete → setGoalStatus(id,'completed'); mark_met → updateGoal(id,{ meta })).
// A failing write is skipped (not in `applied`), the rest continue. Returns applyGoalTransitions(goals, applied, nowIso).
export function completionMoment(t: GoalTransition): { title: string; body: string } | null
// quit_date → { title: 'Quit day.', body: 'The date you set has arrived. The ledger marks it kept.' }
// taper_done → { title: 'Tapered.', body: 'Every step down was yours to accept. All of them, kept.' }
// mark_met → null
```

**Tests first:** quit date completes on the date, not the day before; planner returns nothing for a goal that already has `metOn` or is paused/completed (idempotence); taper at final target held → taper_done; daily cap held with 9 logged days → nothing; reconcile with a writer whose first call rejects still applies the second; reconcile with no transitions makes zero writer calls.
**Verify:** `npx jest src/tests/goalTransitions.test.ts src/tests/goalReconcile.test.ts`.

### Task 6: `goalForm.ts` additions

**Files:** `src/domain/goalForm.ts`, `src/tests/goalForm.test.ts`.

- `GoalTypeMeta` gains `creatable: boolean`. `GOAL_TYPE_META` order and copy:
  1. `daily_cap` "Daily cap" · "Stay under a number of sticks each day." · `sticks/day` · creatable
  2. `taper` "Taper" · "Step the daily cap down every two weeks, each step offered first." · `sticks/day` · creatable
  3. `quit_date` "Quit by a date" · "Work toward a quit date." · null · creatable
  4. `spend_cap_daily` "Spend cap" · "Keep spend under a limit for the day, week, or month." · `₹` · creatable
  5. `weekly_target` "Weekly cap" (unchanged copy) · creatable
  6. `no_smoke_window` (unchanged) · creatable
  7. `reduction_target` (unchanged) · **not** creatable
- Export `creatableGoalTypes(): readonly GoalTypeMeta[]`.
- `GoalFormState` gains `period: SpendPeriod` and `finalTarget: string`; `emptyGoalForm` sets `period: 'day'`, `finalTarget: ''`; `goalToFormState` reads both via `readGoalMeta` (`taper` target = `String(targetValue)`).
- `buildGoalPayload`:
  - `spend_cap_daily` → `meta: { period: form.period }`.
  - `taper`: `cap = Number(form.target)`, `final = Number(form.finalTarget)`; errors: `'Enter a starting cap greater than 0.'`, `'Enter a final target greater than 0.'`, `'The final target should be below the starting cap.'`. Payload `{ type: 'taper', targetValue: cap, currentBaseline: deriveReductionBaseline(logs, today) || null, meta: { finalTarget: final, steps: [{ cap, from: today, reason: 'start' }] } }`.
- `buildGoalPatch(form, logs, today, existing?: Goal)`: when `existing` is given, the patch `meta` is `{ ...readGoalMeta(existing), ...newTypeSpecificMeta }`; for daily-cap-like goals whose target changed, `meta.steps = appendStep(existing, newTarget, today, 'edit')` and `metOn` is removed. Callers in `GoalsClient.tsx` and `app/goals/new.tsx` pass `existing` (update both call sites).
- `acceptProposalPatch(goal: Goal, p: Proposal, today: string): GoalPatchInput` → `{ targetValue: p.value, meta: { ...metaWithoutMetOn, steps: appendStep(goal, p.value, today, p.kind === 'reanchor' ? 'reanchor' : 'next') } }`.
- `dismissProposalPatch(goal: Goal, kind: DismissKind, today: string): GoalPatchInput` → `{ meta: { ...meta, dismissals: { ...meta.dismissals, [kind]: today } } }`.
- `proposalToForm(p: Proposal): Partial<GoalFormState>` → `{ type: p.type, target: String(p.value), period: p.period ?? 'day', quitDate: p.date ?? '' }` (taper: target is the start cap, finalTarget stays empty).
- `capSeries(goal: Goal, dates: readonly string[]): (number | null)[]` → `dates.map((d) => capOn(goal, d))`.

**Tests first:** taper payload and its three errors; spend payload carries period; edit of a daily cap appends steps (seeding the start step) and clears metOn; edit preserves unrelated meta (dismissals); accept/dismiss patches; proposalToForm for quit and spend; capSeries steps; `creatableGoalTypes` excludes reduction_target; `goalTypeLabel('taper') === 'Taper'`.
**Verify:** `npx jest src/tests/goalForm.test.ts` then the full root suite `npx jest` (report pre-existing failures by name).

### Task 7: Analytics events

**Files:** `src/constants/events.ts`, `src/tests/events.shape.test.ts`.

Add `GOAL_PROPOSAL_ACCEPTED: 'goal_proposal_accepted'`, `GOAL_PROPOSAL_DISMISSED: 'goal_proposal_dismissed'`, `GOAL_AUTO_COMPLETED: 'goal_auto_completed'`. Payloads: `goal_proposal_accepted: { type: GoalType; kind: ProposalKind }`, `goal_proposal_dismissed: { type: GoalType; kind: DismissKind }`, `goal_auto_completed: { type: GoalType; reason: 'quit_date' | 'taper_done' }`. `goal_created` becomes `{ type: GoalType; from_proposal?: boolean }`. Type-level tests that `goal_id` is rejected on each new event (same `@ts-expect-error` pattern the file already uses), and that `'taper'` is accepted as a `goal_type`.
**Verify:** `npx jest src/tests/events.shape.test.ts` and `npm run typecheck`.

### Task 8: Web `/goals` — create form with proposals

**Files:** `web/app/(app)/goals/GoalsClient.tsx`, new `web/app/(app)/goals/GoalProposal.tsx`, `web/app/(app)/goals/page.tsx` if needed for search params.

- Delete `TypePicker`; use `ChoiceRun` (`allowClear={false}`, `ariaLabel="Goal type"`, options from `creatableGoalTypes()`). On create only; edit shows the type label as now.
- Spend cap: a second `ChoiceRun` (`ariaLabel="Spend period"`) with options `Per day` / `Per week` / `Per month` bound to `form.period`. The target unit label follows the period and currency (`₹/day`, `€/week`, …).
- Taper: inputs `Starting cap (sticks/day)` and `Final target (sticks/day)`, then the line `Steps down every 14 days, each one offered first.` (text-small, muted).
- `GoalProposal` (new, presentational): props `{ proposal: Proposal; copy: { headline; basis; valueLabel }; onUse: () => void; onChooseOwn: () => void; busy: boolean }`. Renders `MetricRow` (`variant="first"`, label `Your last 14 days`, subtitle `copy.basis`, value `copy.valueLabel`), then a `p.editorial-headline` with `copy.headline`, then `Button` `Use ${valueLabel}` (secondary, sm) and `Button` `Choose my own` (ghost, sm).
- In the create form, after a type is chosen: if `proposeStart(type, logs, today, { currency, period })` is non-null and the user has not chosen "own", show `GoalProposal`; `Use …` seeds the form via `proposalToForm` and shows the inputs prefilled; `Choose my own` shows empty inputs. If null: one muted line `Not enough days logged to suggest one yet — enter a number.` above the inputs. The proposal recomputes when type or period changes.
- `?type=<GoalType>` search param (validated against `creatableGoalTypes`) opens the create form with that type selected on mount.
- Create success: `track(AnalyticsEvents.GOAL_CREATED, { type, from_proposal })` where `from_proposal` is true when "Use" seeded the form and the target was not changed.
- Error lines: replace `text-danger` with `text-warn-earth` (check the class exists in `web/tailwind.config.*`; if not, use `style={{ color: 'var(--warn-earth)' }}`).
- Pass `existing` to `buildGoalPatch`.

**Tests first (vitest, `web/__tests__/goalProposal.test.tsx`):** GoalProposal renders headline, basis and value; `Use` and `Choose my own` fire their callbacks. If the web vitest setup cannot render TSX components (check `web/vitest.config.*` and existing `web/__tests__` for a React render precedent), test only the pure seeding logic and note it in the report.
**Verify:** `cd web && npm run typecheck && npm run lint && npx vitest run`.

### Task 9: Web `/goals` — state captions, card proposals, reconcile, history

**Files:** `web/app/(app)/goals/GoalsClient.tsx`, `web/app/(app)/goals/GoalCard.tsx`, new `web/app/(app)/goals/GoalStateCaption.tsx`.

- `GoalStateCaption` props `{ state: GoalState; overDays: number; heldDays: number }` → `span.editorial-caption` text: `On track` / `At risk · over once this week` (overDays 1) or `At risk · over ${n} times this week` (2) or `At risk · close to the cap today` (0) / `Off track · over ${n} of the last 7 days` / `Met · held ${heldDays} days`. Colour accent for on_track and met, warn-earth otherwise.
- `GoalCard` gains props `state`, `overDays`, `heldDays`, `proposal: Proposal | null`, `proposalCopy`, `onAccept(goal, p)`, `onDismiss(goal, kind)`. Tone for the % numeral and ring comes from `state` (accent iff on_track or met). Under the heading: `GoalStateCaption` for active goals. If a proposal: hairline, `MetricRow` (label `Next step` or `Re-anchor`, subtitle `proposalCopy.basis`, value `proposalCopy.valueLabel`), headline text, buttons `Accept` (secondary sm) · `Edit` (ghost sm → `onEdit` with the form target prefilled to `p.value`) · `Not now` (ghost sm).
- Done goals (`completed` / `abandoned`): show `Completed ${formatIndianDate(completedAt)}` or `Set aside ${…}` when `completedAt` exists (else `Completed` / `Set aside`), hide the ring and %, only the Delete action.
- `GoalsClient`:
  - `const planned = useMemo(() => planGoalTransitions(goals, logs, today), …)`; `const view = useMemo(() => applyGoalTransitions(goals, planned, new Date().toISOString()), …)`; render from `view`.
  - Mount effect (once per goals identity): if `planned.length`, call `reconcileGoals(goals, logs, today, { setGoalStatus, updateGoal })`; for each `applied` with `completionMoment` non-null, `dispatchGoalCompletion(moment)` and `track(GOAL_AUTO_COMPLETED, { type, reason })`; then `await revalidateAppViews(); router.refresh()`.
  - Per active goal: `state = goalState`, `overDays` from `dailyAdherence`, `heldDays` from `holdStatus`, `proposal = proposalFor(...)`, copy via `describeProposal` with `formatMoney`/`formatIndianDate`/`hideMoney: isDiscreetMode(profile) && goal.type === 'spend_cap_daily'`, `currentCap: goal.targetValue`.
  - `handleAccept` → `updateGoal(goal.id, acceptProposalPatch(goal, p, today))`, `track(GOAL_PROPOSAL_ACCEPTED, { type, kind })`, revalidate + refresh. `handleDismiss` → `updateGoal(goal.id, dismissProposalPatch(goal, kind, today))`, `track(GOAL_PROPOSAL_DISMISSED, …)`, revalidate + refresh.
  - `GOAL_PROGRESS_VIEWED` once per mount per distinct active goal type.
  - `handleStatus` / `handleDelete` / accept / dismiss: catch → set a page-level `notice` string (`toSafeErrorMessage(err)`) rendered as one `text-small` line in warn-earth under the masthead. Never swallow.
- Copy elsewhere: masthead subtitle becomes `The ledger suggests; you decide. Reviewed quietly.`

**Verify:** `cd web && npm run typecheck && npm run lint && npx vitest run`.

### Task 10: Playwright `/goals` spec

**Files:** `web/e2e/goals.spec.ts` (new), `web/e2e/_helpers/seed.ts`, `web/package.json` (`test:e2e:authed` gains `e2e/goals.spec.ts`).

- Seed helper `seedGoal(userId, { type, targetValue, startDate, endDate?, meta?, status? }): Promise<string>` via the admin client, id `gol_${random}`. Reuse the existing log seeding helper (find it in `seed.ts`) to seed N days of logs; add a small `seedDailyLogs(userId, { days, perDay, endOffset })` only if no equivalent exists.
- Scenarios (each `test.skip(!canSeed(), …)` like `onboarding.spec.ts`; dates computed from IST today):
  1. Create via proposal: 14 days at 9/day → `/goals` → New goal → Daily cap → button `Use 8 / day` → Create goal → `Daily cap: 8/day` visible.
  2. Quit date auto-completes: seed `quit_date` with `start_date` 10 days ago, `end_date` today → visit `/goals` → text `Quit day.` visible, then `listGoalStatuses` shows `completed`.
  3. At risk: cap 5 started 10 days ago, one day at 7 three days ago, other days 3 → caption `At risk · over once this week`.
  4. Off track and re-anchor: cap 5, 4 of the last 7 days at 9 → caption contains `Off track`; click `Accept` → the card shows a cap of `9`.
**Verify:** `cd web && npx playwright test e2e/goals.spec.ts --list` (authed specs skip on this machine without `web/.env.e2e`; CI runs them).

### Task 11: Web Home — quiet line and first-goal suggestion

**Files:** `web/app/(app)/dashboard/DashboardClient.tsx`, new `web/lib/goals/firstSuggestionStore.ts`.

- Replace `goalToneColor` logic with `goalState` (accent iff on_track or met; warn-earth otherwise).
- Under the goal verse, one `p.text-small.text-text-muted` wrapped in `Link href="/goals"`: met → `Held for ${heldDays} days. A next step is waiting on the goals page.`; off_track with proposal → `Over the cap on ${overDays} of the last 7 days. A re-anchor is waiting.`; at_risk → `Over once this week.` (or `Close to the cap today.` when overDays is 0); on_track → nothing.
- First-goal suggestion: when there is no active goal, `proposeStart('daily_cap', …)` is non-null, and not dismissed: section with `SectionLabel` `A first goal`, sentence `${loggedDays} days in the ledger. Your average is ${avg} a day — a cap at ${value}?`, `Link` to `/goals?type=daily_cap` labelled `See the suggestion`, ghost `Button` `Not now`. Under `isHomeTotalsHidden`/discreet, mask the figures the same way the page masks its other counts.
- `firstSuggestionStore.ts`: `isFirstSuggestionDismissed(userId, today): boolean` and `dismissFirstSuggestion(userId, today): void` using `localStorage` key `goals.firstSuggestion.dismissedOn:${userId}`; dismissed means stored date within `PROPOSAL_SNOOZE_DAYS`. SSR-safe (guard `typeof window`). Find the user id the same way the chat transcript store does (`web/components/chat/transcriptStore.ts`).
- Run the same reconcile mount effect as Task 9 (extract a small hook `web/lib/goals/useGoalReconcile.ts` used by both pages — refactor Task 9's effect into it).
**Verify:** `cd web && npm run typecheck && npm run lint && npx vitest run`.

### Task 12: Web onboarding — "Suggest one later"

**Files:** `web/app/onboarding/goal/OnboardingGoalClient.tsx`, `web/app/onboarding/done/OnboardingDoneClient.tsx`, `web/e2e/onboarding.spec.ts` (only if a selector breaks).

- Add a fourth card (roman `IV.`): label `Suggest one later`, hint `After a week of logging`, example `the ledger proposes a cap from your own numbers`. It is not a `GoalType`; model selection as `type === null` meaning this card. It renders selected when `type == null`. It is hidden when `existing` is non-null (the reader already has a goal; the ghost "Keep and continue" covers that).
- Clicking it sets `setGoal({ goalType: null, goalTarget: '' })`. `canContinue` is true when `loaded && (type == null || selected?.window || Number(target) > 0)`. Continue with `type == null` calls `skipGoalStep()` and routes to brands. No target panel renders for it.
- Done page: where it shows the goal as skipped, show `Suggested after a week of logging` instead.
**Verify:** `cd web && npm run typecheck && npx playwright test e2e/onboarding.spec.ts --list`; `npx jest src/tests/onboardingService.test.ts` (root).

### Task 13: Web Trends — cap line

**Files:** `web/lib/server/data.ts` (`getTrendsPageData` adds `getServerGoals()` to its `Promise.all` and returns `goals`), `web/app/(app)/trends/page.tsx`, `web/app/(app)/trends/TrendsClient.tsx`, `web/components/charts/LineChart.tsx`, `web/components/charts/ChartDataTable.tsx`.

- `LineChart` data items gain optional `cap?: number | null`. When any item has a numeric `cap`, render a second recharts `<Line dataKey="cap" type="stepAfter" stroke="var(--rule-strong)" strokeDasharray="4 4" strokeWidth={1.5} dot={false} activeDot={false} isAnimationActive={!reduced} connectNulls={false} />`. The tooltip shows `Cap` when present. `ChartDataTable` gets a `Cap` column only when present.
- `TrendsClient`: pick the first active goal whose type is `daily_cap` or `taper`; merge `capSeries(goal, dates)` into `sticksLine` items. Under the chart caption add `— dashed line: your ${goalTypeLabel(type).toLowerCase()}` (text-caption, faint, italic) only when a cap is drawn. Under discreet mode the cap line still draws (it carries no number on the axis beyond the masked ticks).
- Pass `goals` to `AskLedgerLauncher` instead of `[]` and delete the comment saying Trends has no goals.
**Verify:** `cd web && npm run typecheck && npm run lint && npx vitest run`.

### Task 14: Ask the ledger — goal state

**Files:** `src/domain/ledgerChat/tools.ts`, `web/lib/server/ledgerChat/prompt.ts`, `src/tests/ledgerChatTools.test.ts`.

- `goal_status` description: `Progress and state (on track, at risk, off track, met) on each active goal, plus any suggested next step. Use for "how am I doing on my goal".`
- Data per goal adds `state`, `overDaysLast7`, `heldDays`, `proposal: { kind, value } | null` (via Tasks 3–4; currency from `ctx.currency`).
- Rows: existing row's tone becomes `accent` iff state is on_track or met, else `warn`. When a proposal exists, an extra row `goal.${i}.proposal` labelled `Suggested next cap` or `Suggested re-anchor`, value `proposal.value`, unit `sticks` or `money`. Row labels stay figure-free.
- `prompt.ts`: the active-goals line lists `type (state)` and appends `, next step suggested` / `, re-anchor suggested` when a proposal exists, e.g. `daily cap (met, next step suggested)`.
**Tests first:** tool output equals direct calls to `goalState`/`proposalFor` on the same inputs; proposal row present and label contains no digits.
**Verify:** `npx jest src/tests/ledgerChatTools.test.ts src/tests/ledgerChatStarters.test.ts`.

### Task 15: Mobile — store reconcile, goals tab, create screen

**Files:** `src/store/session.ts`, `app/(tabs)/goals.tsx`, `app/goals/new.tsx`.

- `session.ts`: in `boot` and `refreshGoals`, after loading goals call `reconcileGoals(goals, logs, ledgerToday(), { setGoalStatus: goalsRepo.setGoalStatus, updateGoal: goalsRepo.updateGoal })`; store the returned goals and keep `pendingGoalMoments: GoalTransition[]` (the `applied` list) in state with `consumeGoalMoments(): GoalTransition[]` that returns and clears it. `addGoal` accepts an optional second arg `{ fromProposal?: boolean }` and tracks `GOAL_CREATED`. `setGoalStatus` in the store sets `completedAt` locally to `new Date().toISOString()` for completed/abandoned and `null` otherwise.
- `app/(tabs)/goals.tsx`: on focus, consume moments and `dispatchGoalCompletion(completionMoment(t))` for each; `track(GOAL_AUTO_COMPLETED, …)`. Each active `GoalRow` shows the state caption (same strings as `GoalStateCaption`, Task 9 — move the string builder into `src/domain/goalAdherence.ts` as `stateCaption(state, overDays, heldDays): string` so both apps share it; update Task 9's component to call it), colour `theme.accent` / `theme.warnEarth`, `ProgressBar` tone `success` for on_track/met else `warn`. Proposal block: `Text` headline, `Text` basis (muted), buttons Accept / Not now (and Edit → `/goals/new?goalId=…&target=…`). Done rows: completed/set-aside date, only Delete. Delete keeps its confirm.
- `app/goals/new.tsx`: type pills from `creatableGoalTypes()`; proposal block using `proposeStart` + `describeProposal` with `Use …` / `Choose my own`; period pills for spend; taper fields; read `type` and `target` search params; error text colour `theme.warnEarth`; pass `existing` to `buildGoalPatch`.
**Verify:** `npm run typecheck && npm run lint` (root) and `npx jest src/tests/goal`.

### Task 16: Mobile — Home line, first-goal suggestion, onboarding, Trends line

**Files:** `app/(tabs)/index.tsx`, `app/onboarding/goal.tsx`, `app/(tabs)/trends.tsx`, `src/components/charts/LineChart.tsx`, new `src/lib/goals/firstSuggestionStore.ts`.

- Home: same quiet line and first-goal section as Task 11 (shared strings: move the Home sentence builder into `src/domain/goalAdherence.ts` as `homeGoalLine(state, overDays, heldDays, hasProposal): string | null` and use it from both Task 11's web code and here; update the web call site). Dismissal via AsyncStorage with the same key and rule as web; the link goes to `/goals/new?type=daily_cap`. Tone from `goalState`.
- Onboarding: fourth card with the Task 12 copy and behaviour (`skipGoalStep` on Continue, hidden when `existing`).
- `LineChart` (react-native-svg) gains optional `cap?: number | null` on data points; when present, draw a stepped dashed `Path` in `theme.ruleStrong` (`strokeDasharray="4,4"`), scaled on the same y axis (include caps in `max`). Trends merges `capSeries` for the first active daily cap or taper and adds the `— dashed line: …` caption.
**Verify:** `npm run typecheck && npm run lint` (root).

### Task 17: Spec and docs

**Files:** `docs/spec/06-goals-insights.md`, `docs/spec/02-data-model.md`, `docs/spec/00-glossary.md` (add "met", "taper", "re-anchor", "proposal").

- Rewrite the Goals subsection of 06: types (taper, spend period), `readGoalMeta`, state vocabulary, holds, proposals and their maths, transitions and where reconcile runs, `completed_at` trigger, Home line, Trends line, chat tool. Replace the stale "no goals management screen" and "only goals[0]" text with current truth. Update Invariants and Tests.
- 02: `completed_at` column, trigger, type CHECK.
- Bump `last_verified_commit` per the spec system's convention (see `docs/superpowers/specs/2026-06-18-living-spec-system-design.md`).
**Verify:** `npm run spec:drift` and `npm run spec:test`.

## Progress

| Task | Status |
| --- | --- |
| 1–17 | pending |

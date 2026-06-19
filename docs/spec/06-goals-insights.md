---
section: goals-insights
sources:
  - src/domain/goals.ts
  - src/domain/insights.ts
  - src/domain/correlations.ts
  - src/domain/health.ts
  - src/domain/savings.ts
  - src/db/repositories/goals.ts
last_verified_commit: fcabb85
status: current
---

# Goals, Insights, and Savings

## Purpose

This section covers the analytical half of the app: the goals a user sets to
change their smoking behaviour, the insights the app surfaces from their logged
data, the mood × trigger correlations that reveal patterns behind the habit, the
health-recovery timeline that tracks what the body is doing since the last
cigarette, and the INR savings that put a rupee figure on every avoided stick.

None of these features require a network call at render time. The entire
evaluation and insight pipeline is pure TypeScript — deterministic functions that
take the in-memory log array from the session store and return numbers and text.
Supabase is involved only for persisting goals and, on the trends screen, for
the background `v_mood_trigger_heatmap` view and the `get_random_facts` RPC.

## What the user experiences

On the home screen (native: `app/(tabs)/index.tsx`; web: `DashboardClient.tsx`)
the user sees, from top to bottom:

1. **Today's count and spend** — the raw numbers from today's logs.
2. **A deck sentence** — one sentence contextualising today against baseline and
   streak, e.g. "12 today — above your usual." or "Smoke-free for 7 days. Quiet
   day."
3. **The ledger** — a typographic row showing 7-day rolling average and trend
   delta vs. the 30-day baseline, plus current smoke-free streak.
4. **Goal verse** — if at least one active goal exists, one card shows the goal
   label, a percentage towards target, a thin progress bar, and a plain
   explanation sentence. The colour shifts to amber when `atRisk` is true and to
   the accent colour when `isOnTrack`.
5. **The week** — a minimal bar chart of the last 7 days.
6. **Body recovery / health milestones** — a panel anchored to the timestamp of
   the last logged cigarette, counting forward through a ladder of physiological
   events from "20 minutes" (heart rate drops) to "15 years" (heart disease risk
   matches a non-smoker).
7. **From your week** — the top insight, formatted as an editorial blockquote
   with a left border rule.
8. **Potential savings + month forecast** — visible only when a baseline exists
   and `totalInr > 0`.

Nothing nags. Every observation is stated flatly, without value judgement.

## How it works

### Goals

**The data model.** Goals live in `public.goals`
(`supabase/migrations/20250426120000_initial_schema.sql:112`). The table has:
`id`, `user_id`, `type` (text, one of six values), `target_value` (double
precision), `current_baseline` (nullable double precision), `start_date` and
`end_date` (text, `YYYY-MM-DD`), `status` (active / paused / completed /
abandoned), `meta_json` (jsonb for type-specific extras like window hours), and
`created_at`. RLS is `goals_all` — every operation is restricted to
`user_id = auth.uid()`.

**TypeScript types.** `GoalType` is a union of six string literals
(`src/types/index.ts:75`). `Goal` is the domain object; `GoalProgress` is what
`evaluateGoal` returns (`src/domain/goals.ts:7`). The repository (`rowToGoal`)
maps snake_case columns to camelCase and parses `meta_json` whether Supabase
returns it as a string or an object (`src/db/repositories/goals.ts:26`).

**Validation.** Every `createGoal` call runs the input through `GoalSchema`
before touching the database (`src/db/repositories/goals.ts:86`). The Zod schema
(`src/lib/validation.ts:118`) enforces `targetValue > 0` up to 1 000,
`endDate >= startDate`, and validates `type` against the enum. The same enum
appears as a `CHECK` constraint in the database hardening migration so the two
stay in lockstep.

**Evaluation — `evaluateGoal` (`src/domain/goals.ts:35`).** This is a pure
function that takes a `Goal`, the full log array, and a `today` date string, then
returns a `GoalProgress` object. The six cases:

- `daily_cap` — counts sticks on `today` via `sticksOn`, compares to
  `targetValue`. `atRisk` is true when utilisation is 80–100%. Remaining is
  `max(0, target - used)`.
- `spend_cap_daily` — same logic but uses `spendOn` and reports in INR.
- `no_smoke_window` — reads `startHour` / `endHour` from `goal.meta`, handles
  overnight windows (e.g. 22:00–06:00) by wrapping midnight. `percent` is 100
  if no sticks fell inside the window, 0 otherwise. `atRisk` is always false
  because the goal is binary (`src/domain/goals.ts:87`).
- `weekly_target` — iterates from `startOfWeekIst(today)` forward to `today`
  via `dayShift`, summing sticks per day. The week is always Mon–today within
  the calendar week.
- `reduction_target` — computes a 7-day rolling average for the current window
  and compares to `currentBaseline` (snapped at goal creation) or falls back to
  a 30-day rolling average ending the day before the goal started. Progress is
  `(baseline - current) / (baseline - target)`, clamped to 0–100. `isOnTrack`
  is true when `current <= target` or when progress is already past the 50%
  mark.
- `quit_date` — treats `endDate` as the quit day. `percent` is elapsed days /
  total days. `atRisk` is set if the user is not trending down *and* the quit
  date is within 7 days.

**Only the first active goal is shown on the home screen.** `goals[0]` from the
session store is taken directly (`app/(tabs)/index.tsx:411`,
`DashboardClient.tsx:117`). Multiple goals can exist in the database — they are
listed by `listAllGoals` — but the home card surfaces just one. There is
currently no dedicated goals management screen.

**Session hydration.** On boot, `useSession.boot` fetches only `status =
'active'` goals via `listActiveGoals` (`src/store/session.ts:64`). A
`refreshGoals` action re-fetches on demand.

### Insights

**`generateInsights` (`src/domain/insights.ts:12`).** Called on every render
with the full log array and today's date, it returns an `Insight[]`. The
`Insight` type carries `title`, `explanation`, `evidence`, `confidence` (low /
medium / high), and `severity` (info / watch / act).

Five rules run in sequence; any that fire append to the output array:

1. **Bootstrap gate** — if there are fewer than 3 logs, a single placeholder
   insight is returned immediately and nothing else runs. This prevents
   misleading pattern claims from thin data (`src/domain/insights.ts:16`).
2. **Time-of-day dominance** — builds an hour distribution over the last 30 days
   via `hourDistribution`. If a 3-hour window centred on the peak hour holds
   ≥25% of total sticks, an insight fires. Confidence upgrades from medium to
   high at 40% (`src/domain/insights.ts:30`).
3. **Trigger concentration** — counts tagged logs by `triggerTag`. If the top
   trigger holds ≥30% of all tagged entries (minimum 5 tagged entries), an
   insight fires naming that trigger. Confidence is always medium because trigger
   tagging is optional and the sample may be skewed (`src/domain/insights.ts:54`).
4. **Reduction trend** — computes `trendVsBaseline` comparing a 7-day current
   window to a 30-day baseline. A delta of ≤ −10% fires an `info` insight
   ("your average is down"); ≥ +15% fires an `act` insight ("your average is
   up"). Both include the exact per-day numbers as evidence.
5. **Brand concentration** — uses `brandSpendMix` over the last 30 days. If the
   top brand is ≥40% of spend, an insight names the brand and shows the INR
   figure.

A sixth rule (day-of-week dominance) runs via `dowDistribution`; it fires when
a single day holds ≥22% of sticks over 30 days (minimum 7 total sticks).

Only `insights[0]` is shown on the home screen as the "From your week"
blockquote. All insights are available for a future dedicated insights panel.

### Mood × trigger correlations

**`moodTriggerMatrix` (`src/domain/correlations.ts:19`).** Takes the log array
and a `topK` count (default 3). It scans every log that has *both* `moodBefore`
and `triggerTag` set, building a `Map<"mood|trigger", { count, sumPrice,
nPrice }>`. Logs missing either field are silently skipped. The function returns:

- `moods` and `triggers` — alphabetically sorted arrays of all unique values
  seen, usable as matrix axes.
- `cells` — one entry per observed (mood, trigger) pair with its count.
- `total` — number of logs that had both fields set.
- `topPairs` — top-K pairs sorted by count descending (with lexicographic mood
  tiebreaking), each including the average unit price for that combination (null
  if no priced logs exist in the pair).

The matrix is displayed on the Trends screen as an `MoodTriggerMatrix` chart
component. The database also maintains a `v_mood_trigger_heatmap` view
(`supabase/migrations/20260504000000_enhancements.sql:157`) that aggregates the
same data server-side with `security_invoker = true`, so it inherits
`cigarette_logs` RLS. The in-memory function and the DB view are independent;
the web Trends page uses the raw logs for the interactive chart.

### Health milestone detection

**Constants.** Twelve milestones are bundled in
`src/constants/milestones.ts:32`, keyed by `minutes` since last cigarette:

| minutes | title | source |
|---------|-------|--------|
| 20 | 20 minutes | CDC |
| 480 | 8 hours | NHS |
| 1 440 | 24 hours | CDC |
| 2 880 | 48 hours | NHS |
| 4 320 | 72 hours | American Lung Association |
| 20 160 | 2 weeks | CDC |
| 43 200 | 1 month | American Lung Association |
| 129 600 | 3 months | NHS |
| 525 600 | 1 year | CDC |
| 2 628 000 | 5 years | CDC |
| 5 256 000 | 10 years | CDC |
| 7 884 000 | 15 years | CDC |

The same data also lives in `smoke_seed.health_milestones` and can be fetched
via `public.get_health_milestones()` RPC, but the constants file is what
actually drives the UI — the bundled copy means milestones work offline and
before the migration lands.

**`milestoneProgress` (`src/domain/health.ts:23`).** A pure function accepting
the ISO timestamp of the most recent cigarette and a `now` date. It walks the
sorted `HEALTH_MILESTONES` array to find `current` (the latest milestone already
reached) and `next` (the first not yet reached). It also returns `fractionToNext`
(0–1, how far through the gap between milestones), `minutesToNext` (raw count),
and `minutesSinceLast` (total elapsed minutes).

**Edge cases handled explicitly.** If `lastSmokeIso` is `null`, `undefined`, or
unparseable, `minutesSince` returns 0 and the progress object starts at the
beginning of the ladder with `current = null`. A future timestamp also clamps to
0. Past the final milestone (15 years), `next` is `null` and `fractionToNext` is
1.

**`formatMinutesUntil` (`src/domain/health.ts:51`).** Converts a minute count
to a human-readable string: under 1h → "45m"; under 1d → "1h 15m"; under 30d
→ "1d 6h"; under 1y → "3 mo"; 1y+ → "2y". The display rounds down.

The `HealthMilestones` component on both platforms receives `lastSmokeIso`
(derived from `lastLog(logs)?.tsUtc`) and calls `milestoneProgress` to know what
to show.

### INR savings

**Two savings models.** `src/domain/savings.ts` exposes two distinct
calculations, both fully transparent so the user can trust the figure:

`potentialSavings` (`savings.ts:19`) answers "how much money did you not spend
by smoking less than your baseline?" It sums `max(0, baseline - actual_sticks)`
over each day in the range and multiplies by `avgUnitPrice` (the weighted
average unit price across all priced logs). The result includes `sticksAvoided`,
`avgUnitPriceUsed`, and the total INR figure so the UI can show the arithmetic.

`actualSavings` (`savings.ts:53`) answers "how much less did you actually spend
per day compared to your expected daily spend?" It sums
`expectedSpendPerDay - actualSpendThatDay` per day. Negative deltas (days where
you spent more than expected) are preserved in `rawDeltaInr` but clamped to zero
in `displayInr` — the displayed total never misleads by netting a bad day
against a good one in an unexpected direction.

**Baseline derivation.** `deriveBaselinePerDay` (`savings.ts:76`) uses
`rollingAvgSticks` over a trailing window ending *yesterday*, so today's
in-progress day does not skew the baseline downward. Similarly
`deriveBaselineSpendPerDay` uses daily stats for the same window.

**What the home screen shows.** The `savings` memo on the home screen
(`app/(tabs)/index.tsx:401`) uses `potentialSavings` anchored to
`profile.onboardedAt` or 30 days ago, using `profile.baselinePerDay`. If there
is no baseline on the profile, savings are `null` and the card is hidden. The
month forecast below it uses `forecastMonthlySpend` (`src/domain/calc.ts:199`),
which extrapolates `elapsedSpend / daysElapsed * daysInMonth` — useful as a
planning figure, not a promise.

## Invariants

These rules must not break.

- `evaluateGoal` is pure. It never reads from the database and has no side
  effects. Every test that imports it should be able to do so without mocking
  anything.
- `GoalProgress.percent` is always in 0–100 with one decimal place, enforced by
  `clampPercent` (`src/domain/goals.ts:30`). A caller can always render it
  directly without clamping again.
- The `no_smoke_window` goal handles overnight windows. If `startHour >= endHour`
  (e.g. 22–06), the window wraps midnight and both sides are in scope
  (`src/domain/goals.ts:77`). This is the only goal type where the period can
  cross a date boundary.
- `reduction_target` locks the baseline at `currentBaseline` on the goal record.
  If `currentBaseline` is null (a legacy goal that pre-dates the column), it
  falls back to a computed 30-day window ending the day before `startDate`
  (`src/domain/goals.ts:128`). The fallback exists precisely so old goals keep
  evaluating correctly. New goals written via `createGoal` pass
  `currentBaseline` explicitly.
- `generateInsights` never returns an empty array. When there are fewer than 3
  logs it returns exactly one placeholder insight (`src/domain/insights.ts:16`).
  The home screen can always safely read `insights[0]`.
- `moodTriggerMatrix` silently skips any log missing `moodBefore` or
  `triggerTag`. The caller should never pre-filter; the function owns that
  logic (`src/domain/correlations.ts:26`).
- `potentialSavings.sticksAvoided` is never negative — the per-day avoided count
  is clamped to `max(0, baseline - actual)` (`savings.ts:29`).
- Health milestones render a "general health information, not medical advice"
  disclaimer. This is the load-bearing liability mitigation, not the source
  attributions.

## Edge cases and gotchas

**Only one goal on the home screen.** The session store returns all active goals
in creation-descending order. The home card uses only `goals[0]`. A user with
multiple active goals sees only the most recently created one on the home
screen. There is no goal list or goal management UI yet.

**`atRisk` and `isOnTrack` are not opposites.** For `reduction_target`,
`isOnTrack` is true when `current <= target` *or* when progress is past 50% —
both can be true simultaneously with `atRisk = !onTrack`, so `atRisk` and
`isOnTrack` can both be false (`src/domain/goals.ts:145`). The UI handles all
three states: the accent colour for on-track, amber for at-risk, and neutral for
neither.

**Insight fire order is fixed.** The five checks run sequentially and all that
fire are appended. With 30 days of uniform data, all five might fire at once. The
home screen shows only `insights[0]`, so it always shows the time-of-day or
trigger insight if those conditions hold, never the brand or trend insight from
further down the array. The display order is the specification order.

**Savings are `null` until baseline is set.** `profile.baselinePerDay` comes
from the user profile, not from history. If the user skipped the baseline step
in onboarding, the whole savings card stays hidden. The `deriveBaselinePerDay`
function exists but must be called explicitly — the dashboard does not call it
automatically to fill a missing profile baseline.

**The baseline for savings uses profile baseline, not a derived one.**
`potentialSavings` on the home screen receives `profile.baselinePerDay` as its
`baselinePerDay` input. `deriveBaselinePerDay` exists for callers that want to
recompute from history (e.g. a trends or settings screen), but the home screen
does not use it.

**`meta_json` is stored as `jsonb` but arrives as either object or string.**
Supabase can return `jsonb` columns either way depending on client version. The
`rowToGoal` function handles both by checking `typeof raw === 'string'` and
parsing manually (`src/db/repositories/goals.ts:29`). Callers must not assume
the type.

**Health milestones have no source URLs yet.** `sourceUrl` is `null` on every
entry in `src/constants/milestones.ts`. The field exists and the UI conditionally
renders a link when it is non-null, but the legal/clinical review pass to
populate them has not happened. The institutional name (CDC, NHS, American Lung
Association) is surfaced instead.

**Mood × trigger matrix is sparse by design.** Most logs will have neither
`moodBefore` nor `triggerTag` set, because both are optional at log time. In a
typical early session, `total` in `MoodTriggerMatrix` will be zero and `topPairs`
will be empty. The chart component must handle this gracefully.

**`actualSavings.rawDeltaInr` can be negative.** If a user spent more than their
expected daily baseline on some days, `rawDeltaInr` captures that truthfully.
Only `displayInr` suppresses negative contributions. If you want to show the
honest net figure, use `rawDeltaInr`, but warn the user it can go negative.

## Tests

The four domain modules are each covered by a dedicated test file.

`src/tests/goals.test.ts` — covers all six goal types. Key assertions: `daily_cap`
counts only today's sticks; `no_smoke_window` treats overnight windows correctly
(a log at hour 23 is inside a 22–06 window); `weekly_target` sums Mon–today;
`reduction_target` uses the rolling 7-day average and compares to the locked
baseline; `quit_date` computes `unit: 'days'` and builds the label from
`endDate`.

`src/tests/insights.test.ts` — checks the bootstrap gate (1 log → placeholder),
time-of-day peak detection (30 days of logs all at hour 8 → "between 8:00" in
the title), trigger concentration (10 stress logs, 1 boredom → "stress" insight),
and brand spend dominance (Alpha at 10× Beta spend → "Alpha" in the title).

`src/tests/health.test.ts` — tests `minutesSince` for null/invalid/future inputs,
tests `milestoneProgress` at key thresholds (just below 20 min, exactly 20 min,
between 20 min and 8 h, past all milestones), and tests every branch of
`formatMinutesUntil` via a parametric `it.each`.

`src/tests/correlations.test.ts` — verifies empty input returns zero total and
empty arrays; verifies that logs missing one field (mood but no trigger, or
trigger but no mood) are excluded; verifies `topPairs` ordering by count
descending; verifies `avgUnitPriceInr` averages only priced entries (null
`unitPriceInr` does not skew the average); verifies that `moods` and `triggers`
axes are alphabetically sorted.

`src/tests/calculations.test.ts` covers `potentialSavings` (22 sticks avoided ×
₹20 = ₹440), `actualSavings` clamping (negative day zeroed, positive day
preserved, raw delta correct), and `deriveBaselinePerDay` (uses yesterday as
anchor).

## Open gaps

- There is no dedicated goals management screen. A user cannot view all their
  goals, archive completed ones, or create a new goal from inside the app. The
  repository layer (`createGoal`, `setGoalStatus`, `deleteGoal`) is complete but
  there is no UI wired to it.
- Only `goals[0]` is shown on the home screen. A user who sets a second goal has
  no way to see it without a management UI.
- The insights engine shows one insight on the home screen. There is no "all
  insights" panel yet, and no persistence — insights are regenerated on every
  render from the in-memory log array.
- Trigger and mood data are sparse in early use because both fields are optional
  on the log form. The trigger concentration and mood × trigger rules will be
  silent for most new users until tagging becomes habitual.
- Health milestone source URLs are all `null`. The `sourceUrl` field on
  `HealthMilestone` exists and the component renders it conditionally, but the
  legal/clinical review pass to populate specific canonical URLs has not happened.
- The `get_health_milestones()` RPC exists but the client currently uses the
  bundled constants file. If the DB milestone data diverges (e.g. a new
  milestone is added to the migration but not to `milestones.ts`), the UI will
  not pick it up automatically.
- `actualSavings` is not surfaced on the home screen — only `potentialSavings`
  is shown. The actual-savings model is fully implemented and tested but awaiting
  a suitable display location.
- The insights array can have all five or six rules fire simultaneously, but the
  home screen shows only the first. The display priority is dictated by the
  order the checks appear in the source file, which was not formally specified
  as a product priority order.

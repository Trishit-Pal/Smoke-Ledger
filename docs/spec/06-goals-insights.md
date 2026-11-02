---
section: goals-insights
sources:
  - src/domain/goals.ts
  - src/domain/insights.ts
  - src/domain/correlations.ts
  - src/domain/health.ts
  - src/domain/savings.ts
  - src/db/repositories/goals.ts
  - src/domain/goalMeta.ts
  - src/domain/goalAdherence.ts
  - src/domain/goalProposals.ts
  - src/domain/goalTransitions.ts
  - src/domain/goalForm.ts
  - src/domain/goalFormView.ts
  - src/domain/goalCardModel.ts
  - src/domain/goalReconcileView.ts
  - src/domain/goalStepView.ts
  - src/domain/capLine.ts
  - src/domain/firstSuggestion.ts
  - src/services/goalReconcile.ts
  - src/lib/goals/**
  - web/lib/goals/**
  - web/app/(app)/goals/**
  - app/(tabs)/goals.tsx
  - app/goals/**
last_verified_commit: 256c296
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
Supabase is involved only for persisting goals (including the quiet status
writes described under Goals) and, on the trends screen, for the background
`v_mood_trigger_heatmap` view and the `get_random_facts` RPC.

Ledger Chat ("Ask the ledger") is a separate, opt-in surface that calls these
same functions through read-only tools (`src/domain/ledgerChat/tools.ts`) and
lets a model narrate around the results. It does not change anything in this
section: insights stay deterministic, and the chat's figures are these
functions' outputs. Its security and privacy model is in
`08-security-privacy.md`.

## What the user experiences

On the home screen (native: `app/(tabs)/index.tsx`; web: `DashboardClient.tsx`)
the user sees, from top to bottom:

1. **Today's count and spend** — the raw numbers from today's logs.
2. **A deck sentence** — one sentence contextualising today against baseline and
   streak, e.g. "12 today — above your usual." or "Smoke-free for 7 days. Quiet
   day."
3. **The ledger** — a typographic row showing 7-day rolling average and trend
   delta vs. the 30-day baseline, plus current smoke-free streak.
4. **Goal verse** — if at least one goal is active, the most recently created one
   shows its label, a percentage towards target, a thin progress bar or ring, and
   a plain explanation sentence. The colour is the accent teal when the goal is
   on track or met and terracotta for any concern; never red or amber. Under it,
   when there is something to say, one quiet sentence such as "Over once in the
   last 7 days." or "Held for 14 days. A next step is waiting on the goals page."
   With no active goal and a week or more of logging, a small "A first goal"
   block offers a starting cap instead.
5. **The week** — a minimal bar chart of the last 7 days.
6. **Body recovery / health milestones** — a panel anchored to the timestamp of
   the last logged cigarette, counting forward through a ladder of physiological
   events from "20 minutes" (heart rate drops) to "15 years" (heart disease risk
   matches a non-smoker).
7. **From your week** — the top insight, formatted as an editorial blockquote
   with a left border rule.
8. **Potential savings + month forecast** — visible only when a baseline exists
   and `totalInr > 0`.

The goals screens (web `/goals`, the mobile goals tab) list every goal. Each
active goal carries a one-line state caption ("On track", "At risk · over once in
the last 7 days", "Off track · over 3 of the last 7 days", "Met · held 14 days")
and, when the ledger has a suggestion, a next step or a re-anchor with Accept,
Edit and Not now. A goal whose date arrives, or whose taper finishes, completes
on its own with a short quiet moment. A new goal is offered a starting number
taken from the reader's last two weeks, which they can take or replace.

Nothing nags. Every observation is stated flatly, without value judgement.

## How it works

### Goals

Goals are the one place in this section where the app writes back. They no longer
just sit there being evaluated: the ledger watches how each daily cap is holding,
offers a next step when it has held, offers to re-anchor when it has not, and
closes a goal by itself when its date arrives or its taper finishes. The reader
stays in charge of every number: nothing is changed without an Accept, and the
only thing written unasked is a status (a goal met or completed), never a cap.

**The data model.** Goals live in `public.goals`
(`supabase/migrations/20250426120000_initial_schema.sql:112`). The table has:
`id`, `user_id`, `type` (text, one of seven values), `target_value` (double
precision), `current_baseline` (nullable double precision), `start_date` and
`end_date` (text, `YYYY-MM-DD`), `status` (active / paused / completed /
abandoned), `meta_json` (jsonb for type-specific extras), `created_at`, and
`completed_at` (see below). RLS is `goals_all`: every operation is restricted to
`user_id = auth.uid()`. The column list is in `02-data-model.md`.

**Types.** `GoalType` is a union of seven string literals (`src/types/index.ts`):
`daily_cap`, `taper`, `spend_cap_daily`, `weekly_target`, `no_smoke_window`,
`quit_date` and `reduction_target`. `taper` is new: a daily cap that steps down
toward a `finalTarget`. `reduction_target` still evaluates and still shows, but
the create form no longer offers it (`creatable: false` in `GOAL_TYPE_META`,
`src/domain/goalForm.ts`); a taper covers the same intent with the reader's
consent at each step. The picker order is daily cap, taper, quit by a date, spend
cap, weekly cap, no-smoke window. `Goal` carries `completedAt: string | null`,
which the database stamps.

`spend_cap_daily` kept its name but now carries a **period**: `day`, `week` or
`month`, stored as `meta.period` (absent means `day`). The label reads "Daily /
Weekly / Monthly spend cap", and the window is today, Monday to today
(`startOfWeekIst`), or the first of the month to today. The period is chosen when
the goal is created and cannot be changed afterwards, the same as the type: the
edit form shows it read-only. Changing it would leave a step history written in
one window's units applied to another, so a reader who wants a different period
creates a new goal. Only the daily period is "cap-like" (below); a weekly or
monthly spend cap behaves like the weekly stick cap.

**`meta_json` is read through one function.** `readGoalMeta(goal)`
(`src/domain/goalMeta.ts:65`) returns a typed `GoalMeta`
(`startHour`, `endHour`, `period`, `finalTarget`, `steps`, `metOn`,
`dismissals`). It keeps a field only when its shape is right, drops unknown keys
and malformed steps, and never throws, so a hand-edited or legacy row cannot
crash a screen. New code must not cast `goal.meta` directly. The repository
(`rowToGoal`, `src/db/repositories/goals.ts:30`) still parses `meta_json`
whether Supabase returns it as a string or an object, and fills `completedAt`.

**Taper steps live in meta.** `meta.steps` is the cap's history: an array of
`{ cap, from, reason }` where `reason` is `start`, `next`, `reanchor` or `edit`.
`capOn(goal, ymd)` answers "what cap was in force that day" (null before the goal
started; `targetValue` when there is no history). `targetValue` always equals the
latest step's cap, so a reader who only wants today's number never has to walk the
array. `currentStepStart(goal)` is the latest step's `from`, else the start date.
`appendStep` seeds the `start` step from the original `targetValue` the first time
a goal that had no history changes, so a plain daily cap gains a history only when
it is first adjusted. A taper's `meta.finalTarget` is its floor.

**Validation.** Every `createGoal` call runs the input through `GoalSchema` before
touching the database (`src/db/repositories/goals.ts:70`). The Zod schema
(`src/lib/validation.ts:151`) enforces `targetValue > 0` up to 1 000,
`endDate >= startDate`, and validates `type` against the enum, which now includes
`taper`; the database CHECK carries the same list. `ImportGoalSchema` accepts an
optional `completedAt` so an export round-trips.

**Evaluation: `evaluateGoal` (`src/domain/goals.ts:54`).** A pure function that
takes a `Goal`, the full log array, and a `today` date string, then returns a
`GoalProgress`. The seven cases:

- `daily_cap` and `taper` share one branch: sticks on `today` against
  `targetValue`; `atRisk` is true at 80% up to the cap. A taper's label reads
  "Taper: 6/day → 3" (current cap, then `finalTarget`) and its explanation says
  which step it is on.
- `spend_cap_daily`: the same logic over the period's window (`spendOn` summed from
  the window start to today), reported in the ledger's currency (INR, or EUR for
  an EU country).
- `no_smoke_window`: reads `startHour` / `endHour`, handles overnight windows
  (e.g. 22:00-06:00) by wrapping midnight. `percent` is 100 if no sticks fell
  inside the window, 0 otherwise. `atRisk` is always false because the goal is
  binary.
- `weekly_target`: sums sticks from `startOfWeekIst(today)` to `today`. The week is
  Monday to today.
- `reduction_target`: a 7-day rolling average against `currentBaseline` (snapped at
  creation) or, for a legacy goal, a 30-day average ending the day before the goal
  started. Progress is `(baseline - current) / (baseline - target)`, clamped to
  0-100.
- `quit_date`: `endDate` is the quit day. `percent` is elapsed days over total
  days; `atRisk` is set when the reader is not trending down and the date is within
  7 days.

**State vocabulary: `goalState` (`src/domain/goalAdherence.ts:87`).** On top of the
progress numbers, every goal has one of four states, and they are the words the
screens use: **on track**, **at risk**, **off track**, and **met**. "Met" is new:
it means a cap has held long enough that the ledger has noticed (below).

A goal is *cap-like* (`isDailyCapLike`) when it is a `daily_cap`, a `taper`, or a
`spend_cap_daily` with the `day` period. Only cap-like goals have a daily record,
so only they get the full four-way state, holds, transitions and proposals. For
them the state looks at the **rolling last 7 days** ending today (a window of
seven dates, not the calendar week), counting the days whose use went over the cap
in force that day:

- 3 or more over days: `off_track` (`OFF_TRACK_OVER_DAYS`).
- 1 or 2 over days: `at_risk`.
- None over, but today is already at 80% of today's cap (and something was
  smoked): `at_risk` (`AT_RISK_RATIO`). The `used > 0` guard keeps a zero cap with
  nothing smoked from reading as at risk.
- Otherwise `met` if the goal carries `meta.metOn` **and** `holdStatus(...).isHeld`
  is still true, else `on_track`. `metOn` is only the record of a past hold; met is
  a live condition. A reader who stops logging, or who goes over and then has a
  clean week, falls back to `on_track` and is not offered a next step.

Every other type has no daily record, so its state is taken from `evaluateGoal`:
`off_track` when not on track, `at_risk` when `atRisk`, else `on_track`. Such a goal
never reads as `met`.

**The window is clipped to the goal's start.** `dailyAdherence(goal, logs, today,
days = 7)` returns one `{ date, used, cap, over, logged }` per day, ascending, but
omits any date before `goal.startDate`. A goal created today therefore has a
one-day record, never a week of history it did not govern, and cannot read as at
risk or off track from days before it existed. The price is that a goal's first
week shows fewer than seven days of record.

**Holds.** `holdStatus(goal, logs, today)` counts the run of consecutive
within-cap days ending **yesterday** (today is still in progress), going back no
further than the start of the current step. The run is a *hold* (`isHeld`) when it
is at least 14 days (`HOLD_DAYS`) **and** at least 10 of the last 14 days have a
log entry (`HOLD_MIN_LOGGED_DAYS`). The second condition is the point: an empty
ledger is within every cap, and a silent fortnight is not evidence of anything.
Because the run stops at the step start, accepting a new cap or editing the cap
restarts the clock.

**What the screens say.** Wording lives in two shared functions so web and mobile
cannot drift. `stateCaption(state, overDays, heldDays)` is the caption on a goal
card: "On track"; "At risk · close to the cap", "At risk · over once in the last 7
days", "At risk · over N times in the last 7 days"; "Off track" or "Off track ·
over N of the last 7 days"; "Met · held N days". It says "in the last 7 days",
never "this week", because the window rolls. `homeGoalLine(state, overDays,
heldDays, hasProposal)` is the one quiet sentence under the goal on Home, or null:
nothing when on track; "Close to the cap." / "Over once in the last 7 days." /
"Over N times in the last 7 days." when at risk; "Over the cap on N of the last 7
days." (plus "A re-anchor is waiting." when a proposal exists) when off track;
"Held for N days." (plus "A next step is waiting on the goals page.") when met. A
goal with no daily record (a weekly cap, a quit date, a reduction goal) reports
zero over days and gets the plain caption "Off track" and Home line "Off track." rather than an invented
count or a claim about a cap it may not have.

**Colour.** Teal (`--accent` on web, `theme.accent` on mobile) appears only for
`on_track` and `met`. Every concern, including at risk and off track, is the
terracotta `--warn-earth` / `theme.warnEarth`, on the figure, the ring or bar, and
the caption. Never red, never amber. The mobile `ProgressBar` gained a `warnEarth`
tone for this.

**Proposals (`src/domain/goalProposals.ts`).** A proposal is a ledger-derived
number the reader may accept. There are three kinds:

- **Start**: a first cap for a new goal, shown on the create form.
- **Next**: the next step down for a goal that is *met*, that is, one whose hold still stands (`metOn` and `isHeld`); the sentence "Fourteen days under X" is then true.
- **Re-anchor**: a cap the reader can actually keep, for a goal that is *off
  track*.

`proposalFor(goal, logs, today, state, opts)` picks one: `met` yields a next step,
`off_track` yields a re-anchor, anything else yields none.

Every kind needs enough history first (`hasEnoughHistory`): at least 7 distinct
days with a log among the 30 ending today (`MIN_LOGGED_DAYS_FOR_PROPOSAL`,
`PROPOSAL_DATA_WINDOW_DAYS`). Below that the ledger says nothing rather than
guessing from a thin record.

The maths, with `avg14` the mean sticks per day over the 14 days ending
**yesterday**, and `avg7` the same over 7 days:

| Proposal | Value |
|---|---|
| Start, `daily_cap` / `taper` | `max(1, round(avg14) - 1)` sticks a day; none when `avg14 < 1` |
| Start, `weekly_target` | `round(avg14 x 7 x 0.9)` sticks a week |
| Start, `spend_cap_daily` | `avg daily spend x 1 / 7 / 30 (day / week / month) x 0.9`, rounded to a step of ₹10 (€5) |
| Start, `quit_date` | a date 42 days from today (`QUIT_DATE_PROPOSAL_DAYS`) |
| Next, sticks | `round(avg7)` over the 7 days ending yesterday, held between the floor and `cap - 1`; the floor is `finalTarget` for a taper and 1 otherwise; none when already at the floor |
| Next, spend | the smaller of `cap x 0.9` and the 7-day average spend, rounded **down** to the step; none when it would be 0 or not below the cap |
| Re-anchor, sticks | `ceil(avg7)` over the 7 days ending **today**, at most 1 000; none when it would not be above the current cap |
| Re-anchor, spend | the 7-day average spend rounded **up** to the step, at most 1 000; none when not above the cap |

Next and re-anchor only exist for cap-like goals. A weekly or monthly spend cap
and a weekly stick cap therefore get a start proposal on the create form but never
a next step or a re-anchor.

**Snooze.** "Not now" on a card proposal writes today's date into
`meta.dismissals[kind]` (`next` or `reanchor`, kept separately). The proposal is
hidden until 14 days have passed (`PROPOSAL_SNOOZE_DAYS`) and then returns if it
still applies. **Accept** writes one patch (`acceptProposalPatch`): the new
`targetValue`, a new step `{ cap, from: today, reason: 'next' | 'reanchor' }`, and
`metOn` cleared, so a new cap has to earn its own hold. Editing the target of a
cap-like goal by hand (`buildGoalPatch` with `existing`) does the same with reason
`edit`; an edit that leaves the cap unchanged keeps `metOn`, and a taper edit keeps
its original baseline and its step history.

**Wording and discreet mode.** `describeProposal` writes the editorial copy for
each kind: a headline ("Next: 4 a day?"), a basis ("Fourteen days under 5."), and
a short value label for the row. Callers must pass `currentCap` (the cap in force
today) for a next step, or the basis cannot name it. Under discreet mode
(`isDiscreetMode(profile)`) any proposal that carries money uses masked wording,
with the value label "—" in every kind: a start reads "Start a little under your
recent spend?" with the basis "Amounts are hidden in discreet mode."; a next step
reads "Next: a little lower?" with "Fourteen days under your current cap."; a
re-anchor reads "Re-anchor to where you are now?" with only the day count ("Over
on N of the last 7 days."). The accept button reads "Use the suggestion" instead of echoing a masked
value. Stick counts are not masked here; only spend amounts are. The create form's
prefilled target input is the one place the amount can show, because the existing
form never masked what the reader types.

**The create form.** On `/goals` (web, `?type=` preselects) and `goals/new`
(mobile), picking a type shows its start proposal above the inputs ("Use X" or
"Choose my own"); changing the type or the spend period offers a fresh one. A taper
asks for a starting cap and a `finalTarget` below it, seeds `steps` with the start
step, and snapshots a 30-day baseline. A spend cap shows the period chips on create
and a read-only period on edit.

**One active-or-paused goal per type.** `createGoal` rejects a new goal with
`AppError('conflict')` if a goal of the same type is already active or paused. The
form guards this for UX (`blockingSameTypeGoal`); the repository check catches
direct/API/race paths. A same-type goal can be created again once the prior one is
completed or abandoned.

**Transitions: what changes by itself.** `planGoalTransitions(goals, logs, today)`
(`src/domain/goalTransitions.ts:28`) returns at most one change per active goal:

- `quit_date` goal and `today >= endDate`: `auto_complete` (reason `quit_date`).
- Cap-like goal, no `metOn` yet, and `holdStatus(...).isHeld`: for a taper already
  at or below `finalTarget`, `auto_complete` (reason `taper_done`); otherwise
  `mark_met`, which writes `meta.metOn = today`.

Nothing else is automatic. Paused goals are left alone. `applyGoalTransitions`
returns new goals with the changes applied (a completion also gets a local
`completedAt`), never mutating its input. The planner is idempotent: once `metOn`
is written, or the status has changed, the next plan is empty, so running it on
every load is safe and a second tab or device doing the same write is harmless.

**Where reconcile runs.** It is client-side, on load, in the reader's own date
(never UTC). `reconcileGoals` (`src/services/goalReconcile.ts:37`) takes the
repository writers as an argument so it imports no database code, writes each due
transition in order, and returns `{ goals, applied, failed }`. One failed write
never blocks the rest and never throws; it goes into `failed` and is simply
planned again on the next load.

- **Web.** The `useGoalReconcile(goals, logs, today)` hook
  (`web/lib/goals/useGoalReconcile.ts`) runs on `/goals` and on Home, once per
  distinct goals snapshot (keyed by ids and statuses, so strict-mode double effects
  and a refresh returning the same goals never write twice). After a write it
  revalidates and refreshes the page. Two pages mounting it at once is safe for the
  reason above.
- **Mobile.** The session store reconciles in `boot()` (using the zone of the
  profile just loaded, because the store's profile is not set yet) and in
  `refreshGoals()` (using `ledgerToday()`), which the goals tab's focus refresh and
  the realtime refresh both call (`reconcileLoaded`, `src/store/session.ts:56`).
  Completions are queued as `pendingGoalMoments`; the goals tab announces them
  when focused through `consumeGoalMoments`.

**Failed writes are said out loud and never drawn as done.** The goals the screen
renders are the loaded goals with every due transition applied *except those whose
write failed* (`renderedGoals`, `src/domain/goalReconcileView.ts`), so a goal the
database still holds as active does not appear completed. The reader sees one
quiet line in warn-earth: "Some goal updates could not be saved. They will be
retried next time." On web it is the page-level notice on `/goals` and under the
goal on Home; on mobile the store keeps `goalsReconcileFailed` and the goals tab
shows it.

**Completion.** When a goal completes on its own, a quiet moment is announced
(`completionMoment`: "Quit day." for a reached date, "Tapered." for a finished
taper; the existing `GoalMoment` overlay, see `07-celebrations.md`) and
`goal_auto_completed` is tracked with the goal type and reason only. Accepting or
dismissing a proposal tracks `goal_proposal_accepted` / `goal_proposal_dismissed`
(type and kind only); `goal_created` carries `from_proposal`. No payload holds an
id or a user-typed value.

**`completed_at`.** The database stamps it, not the client. A BEFORE UPDATE OF
`status` trigger, `goals_stamp_completed_at`, sets `completed_at = now()` when a
goal moves into `completed` or `abandoned` from `active` or `paused`, and clears it
when a goal returns to `active` or `paused`. Goals that were already finished
before the trigger existed keep a NULL, because the ledger does not invent dates.
The Done section shows "Completed 03/11/2026" or "Set aside 03/11/2026" when a
date exists and the bare word when it does not (`doneLabel`). The export carries
`completedAt` per goal. The mobile store mirrors the stamp locally in
`setGoalStatus` until the next load.

**Editing.** `updateGoal(id, patch)` validates through `GoalPatchSchema` and
updates only `target_value`, `current_baseline`, `end_date`, and `meta_json`
(type, start date and spend period are fixed at creation). An empty patch is a
no-op that returns the current row.

**Where goals appear.**

- **Home** (`DashboardClient` on web, `app/(tabs)/index.tsx` on mobile) shows the
  most recently created active goal, with its state colour, and `homeGoalLine`
  beneath it. Web adds a "View all goals" link when there is more than one. The
  line is not rendered when Home totals are hidden (`isHomeTotalsHidden`), because
  its figures would then show on the most private screen.
- **The goals page** (web `/goals`, mobile goals tab) lists every goal in
  Active, Paused and Completed & abandoned groups. Each active card carries its
  state caption, its ring or bar in the state colour, any next-step or re-anchor
  proposal (Accept / Edit / Not now), and Pause, Mark complete and Delete; a paused card offers Resume instead of Pause.
- **Trends** draws the cap as a dashed line over "Daily sticks"
  (`pickCapGoal`, `withCapLine`, `src/domain/capLine.ts`, re-exported for web in
  `web/lib/goals/capLine.ts`). The goal is the first active `daily_cap` or
  `taper`; a spend cap is not drawn because the chart plots sticks. The line steps
  with the goal's history (`capSeries` over `capOn`), draws nothing before the goal
  started, and is drawn only when every point is one calendar day (web: always;
  mobile: only when the window has one row per day). A caption reads "dashed line:
  your daily cap" or "your taper", and the web screen-reader table gains a Cap
  column. On mobile the sticks axis is masked under discreet mode, since its top
  value includes the cap.
- **First-goal suggestion on Home** appears only when the reader has no active
  goal, a start proposal exists for a daily cap (so at least 7 logged days in the
  last 30 and an average of at least one a day over the last 14), and the reader has not dismissed
  it. It reads "N days in the ledger. Your average is X a day — a cap at Y?" with
  "See the suggestion" (opens the create form on `daily_cap`) and "Not now". Under
  hidden Home totals every figure is masked. "Not now" is remembered on that device
  only, as the date, in `localStorage` (web) or `AsyncStorage` (mobile), keyed by
  user id, and hides the suggestion for 14 days
  (`src/lib/goals/firstSuggestionDismissal.ts`). It is never sent to the server.
  Until the signed-in user id is read from the local session the suggestion stays
  hidden, and any failure to read it leaves it hidden.
- **Onboarding** gained a fourth goal card, "Suggest one later" ("After a week of
  logging"), shown only when no goal has been saved. Choosing it enables Continue
  and skips the step without creating a goal; the Home suggestion above is what
  follows.
- **Ledger Chat** reads goals through the `goal_status` tool
  (`src/domain/ledgerChat/tools.ts`). For each active goal it returns the progress
  fields plus `state`, `overDaysLast7`, `heldDays`, and the suggested
  `proposal` (`kind` and `value`), all from the same domain calls the screens make.
  A proposal also renders as its own row ("Suggested next cap" / "Suggested
  re-anchor") beside the goal's row, with the same render-time masking as any other
  chat figure.

**Session hydration.** On boot, `useSession.boot` fetches all goals regardless of
status via `listAllGoals`, reconciles them (above), and the store wraps the CRUD
paths (`addGoal`/`updateGoal`/`setGoalStatus`/`removeGoal`). `addGoal` takes
`{ fromProposal }` for analytics. `refreshGoals` re-fetches and reconciles on
demand.

**Log window and its ceiling.** Adherence, holds and proposals read raw logs, and a
heavy logger would exceed the 200-row cap of the generic log loaders within about
ten days. So the goal-consuming loaders fetch their existing window in one page of
up to 2000 rows: on web `getGoalsPageData` (60 days) and `getDashboardData` (60
days) through `getServerLogsPage({ fromDate, limit: 2000 })`; on mobile `boot` and
`refreshLogs` (90 days) through `listLogsPage({ fromDate, toDate, limit: 2000 })`.
It is still one request per load. The ceiling is 2000 rows: it covers at least 33
entries a day over 60 days and 22 over 90. If a page ever comes back with a cursor,
the upgrade path is to page until `nextCursor` is null; the
30-day proposal window stays complete in practice.

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
   top brand is ≥40% of spend, an insight names the brand and shows the spend.
   `generateInsights(logs, today, money)` takes the screen's money formatter, so
   a euro ledger reads euros; the default stays whole rupees for native and demo data.

A sixth rule (day-of-week dominance) runs via `dowDistribution`; it fires when
a single day holds ≥22% of sticks over 30 days (minimum 7 total sticks).

Only `insights[0]` is shown on the home screen as the "From your week"
blockquote. All insights are available for a future dedicated insights panel.
The chat's `insights` tool returns the full list (minus ids and timestamps) as
data the model may paraphrase; it adds no rows of its own.

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
  `clampPercent` (`src/domain/goals.ts:49`). A caller can always render it
  directly without clamping again.
- The `no_smoke_window` goal handles overnight windows. If `startHour >= endHour`
  (e.g. 22–06), the window wraps midnight and both sides are in scope
  (the `no_smoke_window` case in `src/domain/goals.ts`). This is the only goal
  type where the period can cross a date boundary.
- `reduction_target` locks the baseline at `currentBaseline` on the goal record.
  If `currentBaseline` is null (a legacy goal that pre-dates the column), it
  falls back to a computed 30-day window ending the day before `startDate`
  (`src/domain/goals.ts:159`). The fallback exists precisely so old goals keep
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
- Everything under `src/domain/goal*.ts`, `capLine.ts` and `firstSuggestion.ts` is
  pure: no database, no `Date.now()`, no React. `today` is always a
  `YYYY-MM-DD` string passed in, and no function mutates a goal, its `meta` or
  an array it was given.
- `meta_json` is read only through `readGoalMeta`. A malformed field is dropped,
  never trusted and never thrown on.
- Only `on_track` and `met` use the accent colour. Every concern is
  `--warn-earth` / `theme.warnEarth`. Goal state is never red or amber.
- Adherence windows are rolling 7 days, so copy says "in the last 7 days" and
  never "this week", and the window never reaches back before the goal's start
  date.
- A hold needs 14 consecutive within-cap days *and* 10 logged days among the last
  14, counted from the start of the current step. Silence is not adherence.
- The ledger never changes a cap on its own. It writes only a status
  (`metOn`, or `completed`); a new cap exists only after an Accept, and Accept
  clears `metOn`.
- Reconcile is idempotent and never throws. A write that fails is reported (a
  notice) and re-planned on the next load, and the screen never draws a failed
  transition as applied.
- Any sentence that contains a spend amount has a masked variant under discreet
  mode (`describeProposal`), and the accept button never echoes a masked value.
- A spend cap's period is fixed after creation. `completed_at` is stamped by the
  database trigger, never by the client.
- Insights never call a model. `generateInsights` and everything else in
  `src/domain` stays pure and deterministic; the chat in
  `src/domain/ledgerChat` only *reads* these functions, and its tool outputs
  must equal a direct call on the same inputs (pinned by
  `src/tests/ledgerChatTools.test.ts`).

## Edge cases and gotchas

**Home shows one goal; the goals page shows all.** The Home card is the most
recently created active goal (web adds a "View all goals" link when there is more
than one). A user with several goals sees the rest on the goals page. Home's state
colour and one-line sentence come from the same `goalCardModel` the goals page
uses, so the two cannot disagree.

**`atRisk` and `isOnTrack` are not opposites, and neither is the state.**
`evaluateGoal` still reports both flags (for `reduction_target` they can both be
false, since `atRisk = !onTrack`), but the colour and the caption come from
`goalState`, which is one of four values and is derived differently for cap-like
goals (from the rolling 7-day record) than for everything else (from
`evaluateGoal`). When reading a state, check which kind of goal it is.

**A quiet fortnight is not a hold.** Days with no log are within every cap, so a
reader who stops logging would otherwise be congratulated. The 10-logged-days
condition is what prevents that, and it is also why a proposal needs 7 logged days
in the last 30.

**Met can lapse.** `metOn` is written once and kept until the cap changes, but
the state is recomputed every load: a `met` goal that goes over the cap again
reads `at_risk` or `off_track`, and an off-track met goal is offered a
re-anchor, not a next step. The planner never writes `metOn` twice.

**Completion happens on a visit, not on the date.** The ledger has no server job
(no cron, no edge function). A quit date that passes while the app is closed
completes the next time the reader opens Home, the goals page, or the mobile app.

**Dates are the reader's.** Reconcile, adherence and proposals all take `today` in
the profile country's zone (IST when none), the same as the rest of the app.
Mobile boot reads the zone from the profile it just loaded because the store's
profile is not set yet at that point.

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
parsing manually (`src/db/repositories/goals.ts:35`). Callers must not assume
the type; they read the parsed object through `readGoalMeta`.

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

`src/tests/goals.test.ts` — covers all seven goal types. Key assertions: `daily_cap`
counts only today's sticks; `no_smoke_window` treats overnight windows correctly
(a log at hour 23 is inside a 22–06 window); `weekly_target` sums Mon–today;
`reduction_target` uses the rolling 7-day average and compares to the locked
baseline; `quit_date` computes `unit: 'days'` and builds the label from
`endDate`.

The adaptive-goals engine has one test file per module in `src/tests/`:
`goalMeta.test.ts` (the reader drops bad shapes, `capOn` across steps), `goalAdherence.test.ts` (window clipped to the start, holds, the four
states, caption and Home-line wording), `goalProposals.test.ts` (every proposal's
maths and gates, snooze, discreet masking), `goalTransitions.test.ts` and
`goalReconcile.test.ts` (planner idempotence, apply never mutates, a failed write
is reported not thrown), `goalReconcileView.test.ts` (a failed transition is not
rendered as applied), `goalForm.test.ts` / `goalFormView.test.ts` /
`goalStepView.test.ts` (taper and period payloads, accept and dismiss patches,
form and onboarding decisions), `capLine.test.ts`, `firstSuggestion.test.ts`,
`sessionUserId.test.ts`, and `session-goals.test.ts` (store reconcile on boot
and refresh, queued moments, `completedAt` mirrored). `ledgerChatTools.test.ts`
pins `goal_status` against direct domain calls. Web decisions are in
`web/__tests__/goalsView.test.ts` and `firstSuggestionStore.test.ts`
(vitest), and `web/e2e/goals.spec.ts` drives a proposal, a quit-date completion,
an at-risk caption and a re-anchor in a browser against a seeded account (it
skips without the e2e service-role env).

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

- Goals completing on a quit date or a finished taper is done by the client on
  load, not by a server job. If the app stays closed past the date, the goal
  completes at the next visit and its `completed_at` is that visit's time, not the
  date. A scheduled job was ruled out for the free-tier budget.
- Only daily caps, tapers and daily spend caps adapt. Week and month spend caps
  and weekly stick caps get a start proposal at creation and a state, but never a
  next step or a re-anchor, and never reach `met`; a quit date gets a start date
  proposal and completes on its date; no-smoke windows and legacy reduction goals
  get no proposal at all.
- Under discreet mode the screen-reader data tables behind the Trends charts
  (`ChartDataTable`, now with a Cap column) and the mobile "Around X a day"
  sentence under the sticks chart are not masked. Both pre-date this work; the
  cap line widened the first.
- A failed reconcile write is retried only by the next load; there is no retry
  queue or backoff, and mobile shows the failure notice only on the goals tab.
- `no_smoke_window` still reads its hours straight from `goal.meta` rather than
  through `readGoalMeta`; the rule that all meta goes through the reader applies
  to new code and has not yet been back-applied there.
- The Trends cap line covers the first active daily cap or taper only; a spend cap
  is never drawn, and a second cap goal is ignored.
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

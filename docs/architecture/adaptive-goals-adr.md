# ADR: Adaptive goals

**Status:** Proposed
**Date:** 2026-11-02
**Deciders:** Project owner
**Design:** `docs/superpowers/specs/2026-11-02-adaptive-goals-design.md`

## Context

Goals are stored in `public.goals` and evaluated by the pure `evaluateGoal` on every render. Nothing is written back, so goals never complete, never record a hold, and never change on their own. The adaptive-goals design adds proposals, a met state, warnings, a taper type, spend periods, and automatic completion for quit dates and finished tapers.

Forces:

- **Free tier.** Supabase, Vercel and EAS are all on free plans. No scheduled jobs; avoid new per-request queries.
- **Two clients.** The Next.js web app and the Expo app both call the same repository functions from the client. They share `src/domain`.
- **Product rule.** Nothing may change a target silently. The reader accepts every step.
- **Compliance.** DPDP export must include every stored field.

## Decision 1: Where state transitions run

### Option A: Client-side, at load (chosen)
A pure planner returns the transitions; a thin shared service writes them through the existing repos. Both apps call it when goals load.

| Dimension | Assessment |
|---|---|
| Complexity | Low. One pure function plus one small service |
| Cost | Zero. Writes happen only when a transition exists |
| Scalability | Per user; no shared state |
| Team familiarity | High. Same pattern as every existing write |

**Pros:** no new infrastructure; one implementation for both apps; testable as pure code.
**Cons:** a quit date that passes while the reader is away completes only on their next visit; two open tabs can write the same transition.

### Option B: Server component, at load
**Pros:** happens before paint.
**Cons:** server renders gain side effects; the mobile app would need a separate path; cache revalidation becomes tangled.

### Option C: Scheduled job
**Pros:** completion happens on the date even if the reader is away.
**Cons:** needs a cron or edge function, which the free-tier rule excludes; it would run for every user whether they open the app or not.

**Trade-off:** completion-on-next-visit is acceptable because the reader can only see a goal by opening the app. Duplicate writes from two tabs are harmless because the planner returns nothing once the first write lands.

## Decision 2: How "met" is recorded

### Option A: A `metOn` stamp in `meta_json`, status stays active (chosen)
**Pros:** nothing changes status without consent; the next-step proposal hangs off the same goal; no schema change.
**Cons:** "met" is not queryable as a column.

### Option B: A new status value `met`
**Pros:** visible in SQL.
**Cons:** widens the status CHECK; every surface that filters by `active` would hide met goals; the one-active-per-type rule would need rework.

## Decision 3: Taper representation

### Option A: New type `taper`; `target_value` is the current step cap; steps in `meta_json` (chosen)
**Pros:** `evaluateGoal` reuses the daily-cap arithmetic; the step history is the goal history; accepting a step is one in-place update.
**Cons:** the CHECK constraint widens; `meta_json` carries structured data that needs a defensive reader.

### Option B: A chain of `daily_cap` goals, one per step
**Pros:** no new type.
**Cons:** fights the one-active-per-type rule; scatters a single intention across many rows; history is harder to read.

## Decision 4: Spend period

### Option A: `meta_json.period` on the existing `spend_cap_daily` type (chosen)
**Pros:** no CHECK change; the region trigger in `20261013120000_region_currency.sql` keeps matching this type; still one spend cap per reader.
**Cons:** the type name says "daily" for a weekly cap. The user-facing label becomes "Spend cap".

### Option B: New types `spend_cap_weekly` and `spend_cap_monthly`
**Cons:** three spend goals could coexist; the region trigger and every type switch need updating.

## Decision 5: `completed_at`

### Option A: Column stamped by a `BEFORE UPDATE OF status` trigger (chosen)
**Pros:** every path gets it, including manual "Mark complete" on both apps and any future one; no repo change.
**Cons:** logic lives in SQL; the export function must be copied forward to include it.

### Option B: Stamped in `setGoalStatus`
**Cons:** easy to bypass; two clients to keep in step.

We skip `updated_at`: nothing reads it.

## Consequences

- Easier: goal history, honest completion dates, proposals anchored to real data, one rule set on both apps.
- Harder: `meta_json` now carries several structured fields; `readGoalMeta` must be the only reader.
- Revisit: per-period adherence if readers want proposals on weekly or monthly spend caps; a scheduled job if completion-on-visit proves confusing.

## Action items

1. [ ] Migration `20261103000000_adaptive_goals.sql` (type CHECK, `completed_at`, trigger, export copy-forward).
2. [ ] Shared domain modules and the reconcile service, test-first.
3. [ ] Web, mobile, chat, and Trends surfaces.
4. [ ] Spec section `06-goals-insights.md` refreshed.

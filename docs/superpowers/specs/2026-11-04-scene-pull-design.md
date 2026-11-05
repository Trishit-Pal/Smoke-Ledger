# The ambient scene pulls toward quitting: the next milestone, and the money kept

**Date:** 2026-11-04 · **Owner decisions:** in chat 2026-11-04 · **Builds on:** `feat/scene-lungs` (breathing glass lungs, clearing haze, terracotta sign; plan `docs/superpowers/plans/2026-11-04-scene-lungs.md`)

## Why

The owner wants the background to push harder toward quitting. PRODUCT.md forbids guilt, coercion, manufactured urgency and alarm-red, so this design **pulls rather than pushes**: it makes the reader's next real win concrete and near. It never darkens, scolds or counts down at them, and it never comments on their behaviour.

## Decisions (owner)

- **A, everywhere in the app: "the next milestone, etched in the glass."** The lungs name the reader's next health recovery milestone, measured from their last logged cigarette, for example "Carbon monoxide back to normal — in 6 h".
  - When a milestone is reached, one slow teal light passes once through the airways.
  - After a cigarette nothing darkens. The line simply names the nearest milestone again, which is always close: the first one is 20 minutes away.
- **B, Home only: "where the money goes."**
  - **What it shows.** A glass jar beside the lungs fills with money not spent against the reader's baseline. A grain of teal light drops in when a day comes in under their usual.
  - **No ceiling.** **No target**: it just fills (owner's choice).
  - **Never empties.** It only fills or holds; a heavy day adds nothing.

## Goals

- **A.** Use `milestoneProgress(lastSmokeIso)` from `src/domain/health.ts`, the same source as the dashboard's `HealthMilestones` (`web/components/ui/HealthMilestones.tsx`).
  - **Line format.** It shows `next.label` plus `formatMinutesUntil(minutesToNext)`, with a quiet caption: "Next, from your last entry".
  - **The light passing through.** It plays when `current` changes while the page is open, or on the first load after a milestone was crossed since the last visit. Keep the last seen milestone id in `sessionStorage`. It plays once and never repeats in a loop.
- **B.** Use `savedAllTime(rows, baselinePerDay, fallbackUnitPrice, sinceYmd, endYmd)` from `src/domain/periodSummary.ts`. It adds `max(0, baseline − sticks)` per day, so it never decreases as days pass. Its window start is `max(onboardedAt, 365 days ago)`, which is the same wiring the dashboard uses.
  - **Fill level.** Since there is no target, the fill level is a soft log curve of the total, `fill = 1 − e^(−total / k)`, with `k` scaled to one week of the reader's baseline spend. That way the jar visibly moves early and keeps creeping later without ever reaching full. Amended at final review: the exponential read as full after about three weeks; the hyperbola `fill = total / (total + k)` keeps the early motion and the long creep.
  - **Label.** "Kept: ₹2,340" in the reader's currency, using the existing money formatter, with locale from the country.
  - **The falling grain.** When the latest day's spend is under baseline, a grain drops in, once per load.

## Non-goals

- No new goal type, setting, table or migration.
- No change to the signed-out pages (landing, auth): there is no ledger to read there.
- No sound, badges, confetti, counters, streak shaming or "you lost progress" state.
- No change to the haze-clearing behaviour shipped in `feat/scene-lungs`.

## Anti-goals (failure even if it works)

- Any state that reads as regression, judgement or a countdown at the reader. The scene never gets darker after a cigarette.
- **A figure visible when discreet mode or hide-totals says it shouldn't be:**
  - Discreet mode means neutral haze only: no milestone line, no jar.
  - `hideTotalsOnHome` (the existing `isHomeTotalsHidden`) means the jar stays but the figure is replaced by the existing masked form.
  - Mask at the render site, on every channel: visible text, `aria-label`, `title`.
- Milestone or money text that screen readers announce twice, or that steals focus. The scene is decorative.

## Constraints

- **Text is DOM, not WebGL.**
  - **Where it sits.** The milestone line and the jar label are an absolutely positioned overlay, `aria-hidden`, placed beside the lungs. That keeps the text crisp, token-styled and themeable, and keeps contrast checkable.
  - **What they reuse.** The milestone line uses `--accent-ink` (teal text, AA in both themes) for the label and `--text-faint` for the caption. The jar label uses `--text-muted`.
  - **Contrast.** Both must measure ≥ 4.5:1 against the veiled background in both themes, at 1440 and 390.
- **The jar is geometry.** It is a glass `LatheGeometry` or a rounded cylinder in the scene, in the same glass language as the lungs. The fill is a second mesh scaled on y, tinted `--accent` at low opacity. Light theme follows the same rules as the lungs: no bloom, and lower opacity.
- **Data path** (revised after the builder check; these are my calls).
  - **A's last log, from the server.** `SceneForReader` (`web/components/marketing/SceneForReader.tsx`) already awaits `getServerProfile()`. It also reads the reader's **latest log time with one small query** (`ts_utc` only, newest first, `limit 1`, no date window). Add it as a cached loader in `web/lib/server/data.ts`. Unlike the dashboard's 60-day `lastLog(logs)`, it shows a long-time quitter their real milestone. It passes `lastSmokeIso` (or `null`) through `SceneBackdrop` to the scene.
  - **B's figure, from the dashboard.** The jar data comes from the dashboard, which already computes savings and masks it for hide-totals and discreet mode, with no server read.
    - A tiny client store (`web/components/marketing/scene/sceneSignals.ts`: a module-level subscribable value, no new dependency) carries it. `DashboardClient` publishes `{ fill, label, underBaselineYesterday, lastSmokeIso }` on render, and clears it on unmount.
    - `label` is the dashboard's **already-masked** money string. With hide-totals on it is the existing `maskInr` form; with discreet mode on the dashboard publishes nothing. So the raw figure never reaches the scene.
    - The scene subscribes. The jar exists only while that store holds a value, which makes it Home-only by construction, and it updates straight after a quick log.
    - A `lastSmokeIso` published by the dashboard overrides the server's, so A refreshes after a quick log too.
  - **Failure.** The two halves fail independently and quietly. With no latest log there is no milestone line. With no published jar data there is no jar. Nothing ever throws.
- **Free tier.** One extra tiny query per full load (A), and zero extra queries for B. Navigations inside the app don't re-run the layout. No per-frame allocations, matching the existing haze code.
- **Keeping A current** (my call). A client tick, once a minute while the tab is visible, recomputes `milestoneProgress` so the countdown and the light passing through stay accurate. The page isn't refreshed.
- **Motion.** Slow and gravitational. The light passing through runs about 2.4 s with an ease-in-out and no spring. Under reduced motion nothing animates: the line and jar show static, and the scene itself already renders nothing then.
- **Tests (TDD).**
  - **Pure helpers:** milestone line selection, the fill curve, the light-passing trigger, and the falling-grain trigger.
  - **Source guards:** discreet removes the line and jar, hide-totals masks the figure, the jar only on `/dashboard`, and text overlays are `aria-hidden`.
  - **Runtime:** a `SceneForReader` test covering both a failed read and a successful one.

## Calls I made after the builder check (owner can overrule)

- **Never-logged readers get no milestone line.** `milestoneProgress(null)` would otherwise claim "20 minutes", which is false for someone who has never logged.
- **The grain judges yesterday,** a closed day, against baseline, not today's partial day. It drops at most once per day per session (a `sessionStorage` key with the date). With no or zero baseline there's no grain.
- **`k` for the fill curve** is `7 × max(baselinePerDay, 1) × unitPrice`, using the fallback unit price when needed, so it's never 0.
- **Masking happens upstream.** The overlay is `aria-hidden`, so its only channel is the visible text. That text is the dashboard's already-masked string, and no raw figure ever reaches the scene.
- **Each half fails on its own.** A missing log hides only A; missing jar data hides only B.

## Left to the builder

- Exact jar shape and position. It sits clear of the dashboard's headline and quick-log controls; check at 1440 and 390.
- Overlay placement relative to the lungs at each layout breakpoint (`scene/layout.ts`).
- The value of `k` within "one week of baseline spend" if the baseline is missing; then use the fallback unit price × 7 × the app's default baseline.

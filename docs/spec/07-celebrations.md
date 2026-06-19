---
section: celebrations
sources:
  - src/domain/age.ts
  - src/lib/character/**
  - web/lib/character/**
  - src/components/character/**
  - web/components/character/**
  - app/(tabs)/index.tsx
  - web/app/(app)/dashboard/**
last_verified_commit: d7a8d67
status: current
---

# Celebrations

## Purpose

When something good happens — the user hits a smoke-free streak milestone or opens the app on their birthday — the app pauses and marks the moment. The celebration system is deliberately small: a modal, a stick figure with its arms raised, a brief paper-fleck burst, and copy that speaks plainly to what the user achieved. The goal is acknowledgement without spectacle.

## What the user experiences

On the dashboard, two kinds of moments trigger a celebration.

**Birthday.** On the calendar day matching the user's date of birth, a modal appears automatically (once per session). It shows the applauding figure, a confetti burst, the headline "Happy Birthday!", and the body "A special day for a special journey. Here is to another year of breathing easier." The character in the masthead simultaneously switches to the `applaud` mood with a "Happy Birthday!" caption for about 3.4 seconds.

**Streak milestone.** When the user's consecutive smoke-free-day streak ticks up and crosses one of the five tier values (1, 3, 7, 14, 30), a modal appears with tier-specific editorial copy. The `Day N` label appears in the modal header. The masthead character applauds with the caption "N-day streak." for 3.4 seconds.

In both cases the modal is a semi-transparent overlay. It auto-dismisses after 5.2 seconds. The user can dismiss earlier by tapping anywhere outside the card, tapping "Carry on", or — on web — pressing Escape. The figure shown in the modal is always the `applaud` mood regardless of milestone type.

If the device has "Reduce Motion" enabled, the confetti burst in the masthead `CharacterCompanion` is suppressed entirely. The figure's idle bob animation also freezes. The celebration modal itself still appears and still renders the figure — only the moving flecks are gated.

## How it works

The system is built around a tiny in-process event bus (`DeviceEventEmitter` on mobile, `window.dispatchEvent` / `window.addEventListener` on web). Nothing goes over the network; nothing is persisted. Three components mount once at the app root and react to bus events.

### The event bus — `src/lib/character/mood.ts`

Three named events are defined:

- `character:mood` — drives the masthead companion's transient mood state.
- `character:milestone` — opens the celebration modal.
- `character:farewell` — opens the logout overlay (not related to celebrations).

`MilestoneEventDetail` (`mood.ts:35–44`) carries `type` (`'streak' | 'birthday'`), `days` (an integer; `0` for birthdays), `title`, and an optional `body`. `dispatchMilestone` (`mood.ts:55–57`) emits the event. `milestoneForStreak` (`mood.ts:86–89`) maps a streak integer to its tier detail, returning `null` for non-tier values so the caller can skip non-milestone days. It injects `type: 'streak'` onto the returned object (`return tier ? { ...tier, type: 'streak' as const } : null`) — the `MILESTONE_TIERS` entries themselves omit `type`, so the factory is the single place that stamps it. This matters because every downstream `d.type === 'streak'` check (the masthead caption and the modal `Day N` header) depends on it; before this was fixed, streak milestones arrived with `type === undefined` and fell through to the birthday branch.

The five streak tiers live in `MILESTONE_TIERS` (`mood.ts:78–84`):

| days | title | body (excerpt) |
|------|-------|----------------|
| 1 | One day, quieter. | The first day under your baseline is the hardest… |
| 3 | Three days, quieter. | A small rhythm is forming… |
| 7 | Seven days, quieter. | A full week under your baseline… |
| 14 | Two weeks, quieter. | Fourteen days. Your body has already started… |
| 30 | A month, quieter. | Thirty days. This is no longer a streak — it is a habit. |

### Birthday detection — `src/domain/age.ts`

`isBirthdayToday(dobIso, today)` (`age.ts:44–60`) compares local month and day against the user's stored ISO date of birth. It has one special case: people born on February 29 get their birthday on March 1 in non-leap years. The function takes an injected `today` parameter so it is easily testable without touching system time.

### Dispatch sites

**Mobile (`app/(tabs)/index.tsx`).**

The birthday effect runs after the profile loads (`index.tsx:426–439`). A `birthdayFiredRef` ref prevents it from firing more than once per session. When `isBirthdayToday` returns true, `dispatchMilestone` is called with `type: 'birthday'`, `days: 0`, and the hardcoded title/body strings.

The streak effect (`index.tsx:441–455`) stores the previous streak value in `prevStreakRef`. It only calls `milestoneForStreak` and dispatches when `streak > prev` — so the milestone never fires on first load or when a streak drops. On first render, `prevStreakRef` is set to the current value and the effect returns early (`index.tsx:447–449`).

**Web (`web/app/(app)/dashboard/DashboardClient.tsx`).** The same two effects exist at `DashboardClient.tsx:131–158`, with identical logic and identical milestone copy. The web version uses `React.useRef` and `React.useEffect` rather than bare `useRef`/`useEffect`, and the birthday event shape is the same object (`type: 'birthday'`, `days: 0`, same title, same body).

### The modal — `src/components/character/MilestoneCelebration.tsx`

`MilestoneCelebration` mounts once at the app root (`app/_layout.tsx:187`). It subscribes to `character:milestone` events via `onMilestone` (`MilestoneCelebration.tsx:34`). When an event arrives it:

1. Stores the detail in `useState`.
2. Opens the `Modal`.
3. Calls `dispatchMood('applaud', { caption: ..., durationMs: 3400 })` to animate the masthead character in parallel (`MilestoneCelebration.tsx:39`).
4. Sets a 5.2-second auto-dismiss timer (`MilestoneCelebration.tsx:41`).

The modal header shows "Milestone" (always) and the `Day N` label only when `detail.type === 'streak'` (`MilestoneCelebration.tsx:90`). For birthdays, that slot is empty. The `seed` passed to `ConfettiBurst` is `detail.days` (`MilestoneCelebration.tsx:96`), which is `0` for birthdays — both produce a burst, but the distribution is re-randomised on each event arrival because `seed` changes between streak milestones.

### The masthead companion — `src/components/character/CharacterCompanion.tsx`

`CharacterCompanion` subscribes to `character:mood` events. When it receives an `applaud` mood (dispatched by `MilestoneCelebration` as a side-effect of any milestone), it shows the `applaud` figure variant, sets the caption, and optionally fires its own `ConfettiBurst` — but only when `!reduce` (`CharacterCompanion.tsx:62`). After `durationMs`, it resets to `greet`.

### The figure — `src/components/character/Figure.tsx`

`Figure` is a pure SVG stick figure with 8 mood variants. The `applaud` mood raises both arms, widens the smile (`Figure.tsx:98`), and renders small ink/accent fleck rectangles above the head (`Figure.tsx:78–87`). The figure itself has a 3.6-second idle bob driven by Reanimated; when `useReduceMotion()` returns true, the bob value is set to 0 and the animation loop does not start (`Figure.tsx:39–42`).

### ConfettiBurst — `src/components/character/ConfettiBurst.tsx`

`ConfettiBurst` renders 14 thin rectangles (2×6–10 px) in the app's editorial palette: `accent` (teal), `ink` (foreground text colour), and `warn` (terracotta). Each fleck drifts outward and downward over 1.4 seconds using a Reanimated `withTiming` on a shared value, with individual delays up to 300 ms staggered by `Math.random()`. Opacity goes from 1 to 0 as `t` moves 0→1. The component is `pointerEvents="none"` and `accessibilityElementsHidden`, so it has no effect on touch or screen reader navigation. When `active` is false the component returns null immediately — no DOM/layout cost.

The `seed` prop acts purely as a memoisation key. Changing `seed` regenerates the random distribution (`ConfettiBurst.tsx:57`). The distribution is not deterministic between rerenders — only stable for the lifetime of one burst.

### Reduce-motion — `src/hooks/useReduceMotion.ts`

`useReduceMotion` wraps `AccessibilityInfo.isReduceMotionEnabled()` and `AccessibilityInfo.addEventListener('reduceMotionChanged', ...)` (`useReduceMotion.ts:9–14`). It starts false (motion allowed) and updates live if the OS setting changes during the session. The hook is consumed in two places: `CharacterCompanion` to gate the confetti burst (`CharacterCompanion.tsx:39,62`), and `Figure` to gate the idle bob (`Figure.tsx:35,39`).

## Invariants

- A birthday celebration fires at most once per session, regardless of how many times the dashboard re-renders. The `birthdayFiredRef` guard ensures this.
- A streak milestone fires only when the streak increases into a tier value — never on page load, never when the streak decreases. The `prevStreakRef` pattern and the `streak > prev` condition enforce this.
- `MilestoneCelebration` mounts exactly once, at the root layout (`app/_layout.tsx:187`). A second instance would subscribe to the same event and open a second modal.
- The `ConfettiBurst` in `CharacterCompanion` is suppressed when `useReduceMotion()` is true. The figure's idle bob is also suppressed. The celebration modal itself is not suppressed — it still appears; only animated decorations are removed.
- The `Figure` in the celebration modal is always `mood="applaud"` regardless of whether the event is a birthday or a streak milestone (`MilestoneCelebration.tsx:97`).
- Birthday dispatch passes `days: 0`. The `Day N` label in the modal header only renders for `type === 'streak'`, so birthday modals correctly show no day counter.

## Edge cases & gotchas

**Feb 29 birthdays.** `isBirthdayToday` triggers on March 1 in non-leap years. This matches the conservative approach used for the age gate. See `age.ts:51–58`.

**Birthday and streak on the same day.** Nothing prevents both effects from firing on the same render. The dashboard runs them in two separate `useEffect` calls. In practice this means two `dispatchMilestone` calls in quick succession. The second will overwrite the first's `detail` state in `MilestoneCelebration`, so only one modal is visible at a time. The first milestone is effectively lost. This scenario is uncommon (a user would need to hit their birthday and cross a streak tier simultaneously), but it is unhandled.

**Session restart on the same birthday.** The `birthdayFiredRef` is a React ref, not persisted storage. If the user closes and reopens the app on their birthday, the celebration fires again. This is intentional — there is no mechanism to suppress it across sessions.

**`days: 0` seed for birthday confetti.** Because birthdays always pass `seed=0` to `ConfettiBurst`, every birthday celebration produces the same random seed for the distribution memoisation. Since `Math.random()` is called at memo-creation time the distribution will vary across sessions, but within one mount cycle with `seed=0` it is always the same fleck layout. This is cosmetically fine.

**Web differences.** The web `MilestoneCelebration` renders via `createPortal` to `document.body` and uses `window.addEventListener` / `window.dispatchEvent`. It adds an Escape-key listener when open (`web/components/character/MilestoneCelebration.tsx:58–65`). The mobile version uses a React Native `Modal` with `onRequestClose` for the Android back button. Functionally equivalent.

**Confetti in the modal vs. the masthead.** The celebration modal renders its own `ConfettiBurst` at `MilestoneCelebration.tsx:96`. The masthead `CharacterCompanion` separately renders its own burst when it receives the `applaud` mood — but only when reduce-motion is off. The modal's confetti is not gated by reduce-motion; the masthead's is. This asymmetry is not intentional but matches the current code.

## Tests

`src/tests/age.test.ts` — the `isBirthdayToday` describe block covers: match on month+day (`age.test.ts:51–54`), non-match on differing month or day (`age.test.ts:56–59`), malformed/impossible dates (`age.test.ts:62–64`), and the Feb 29 / non-leap-year case (`age.test.ts:67–75`). This is the only automated test coverage for the celebrations system. There are no unit tests for `MilestoneCelebration`, `CharacterCompanion`, `ConfettiBurst`, `Figure`, or the dispatch/milestone logic in `mood.ts`.

## Open gaps

~~**Bug: birthday modal shows "0-day streak." caption in the masthead.**~~ **Fixed in commit `d69f9ad`.** The mobile `MilestoneCelebration.tsx:39` previously dispatched the masthead mood with a hardcoded streak caption for all milestone types. The fix added a conditional: `caption: d.type === 'streak' ? \`${d.days}-day streak.\` : 'Happy Birthday!'`. The web version already had the correct conditional.

~~**Bug: streak milestone shows "Happy Birthday!" caption.**~~ **Fixed in commit `4b286c1`.** The mirror of the bug above: with the caption conditional in place, *streak* events were dispatched via `milestoneForStreak`, whose returned objects omitted `type`. So `d.type === 'streak'` was `false` and every streak tier wrongly produced "Happy Birthday!" in the masthead and hid the `Day N` modal header. The fix injects `type: 'streak'` in `milestoneForStreak` on both platforms. Both birthday and streak captions now render correctly end-to-end.

**No reduce-motion gate on the modal's own confetti.** `CharacterCompanion` checks `useReduceMotion()` before firing `ConfettiBurst`. `MilestoneCelebration` does not — its `ConfettiBurst` at line 96 is always rendered when the modal is open. Users with reduce-motion enabled still see the in-modal burst.

**No test coverage for dispatch logic.** `milestoneForStreak`, `dispatchMilestone`, the `prevStreakRef` guard, and the birthday gate are untested. A unit test that asserts `milestoneForStreak(7)` returns the correct tier and that non-tier values return `null` would catch regressions without needing a component harness.

**No cross-session birthday deduplication.** The `birthdayFiredRef` only persists for the lifetime of the React tree. A user who backgrounded and reforegrounded the app on their birthday would see the modal again. If this is undesirable, a dated flag in `SecureStore` (or Supabase) would be needed.

**Birthday and simultaneous streak milestone.** If both events fire in the same render, the second `dispatchMilestone` overwrites the first's modal state. The earlier celebration is silently lost.

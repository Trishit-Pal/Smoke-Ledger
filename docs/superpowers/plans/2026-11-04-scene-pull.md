# Scene Pull: Next Milestone and Money Kept, Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the ambient lungs scene pull toward quitting: on every app page the glass names the reader's next recovery milestone, and on Home a glass jar fills with the money kept.

**Architecture:** Pure helpers (`scene/pull.ts`) decide the line, the fill and the one-off moments. The server adds one tiny cached read, the latest log time, through `SceneForReader`. Home publishes its already-masked savings to a tiny client store (`scene/sceneSignals.ts`) that the scene subscribes to. Text is a DOM overlay (`aria-hidden`) beside the canvas. The jar is glass geometry in the existing scene.

**Tech Stack:** Next.js 15 App Router (server and client components), three.js (lazy), TypeScript, vitest (`web/`), the shared domain in `src/`.

**Spec:** `docs/superpowers/specs/2026-11-04-scene-pull-design.md` (owner-approved 2026-11-04). It builds on `docs/superpowers/plans/2026-11-04-scene-lungs.md`.

**Branch:** `feat/scene-pull`, cut from GitHub `main` (fetch by URL) **after the scene-lungs PR merges**.

## Global Constraints

- **Pull, never push.** No state reads as regression, judgement or a countdown at the reader, and the scene never darkens after a cigarette. No badges, confetti, counters, sound or "you lost progress".
- **Discreet mode:** neutral haze only, with no milestone line and no jar.
- **Hide-totals:** the jar stays and its label is the dashboard's existing masked string (`maskInr(value, true, …)` → `•••`). No raw money figure ever reaches the scene or its overlay.
- **Text is DOM, `aria-hidden`.** The milestone label uses `--accent-ink`; the caption uses `--text-faint`; the jar label uses `--text-muted`. Each must be ≥ 4.5:1 against the veiled background in both themes at 1440 and 390.
- **Motion is slow and gravitational, never spring.** The airway light runs about 2.4 s, ease-in-out, once. Under reduced motion nothing animates and text shows statically. The scene already renders nothing then.
- **Free tier:** at most one extra tiny query per full load, for A. Zero queries for B. No per-frame allocations.
- **No new dependency, setting, table or migration.** Colours come from CSS tokens only, enforced by the existing `COLOUR_LITERAL` guard. Dispose everything you create.
- **Process:**
  - TDD.
  - Regex/backslash code via Edit/Write only.
  - Web vitest from `web/` (`npx vitest run <path>`).
  - Conventional commits ending `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
  - Never `git add -A`. Leave `Images/` alone.

## Review Focus

- **All milestones reached:** a reader smoke-free past the last milestone sees `${current.body} — reached`, never a blank line or a crash. Pinned in Task 1.
- **A future `lastSmokeIso` (clock skew):** `minutesSince` clamps to 0, so the line names the first milestone and nothing throws. Pinned in Task 1.
- **Discreet mode toggled on while on Home:** Settings saves and calls `router.refresh()`, the dashboard publishes `null`, and the jar and line disappear without a reload. Pinned in Task 2 (publisher) and Task 4 (overlay reads discreet).
- **Hide-totals on:** the published label is masked, and no digits of the figure appear in the published signal. Pinned in Task 2.
- **Theme flip while the jar is shown:** the jar's materials resync through the existing `MutationObserver` path, and the overlay uses CSS tokens. Pinned in Task 5.

---

### Task 1: Pure pull helpers

**Files:**
- Create: `web/components/marketing/scene/pull.ts`
- Test: `web/__tests__/scenePull.test.ts`

**Interfaces:**
- Consumes:
  - `milestoneProgress(lastSmokeIso, now?)` and `formatMinutesUntil(mins)` from `@/domain/health`;
  - `HealthMilestone { minutes, title, body }` from `@/constants/milestones`;
  - `DailySummaryRow` from `@/domain/periodSummary`;
  - `dayShift` from `@/domain/calc`.
- Produces:
  - `milestoneLine(lastSmokeIso: string | null, now: Date): { text: string; caption: string; milestoneMinutes: number | null } | null`
  - `sweepDue(storage: MinimalStorage, milestoneMinutes: number | null): boolean`
  - `jarFill(totalMoney: number, baselinePerDay: number, unitPrice: number): number`
  - `underBaselineYesterday(rows: DailySummaryRow[], baselinePerDay: number, todayYmd: string): boolean`
  - `grainDue(storage: MinimalStorage, underBaseline: boolean, todayYmd: string): boolean`
  - `type MinimalStorage = { getItem(k: string): string | null; setItem(k: string, v: string): void }`

- [ ] **Step 1: Write the failing tests** (`scenePull.test.ts`):
  - `milestoneLine(null, now)` returns `null`.
  - The first milestone 10 minutes after the last log: `text` equals `` `${HEALTH_MILESTONES[0].body} — ${formatMinutesUntil(10)}` `` and `caption` equals `'Next, from your last entry'`. `milestoneMinutes` is `null` because nothing has been reached yet.
  - Past the last milestone: `text` ends with `' — reached'`, uses the last milestone's `body`, and `milestoneMinutes` is the last milestone's `minutes`.
  - A future `lastSmokeIso` names the first milestone and does not throw.
  - `sweepDue`:
    - with no stored value, it returns `false` and stores the minutes under `scene-milestone-seen`;
    - with a stored value that differs, it returns `true` and updates the store;
    - with the same value, it returns `false`;
    - a throwing storage returns `false`.
  - `jarFill`:
    - `0` gives `0`;
    - it rises monotonically and is always `< 1`;
    - it equals `1 − e^(−total / (7 × max(baseline, 1) × max(unitPrice, 1)))` within 1e-9;
    - it is finite when the baseline and price are 0.
  - `underBaselineYesterday`:
    - `true` when yesterday's row has `sticks < baseline` and `baseline > 0`;
    - `false` when the baseline is 0 or null-like;
    - `true` when yesterday has no row (a smoke-free day);
    - today's row never counts.
  - `grainDue`:
    - `true` at most once per `todayYmd` per storage (key `scene-grain-day`);
    - `false` when `underBaseline` is false;
    - a throwing storage returns `false`.
- [ ] **Step 2: Run** `cd web && npx vitest run __tests__/scenePull.test.ts`. Expected: FAIL (module not found).
- [ ] **Step 3: Implement the helpers** in `scene/pull.ts`, pure, with no three.js and no DOM. Use the copy exactly as follows:
  - `' — '` (spaced em dash) between body and time;
  - `'reached'` for the all-reached state;
  - `'Next, from your last entry'` as the caption.
- [ ] **Step 4: Run the tests again.** Expected: PASS.
- [ ] **Step 5: Commit** `feat(scene): pure helpers for the milestone line and the money jar`.

### Task 2: Home signals store and dashboard publisher

**Files:**
- Create: `web/components/marketing/scene/sceneSignals.ts`
- Modify: `web/app/(app)/dashboard/DashboardClient.tsx`, near the `allTimeSaved` and `last` memos (~L176-212)
- Test: `web/__tests__/sceneSignals.test.ts`

**Interfaces:**
- Consumes: `jarFill`, `underBaselineYesterday` (Task 1).
- Produces:
  - `type HomeSignals = { fill: number; label: string; underBaselineYesterday: boolean; lastSmokeIso: string | null }`
  - `publishHomeSignals(s: HomeSignals | null): void`
  - `subscribeHomeSignals(fn: (s: HomeSignals | null) => void): () => void`
  - `getHomeSignals(): HomeSignals | null`

- [ ] **Step 1: Write the failing tests:**
  - Store: `publish` notifies subscribers; `unsubscribe` stops notifications; `get` returns the last value; `publish(null)` clears it.
  - Source guards on `DashboardClient.tsx`:
    - it calls `publishHomeSignals` inside an effect, with a cleanup that calls `publishHomeSignals(null)`;
    - under `isDiscreetMode(profile)` it publishes `null`;
    - the `label` passed is built with `maskInr(allTimeSaved.totalInr, hidden, …)`, the existing `hidden = isHomeTotalsHidden(profile)`, not with a raw `money(` call;
    - `fill` comes from `jarFill(allTimeSaved.totalInr, baseline, fallbackUnit)`;
    - `lastSmokeIso` comes from `last?.tsUtc ?? null`.
- [ ] **Step 2: Run** `cd web && npx vitest run __tests__/sceneSignals.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement the store** as a module-level value plus a `Set` of listeners, with no React and no dependency.
- [ ] **Step 4: Add the publishing effect** in `DashboardClient`. Its dependencies are the memoised values. Format with the existing `money` helper inside `maskInr`.
- [ ] **Step 5: Run the tests and typecheck:** `npx vitest run __tests__/sceneSignals.test.ts` and `npm run typecheck`. Expected: PASS.
- [ ] **Step 6: Commit** `feat(scene): Home publishes its masked savings to the scene`.

### Task 3: Latest-log loader and scene props

**Files:**
- Modify:
  - `web/lib/server/data.ts`: add a loader beside `getServerLogs`;
  - `web/components/marketing/SceneForReader.tsx`;
  - `web/components/marketing/SceneBackdrop.tsx`;
  - `web/components/marketing/SceneBackground.tsx`: props only.
- Test: `web/__tests__/sceneForReader.test.ts` (extend the existing runtime test), `web/__tests__/sceneDiscreetWiring.test.ts`

**Interfaces:**
- Produces:
  - `getServerLatestLogIso = cache(async (): Promise<string | null>)`. It selects `ts_utc` from `cigarette_logs` for the signed-in user, ordered newest first, `limit(1)`, and returns `null` on any error.
  - `SceneBackdrop` and `SceneBackground` accept `lastSmokeIso?: string | null`, defaulting to `null`.

- [ ] **Step 1: Write the failing tests.** Extend `sceneForReader.test.ts` with mocks for `getServerProfile` and `getServerLatestLogIso`:
  - a resolved ISO is passed as `lastSmokeIso`;
  - a rejected latest-log read gives `lastSmokeIso: null` while `discreet` still follows the profile;
  - a discreet reader gets `discreet: true`. The ISO may pass, because the scene ignores it under discreet.
  - A source guard checks that `SceneBackdrop` forwards `lastSmokeIso`.
- [ ] **Step 2: Run** `cd web && npx vitest run __tests__/sceneForReader.test.ts __tests__/sceneDiscreetWiring.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement the loader** using the same server client and user-id helper as its neighbours. Then await both reads in `SceneForReader` with `Promise.all`, each with its own `.catch`. The profile read still fails closed to `discreet = true`; the log read falls back to `null`.
- [ ] **Step 4: Run the tests, typecheck and lint.** Expected: PASS.
- [ ] **Step 5: Commit** `feat(scene): the scene learns the reader's last log time`.

### Task 4: Milestone overlay and airway light

**Files:**
- Create: `web/components/marketing/scene/MilestoneOverlay.tsx` (client)
- Modify:
  - `web/components/marketing/SceneBackground.tsx`: mount the overlay, add the airway light;
  - `web/components/marketing/scene/lungMeshes.ts`: expose an airway emissive or opacity handle;
  - `web/components/marketing/scene/layout.ts`: overlay anchor per breakpoint.
- Test: `web/__tests__/sceneMilestoneOverlay.test.ts`

**Interfaces:**
- Consumes:
  - `milestoneLine` and `sweepDue` (Task 1);
  - `subscribeHomeSignals` and `getHomeSignals` (Task 2): a published `lastSmokeIso` overrides the prop;
  - the `lastSmokeIso` prop (Task 3).
- Produces: `startAirwayLight(): void` on the lungs handle. It runs about 2.4 s ease-in-out once, and is a no-op while already running or under reduced motion.

- [ ] **Step 1: Write the failing tests.** Source guards and pure checks:
  - the overlay root is `aria-hidden` and `pointer-events: none`;
  - it renders nothing when `discreet` or when `milestoneLine(...)` is `null`;
  - it uses `var(--accent-ink)` for the text and `var(--text-faint)` for the caption, with no colour literals;
  - it re-computes on a once-a-minute timer only while `document.visibilityState === 'visible'`, and clears the interval on unmount;
  - it calls `startAirwayLight` only when `sweepDue(sessionStorage, …)` is true;
  - under `prefers-reduced-motion` there is no `startAirwayLight` call.
- [ ] **Step 2: Run** `cd web && npx vitest run __tests__/sceneMilestoneOverlay.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.**
  - **Overlay:** sits in the scene's fixed layer, anchored from `layout.ts` (desktop under the lungs, right-aligned; narrow viewports centred below them). Its type matches the editorial voice: a Fraunces italic label and a small DM Sans caption.
  - **Airway light:** animates the airway material's emissive intensity up and back.
  - **Allocation:** nothing per frame.
- [ ] **Step 4: Run the tests, the full `npx vitest run`, typecheck and lint.** Expected: PASS.
- [ ] **Step 5: Do one screenshot pass and measure contrast.** Dev server on port 4319 with placeholder env; render the overlay with a fixed `lastSmokeIso` through a test page or prop. Cover 1440 and 390, light and dark. Record the contrast ratios against the composited background; all must be ≥ 4.5.
- [ ] **Step 6: Commit** `feat(scene): the glass names the next recovery milestone`.

### Task 5: The money jar on Home

**Files:**
- Create: `web/components/marketing/scene/jarMesh.ts`
- Modify:
  - `web/components/marketing/SceneBackground.tsx`: subscribe, build the jar, dispose it;
  - `web/components/marketing/scene/MilestoneOverlay.tsx`, or a sibling `JarLabel.tsx`, for the label;
  - `web/components/marketing/scene/layout.ts`: jar anchor.
- Test: `web/__tests__/sceneJar.test.ts`

**Interfaces:**
- Consumes: `subscribeHomeSignals` and `getHomeSignals` (Task 2); `grainDue` (Task 1).
- Produces: `buildJar(THREE, tokens, bin): { group; setFill(f: number): void; dropGrain(): void; retheme(tokens): void }`.

- [ ] **Step 1: Write the failing tests:**
  - **When the jar exists:** only while `getHomeSignals()` is non-null. Subscribing adds it and `null` removes it.
  - **Fill:** `setFill` clamps to [0, 1] and only scales the fill mesh on y.
  - **Grain:** `dropGrain` runs once per `grainDue` true, and never under reduced motion.
  - **Discreet:** no jar is ever built when `discreet`.
  - **Label:** reads `Kept: ${signals.label}` in `var(--text-muted)`, `aria-hidden`.
  - **Disposal:** the jar's geometries and materials go through the dispose bin.
  - **Tokens:** `retheme` re-reads the tokens, and the existing `COLOUR_LITERAL` guard passes over `jarMesh.ts`.
- [ ] **Step 2: Run** `cd web && npx vitest run __tests__/sceneJar.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.**
  - **Shape:** a `LatheGeometry` glass jar in the lungs' glass language, following the light-theme rules: no bloom, low opacity.
  - **Fill:** an inner fill mesh tinted `--accent` at low opacity.
  - **Placement:** left of the lungs on desktop, clear of the dashboard headline and quick-log controls. On narrow viewports it's hidden, a ruling recorded in the ledger: there's no room beside a centred, dim scene on a phone.
- [ ] **Step 4: Run the tests, the full suite, typecheck and lint.** Expected: PASS.
- [ ] **Step 5: Do one screenshot pass** of `/dashboard` with a stubbed signal at 1440, light and dark, and record the jar-label contrast.
- [ ] **Step 6: Commit** `feat(scene): Home's glass jar fills with the money kept`.

### Task 6: Docs, review, PR (controller)

- [ ] **DESIGN.md:** extend the "Ambient scene" bullet. The milestone line is on app pages and the jar on Home only. Discreet mode shows neither; hide-totals masks the label. The airway light plays once.
- [ ] **Spec:** run `node scripts/spec/affected.mjs <github-main-sha>`, then `spec-update` for any named section.
- [ ] **Detector:** run `impeccable detect --json` once on the changed files.
- [ ] **Review:** a final whole-branch review on opus, then one fix wave and one scoped re-review.
- [ ] **Ship:** push by URL, open a PR into `main`, watch CI until `responsive-e2e` is green. The owner merges.

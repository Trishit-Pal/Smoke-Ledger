# Ambient scene: lungs that clear, with a terracotta no-smoking sign

Approved plan (owner, 2026-11-04). The source is `C:\Users\trish\.claude\plans\functional-roaming-blum.md`, with the same decisions, restated here with task headings for subagent-driven development. Execution runs in three batches with owner feedback between them: Tasks 0–1, then 2–3, then 4.

## Context

The fixed WebGL backdrop in `web/components/marketing/SceneBackground.tsx` (455 lines, three.js) is abstract today: glass shards, a wireframe knot and particle haze. The owner wants the background to show the product's subject: health imagery, drawn as **translucent 3D lungs that breathe slowly while a grey haze inside them thins** (recovery, not damage), plus a **no-smoking sign in terracotta** (`--warn-earth`, never red). It runs **everywhere** at today's two strengths: `full` on the landing and auth pages, `quiet` on app pages. It is built **custom in the existing three.js component**.

## Global Constraints

- **Reference images only.** The `Images/` folder holds watermarked stock, so it is reference only. Nothing from it ships, the scene is drawn in code, and `Images/` stays untracked. Never `git add -A` or `git add .`.
- **Brand.** PRODUCT.md applies: calm, no guilt, never alarm-red; terracotta marks concern and teal marks positive moments. Motion is slow and gravitational, with no spring or bounce. Every animation has a `prefers-reduced-motion` fallback; the scene renders nothing then, as today.
- **Keep the existing machinery:**
  - three.js loaded lazily inside the mount effect, in a separate async chunk;
  - `pickSceneTier` / `SCENE_BUDGET` (`web/lib/sceneTier.ts`);
  - idle pause after 20 s, and pause while the tab is hidden;
  - no WebGL means nothing renders;
  - colours read from CSS custom properties, never hex literals in the scene;
  - live theme resync;
  - canvas `aria-hidden` and `pointer-events: none`;
  - every geometry, material, texture, pass and the renderer disposed on unmount.
- **Discreet mode is first-class.** With discreet mode on, the scene shows only a neutral haze: no lungs and no sign.
- **No new dependencies.** TDD first. Write regex or backslash code with Edit/Write, never shell heredocs. Run web vitest from `web/` (`npx vitest run <path>`).
- **Commits** use conventional prefixes (`feat:`, `test:`, `docs:`) and end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Design

- **Lungs (both strengths).**
  - Two procedural lobes, each a displaced `SphereGeometry`: an elongated dome with a narrow apex, a flattened medial face, a broad concave base, a cardiac notch on the left, and a faint fissure groove.
  - A recursive bronchial tree of tapering `TubeGeometry` along Catmull-Rom curves: the trachea, then 3–4 levels into each lobe.
  - Material: `MeshPhysicalMaterial` transmission glass, reusing the existing env-map bake. Ink-neutral tint from `--text-muted`, with a faint `--accent` rim on the airways.
  - Placement: biased right and back on desktop so centred content stays clear. Centred and dim on phones.
- **Breathing.**
  - The lobes scale 1 ± 0.04 on a sine period of about 5.5 s (about 11 breaths a minute), with no spring.
  - Bloom lifts slightly on the inhale, at full strength only.
- **Haze that clears.**
  - Grey `Points`, rejection-sampled inside the lobe volumes. On each exhale they drift up the airways and out, fading as they go.
  - Overall density follows `haze(t) = floor + (1 − floor)·e^(−t/τ)`, with τ ≈ 40 s and floor ≈ 0.08.
  - The start time is kept in `sessionStorage`, so a reload or new page in the same session never brings the haze back.
- **Sign (full strength only).**
  - A torus ring plus a 45° bar, in satin `--warn-earth` at about 0.5 opacity.
  - Set back and upper left, turning slowly on the y-axis, and kept below the bloom threshold.
- **Quiet strength.** Lungs and haze only: dimmer, no bloom, fewer particles. The page veil stays unchanged.
- **Discreet mode.**
  - The `(app)` layout reads the discreet flag through the cached server profile loader (`web/lib/server/data.ts`) and passes `discreet` to `SceneBackdrop`.
  - When set: neutral haze only.
  - Public and auth pages carry no flag.
- **Themes.**
  - At build, read `--warn-earth`, `--accent`, `--text-muted` and `--bg`, and resync all of them on a theme flip.
  - Light theme uses darker ink edges, so the lungs read against `#F6F7F9`.

### Task 0 — Branch, plan copy, workspace (controller)

Create `feat/scene-lungs` from GitHub `main` (fetch by URL), commit this plan copy, and seed the SDD ledger.

### Task 1 — Pure scene helpers and budget (sonnet)

- **New, pure, no three.js runtime import.** Type-only imports are allowed, and geometry may take a `THREE` namespace parameter.
  - `web/components/marketing/scene/breath.ts`:
    - `breathPhase(tSeconds)`: a value in −1..1 on a sine with `BREATH_PERIOD_S = 5.5`.
    - `breathScale(tSeconds)`: `1 + BREATH_AMPLITUDE * breathPhase`, with `BREATH_AMPLITUDE = 0.04`.
    - `hazeDensity(elapsedSeconds)`: `HAZE_FLOOR + (1 − HAZE_FLOOR)·exp(−elapsed / HAZE_TAU_S)`, with `HAZE_FLOOR = 0.08` and `HAZE_TAU_S = 40`, clamped to [HAZE_FLOOR, 1].
    - `sceneClearStart(storage, now)`: returns the stored start time, or writes `now` under key `scene-clear-start` and returns it. Tolerates an unavailable or throwing storage by returning `now`. A malformed or future stored value is replaced with `now`.
  - `web/components/marketing/scene/lungs.ts`:
    - `lobeRadiusAt(side, u, v)` or an equivalent displacement function. `side` is `'left' | 'right'`, and the left lobe has the cardiac notch.
    - `insideLobe(side, x, y, z)`: true inside the lobe's displaced volume, in the lobe's local space.
    - `bronchialTree(depth)`: returns an array of branch descriptors `{ points: [x,y,z][], radius }` (trachea first), where the branch count is `1 + 2 * (2^depth − 1)`, giving two sides each a binary tree, and radii taper as depth grows. Keep it deterministic: no `Math.random` (a seeded PRNG is fine).
  - `web/components/marketing/scene/sign.ts`:
    - `signParts()`: ring `{ radius, tube }` and bar `{ length, thickness, angleRad: Math.PI / 4 }` dimensions only, with no colours.
- **`web/lib/sceneTier.ts`.** Replace the `shards` budget field with `hazeParticles`, `bronchiDepth` and `lobeSegments`:
  - standard: `{ dprCap: 2, hazeParticles: 420, bronchiDepth: 4, lobeSegments: 64, bloom: true, parallax: true, frameIntervalMs: 0 }`
  - lite: `{ dprCap: 1, hazeParticles: 140, bronchiDepth: 3, lobeSegments: 40, bloom: false, parallax: false, frameIntervalMs: 33 }`
- **Tests (vitest, `web/__tests__/`), written first:**
  - `sceneBreath.test.ts`:
    - the period holds (`breathPhase(0) ≈ breathPhase(5.5)`);
    - scale bounds are [0.96, 1.04];
    - `hazeDensity(0) = 1`, it is monotonically non-increasing, and it approaches `HAZE_FLOOR` without going below it;
    - `sceneClearStart`: first call writes and returns `now`; a later call returns the stored value; a throwing storage returns `now`; a garbage or future value is replaced.
  - `sceneLungs.test.ts`:
    - the centre is inside, a far point is outside;
    - the left lobe's notch region is outside where the right lobe's mirror point is inside;
    - the branch count matches the formula for depth 3 and 4;
    - radii are strictly decreasing from trachea to leaves;
    - the result is deterministic across calls.
  - `sceneSign.test.ts`: the bar angle is π/4, and `sign.ts` source contains no `#` hex or `rgb(` colour literal.
  - Update `web/__tests__/sceneTier.test.ts` for the new fields.
- **Do not modify `SceneBackground.tsx` yet.** If removing `shards` breaks its typecheck, keep a temporary `shards` alias, or have SceneBackground read the new field for its count. The goal is that web typecheck stays green at the end of this task. Note what you did in the report.

### Task 2 — Rebuild SceneBackground (sonnet, loads impeccable + DESIGN.md)

- Rebuild `web/components/marketing/SceneBackground.tsx` on the Task 1 helpers:
  - remove the glass shards, knot and old particles;
  - add the lungs (two lobes and the bronchial tree), breathing, the clearing haze (session start time), the terracotta sign at full strength only, and the quiet strength;
  - add a `discreet?: boolean` prop: neutral haze only, no lobes, airways or sign;
  - resync every token on a theme flip.
- Keep every item in Global Constraints "Keep the existing machinery". Keep the file under 400 lines, moving builders into `scene/*.ts` where they are not pure.
- Source-guard tests in `web/__tests__/sceneBackground.test.ts`:
  - no hex or `rgb(` colour literals in `SceneBackground.tsx` or `scene/*.ts` (the existing fallback strings for `readVar` may stay if they are the only literals; name them in the test);
  - the sign is created only when `intensity === 'full'` and not discreet;
  - `discreet` skips the lobes and airways;
  - `prefers-reduced-motion` and the no-WebGL early return are still present;
  - a dispose call exists for every created geometry and material kind.

### Task 3 — Discreet wiring (sonnet)

- `web/components/marketing/SceneBackdrop.tsx`: accept and forward `discreet?: boolean`.
- `web/app/(app)/layout.tsx`: read the reader's discreet flag on the server through the cached profile loader in `web/lib/server/data.ts` (find the cached `getProfile` or an equivalent; use `isDiscreetMode` from `src/lib/discreet.ts`), and pass `discreet` to `<SceneBackdrop intensity="quiet" />`. A failed or absent profile means `discreet = false`. Never throw from the layout.
- Test, a source or unit check in `web/__tests__/`: the layout passes `discreet` from `isDiscreetMode(...)`, and SceneBackdrop forwards it.

### Task 4 — Docs, visual pass, final review, PR (controller)

- **Docs.** Add a DESIGN.md Motion/Materials paragraph, "Ambient scene", then run `spec-update`.
- **One bounded visual pass:**
  - a dev server with placeholder Supabase env;
  - Playwright screenshots at desktop 1440×900 and mobile 390, in dark and light themes, of `/` and `/login`;
  - a reduced-motion check: no canvas.
- **Detector.** Run `impeccable detect --json` once on the changed files.
- **Review and fix.** A final branch review (opus), then one fix pass.
- **Ship.** Push by URL, open a PR into `main`, and watch CI until `responsive-e2e` is green. The owner merges.

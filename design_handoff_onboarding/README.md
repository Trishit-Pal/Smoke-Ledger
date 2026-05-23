# Handoff: Smoke Ledger — Onboarding Redesign

## Overview

A premium-feeling, editorial onboarding flow for **Smoke Ledger**. Five interactive steps (Welcome → Privacy → Baseline → Goal → Brands) plus a closing "Done" beat and a static dashboard preview. The flow leans into the existing **quiet editorial** aesthetic already piloted in the Dashboard revamp: DM Sans body, Fraunces display, teal `#2FA39B` accent, hairline rules, paper-noise textures, and honest copy that avoids streaks/badges.

## About the Design Files

The files in this bundle are **design references created in HTML** — a single-file React + Babel prototype that demonstrates the intended look and behavior. **They are not production code to copy directly.**

Your job is to **recreate these designs inside the existing `web/` Next.js codebase**, using its established patterns:
- Server components / client components ("use client" only where needed)
- Existing UI primitives in `web/components/ui/` (Button, Card, Chip, Input, Text)
- Existing CSS variables and Tailwind tokens in `web/app/globals.css` + `web/tailwind.config.ts`
- The repository functions already wired up at `app/onboarding/*/page.tsx` (saveComplianceConsents, createGoal, setOnboardingStep, listBrands, toggleFavorite, etc.)

The current onboarding routes (`/onboarding/privacy`, `/onboarding/usage`, `/onboarding/goal`, `/onboarding/brands`) **stay** — this is a visual + interaction redesign of those pages, plus the addition of a new `/onboarding` landing (Welcome) and a new `/onboarding/done` summary step.

## Fidelity

**High-fidelity (hifi).** Pixel values, exact tokens, motion timings, and easing curves are specified. Match them. Use the codebase's existing primitives where possible — extend them rather than introducing new style systems.

## Target Routes & Mapping

| Step | Prototype label | Target route | Existing file | Notes |
|------|----------------|--------------|---------------|-------|
| 00 | Welcome | `/onboarding` (new beat) | `app/onboarding/page.tsx` (currently redirects) | Replace redirect with a Welcome screen. Keep middleware behavior intact (push to `/onboarding/privacy` on "Begin"). |
| 01 | Privacy | `/onboarding/privacy` | `app/onboarding/privacy/page.tsx` | Same business logic — only the visual layer changes. Keep all consent saves, audit events, and `setOnboardingStep('usage')`. |
| 02 | Baseline | `/onboarding/usage` | `app/onboarding/usage/page.tsx` | Same business logic. Keep `updateProfile`, `setSetting`, `setOnboardingStep('goal')`. |
| 03 | Goal | `/onboarding/goal` | `app/onboarding/goal/page.tsx` | Same business logic. Keep `createGoal` + `setOnboardingStep('brands')`. |
| 04 | Brands | `/onboarding/brands` | `app/onboarding/brands/page.tsx` | Same business logic. Keep `listBrands`, `toggleFavorite`, finalize via `updateProfile({ onboardedAt })`. |
| 05 | Done | `/onboarding/done` (new) | `app/onboarding/done/page.tsx` (new) | New summary screen between brands and `/dashboard`. Reads from profile + goals + brands; calls `setOnboardingStep('done')` and `router.replace('/dashboard')` on the CTA. |

> The existing `/onboarding/baseline` and `/onboarding/setup` redirect stubs can stay or be removed — they don't appear in the new flow.

## Layout System

Two layout variants are exposed as a Tweak in the prototype. **Ship the Editorial variant** as the default; treat Traditional as a fallback we may want later. Both are documented for completeness.

### Editorial layout (default — ship this)
- Two-column inside the page shell: **left rail (280 px fixed)** with masthead + numbered step list, **right main content** with the form.
- Rail is `border-right: 1px solid var(--rule)`, padded `32px 28px`, background `var(--bg)`.
- Step list uses a Roman-numeral-style numeric label (00, 01, 02…), small-caps step name, and a 1-px-rule between rows.
- Masthead carries the `Wordmark`, `Vol. I · Onboarding` caption, and the new **theme toggle** (see below).
- Editor's-note pull-quote pinned to bottom of rail.

### Traditional layout (alternative)
- Top bar with step pips connected by hairline rules. Use only if a future surface needs it.

## In-design Theme Toggle (NEW)

A small inline light/dark mode switch lives in the rail masthead (Editorial) and the top bar (Traditional). When the user is on the Done step, surface it as a floating control top-right of the content area.

Implementation in the codebase:
- Reuse the existing `useTheme` hook (`web/hooks/useTheme.ts`) and `ThemeToggle` component (`web/components/layout/ThemeToggle.tsx`).
- Visually, match the prototype's sliding-pill toggle (64×32 px pill with sun + moon glyphs, accent-colored thumb in light, off-white thumb on `var(--ink-surface)` in dark, 320 ms cubic-bezier(0.34, 1.56, 0.64, 1) spring).
- The toggle must flip the `dark` class on `<html>` (already what `useTheme` does).

## Screens

### 00 — Welcome (`/onboarding`)

- **Masthead caption** `An honest tracker · Established 2026` (uppercase, 11 px, letter-spacing 0.18em, `var(--text-muted)`)
- **Headline** (Fraunces, `editorial-headline` utility — exists in globals.css): three lines, `clamp(40px, 5.5vw, 64px)`. Last line `Quit on your terms.` in italic `var(--accent)`.
- **Decorative background watermark** `№.01` — Fraunces italic, 360 px, color `var(--rule)`, opacity 0.5, top -40 right -80. Animates with `driftSlow` keyframe.
- **Begin CTA** — 56 px high, 28 px padding, `var(--accent)` background, white text, big drop shadow `0 12px 32px -8px rgba(47,163,155,0.45)`. Active state: `translateY(2px) scale(0.98)`. To the right of it, mono small-caption `↵ ENTER`.
- **3-column pillar row**: three Tilt cards (Free / Private / Honest). Each card:
  - background `var(--bg-elevated)`, border `1px solid var(--rule)`, radius 10
  - opening label is a Fraunces italic Roman numeral I./II./III. at 32 px in `var(--accent)`
  - title 14 px / 600, body 12 px `var(--text-muted)`
  - entry animation `pillarRise` 700 ms, staggered 80 ms each, with a `perspective(900px) rotateY(-22deg) translateZ(-40px)` start
  - cursor tilt: max 8°, lift 10 px, with subtle glare overlay
- **Keyboard**: Enter or → advances to Privacy.

### 01 — Privacy (`/onboarding/privacy`)

- **Caption** `Step 01 · Before we start`
- **Headline** `The honest fine print.`
- **Subhead** `Smoke Ledger is cessation support software — not medical treatment or emergency care.`
- **Five required consents** + one optional analytics row, each a `<label>` with:
  - 18×18 custom checkbox (`ed-checkbox` — accent fill + white ✓ on check)
  - main consent copy 14 px
  - optional sub copy 12 px `var(--text-faint)`
  - **stamp slot on the right** (min-width 78 px): when checked, a `Stamp` reading **"Acknowledged"** appears
    - bordered teal pill, 1.5 px solid accent, 3 px outer pad, double-line inset shadow, Fraunces italic 10/600, letter-spacing 0.22em
    - landing animation: starts at `scale(1.8) rotate(-30deg)`, ends `scale(1) rotate(-6deg ± 2)`, transition 320 ms `cubic-bezier(0.34, 1.56, 0.64, 1)`
  - 2-digit `01`-style index on the far right
- **Stamp-all link**: small italic Fraunces "stamp all" at the footer. On click, it walks through each consent and toggles it on with a **130 ms cascade**. Disables to "all acknowledged" once everything is on.
- **Footer**: ← Back, "N / 6 acknowledged" caption, Continue → (disabled until all five required are on).
- **Wire-up**: keep the existing `saveComplianceConsents`, `setSetting`, `recordAuditEvent('consent_accepted')`, `invalidateAnalyticsConsentCache`, and `setOnboardingStep('usage')` calls. Don't change the audit payload or version strings.

### 02 — Baseline (`/onboarding/usage`)

- **Caption** `Step 02 · The baseline`
- **Headline** `About how many a day?`
- **Big editorial figure pair** in a 2-column grid bordered top + bottom by hairline rules:
  - Left: caption `Sticks per day`, then the numeral itself — `editorial-numeral` utility at `clamp(72px, 11vw, 128px)` — wrapped in a **`DigitRoll`** odometer (each digit is a 0–9 vertical strip translated to the right number; transition `transform 720 ms cubic-bezier(0.16, 1, 0.3, 1)`, stagger 35 ms per index).
  - Right: caption `That's about`, Fraunces 22 px `₹<DigitRoll>` / day, and a smaller `≈ ₹X a year · at ₹18/stick` line. Yearly is computed as `n × 18 × 365`.
- **−** / range / **+** row. Range slider uses the existing `brand-range` thumb. Buttons are 36 px circles, hover swaps border + text to accent.
- **40-tick chart** below the slider:
  - 1-row grid of 40 cells, gap 3 px, max-height 32 px
  - Each tick filled is 14 px tall (24 px on every 5th — milestone)
  - Background: vertical gradient `var(--accent)` → `color-mix(in oklab, var(--accent) 70%, white)`
  - 3D depth: each filled tick gets `translateZ(${i * 0.6}px)` inside a `perspective: 400` container — sticks "lean out" toward the viewer as the count rises
  - Wave-in: `transitionDelay: ${i * 8}ms` and back-spring cubic
- **Compare progress over**: 7-day vs 30-day, full-width 2-card row (selected: accent border + accent-soft fill, label in accent).
- **How do you usually buy?**: three Chips — singles / packs / mix.
- **Footer**: ← Back, Continue → (disabled until pref chosen).
- **Wire-up**: keep existing `setSetting('onboarding.typicalDaily', n)`, `setSetting('onboarding.purchasePref', pref)`, `updateProfile({ baselinePerDay, baselineWindowDays })`, `setOnboardingStep('goal')`.

### 03 — Goal (`/onboarding/goal`)

- **Caption** `Step 03 · A small goal`
- **Headline** `Pick one small goal.`
- **2×2 grid of TiltCards** for the four goal types — daily_cap, spend_cap_daily, reduction_target, no_smoke_window. Each card:
  - background `var(--bg-elevated)`, border `1px solid var(--rule)`, radius 14, min-height 150 px, padding 22 px
  - Roman numeral I./II./III./IV. in italic Fraunces 28 px, `var(--text-faint)` when unselected, `var(--accent)` + scale 1.15 + `translateZ(20px)` when selected
  - Label 16/600, hint 13 `var(--text-muted)`, example italic 12 `var(--text-faint)` pushed to bottom
  - Selected indicator: 16 px circle, accent fill, white ✓; spring-scales to 1.1
  - **Tilt behaviour**: unselected max 9°, lift 12 px; selected max 4°, lift 18 px (intentionally calmer when chosen). Cursor glare overlay on.
- **Target input panel** (appears after a card is picked, fade-in):
  - 22 px padding, hairline border, radius 12
  - caption row `Target` left, italic Fraunces type name right
  - input is an editable number sized at 56 px Fraunces, with a 40 px Fraunces prefix (e.g. `₹` for spend cap) and a 14 px unit caption on the right
- **Footer**: ← Back, **Skip for now**, Continue →
- **Wire-up**: keep existing `createGoal({ type, targetValue })`, analytics `track(AnalyticsEvents.GOAL_CREATED, { type })`, `setOnboardingStep('brands')`. Skip behavior: just `setOnboardingStep('brands')` and route forward.

### 04 — Brands (`/onboarding/brands`)

- **Caption** `Step 04 · Favorites`
- **Headline** `Pick a few brands for one-tap logging.`
- **Search input** (44 px, hairline border that switches to accent on focus) with a small SVG search glyph left-adornment and an inline "clear" button when query is non-empty.
- **Category chips** row: All / Budget / Regular / Premium / Imported.
- **Brand table** — vertical list bordered top (strong rule) + bottom (regular rule), max-height 280 px, scrollable. Each row:
  - 5-col grid: index `01` | brand name | stamp slot | category caption | toggle pill
  - Selected row: `var(--accent-soft)` background, name 600
  - On toggle: a `Stamp` reading **"Favorite"** appears in the stamp slot using the same animation as Privacy stamps. The Stamp's React `key` is set to the toggle timestamp so it re-animates on every flip.
  - Toggle pill: 24 px circle, accent fill + white ✓ when selected; otherwise hairline border + faint `+`
- **Selected pile** (only when count > 0): caption uses **`<DigitRoll value={count} />` selected**. Pills below — `chipPopIn` animation 320 ms back-spring, 40 ms stagger, hover lifts 2 px with a brighter teal glow shadow.
- **Footer**: ← Back, **Finish setup →** (disabled until at least one favorite)
- **Data source**: use the existing `listBrands()` repository call. The prototype's static `BRAND_DB` is just a placeholder. The toggle on each row maps to `toggleFavorite(brand.id)` exactly as in the current code.
- **Wire-up on finish**: keep the existing `updateProfile({ onboardedAt })`, `setSetting('consent.onboardingCompletedAt')`, `setOnboardingStep('done')`, `recordAuditEvent('onboarding_completed')`, session refresh. **Then route to `/onboarding/done`** (the new screen) instead of straight to `/dashboard`.

### 05 — Done (`/onboarding/done` — new)

- **Caption** `The ledger is open · {full date in en-IN long format}`
- **Headline** `You're set up.` / italic accent `One stick at a time.`
- **The Receipt** — the centrepiece. A reproducible CSS construction:
  - Container: `var(--bg-elevated)`, hairline border, radius 4 (note: less rounded than other cards — feels like cut paper)
  - **Print-in animation** — on mount the receipt is `clip-path: inset(0 0 100% 0)` and transitions to `inset(0 0 0 0)` over **1100 ms cubic-bezier(0.16, 1, 0.3, 1)**. The drop shadow fades in simultaneously over 600 ms.
  - **Torn-paper top + bottom edges** — an absolutely-positioned SVG with 28 alternating teeth filled in `var(--bg)`, so the edges look perforated against the page.
  - **Paper-noise overlay** — the existing `.paper-noise` utility, full bleed inside the receipt.
  - **Wax seal** top-right, position absolute `top: -28; right: 24` — a circular SVG with a teal outer ring, dashed inner ring, "SMOKE · LEDGER · 2026 · " text on a circular `<textPath>`, and a Fraunces italic "SL" mark at centre. Lands at **600 ms delay** with a `scale(1.6) rotate(40deg) → scale(1) rotate(-8deg)` spring.
  - **Body rows**, each a 120 px / 1fr summary row:
    - Baseline — `<DigitRoll>` of sticks/day + comparison window + buy pref summary
    - Goal — type label + target rolled in + units
    - Favorites — count + first 4 brand names joined with " · "
    - At this rate — annual ₹ in Fraunces 24, accent-coloured
  - DigitRolls are delay-staggered: 400 / 500 / 700 / 900 / 1100 ms so figures land row by row.
- **Pull-quote** below — Fraunces italic, "Awareness is the first move. Nothing to prove today — just observe, log, learn."
- **CTAs**: primary **"Open the dashboard →"** (52 px, accent, deep shadow, hover lifts 2 px with brighter glow). Secondary ghost **"Restart tour"** — exists only in the prototype for QA; you can omit in production or keep gated behind dev mode.
- **Floating theme toggle** — top-right of the content area, 92 px from top, 28 px from right.
- **Wire-up**: read from session/profile/goals/brands repositories. The "Open the dashboard" CTA does `router.replace('/dashboard')`.

## Design Tokens

All tokens are already defined in `web/app/globals.css`. **Do not introduce new tokens** — reuse these:

### Colors (light)
| Token | Value |
|-------|-------|
| `--bg` | `#F6F7F9` |
| `--bg-elevated` | `#FFFFFF` |
| `--card` | `#FFFFFF` |
| `--border` | `#E1E5EB` |
| `--text` | `#0B0F14` |
| `--text-muted` | `#5A6673` |
| `--text-faint` | `#A9B3BF` |
| `--accent` | `#2FA39B` |
| `--accent-soft` | `#E4F3F1` |
| `--rule` | `#D6DBE2` |
| `--rule-strong` | `#B9C1CC` |
| `--warn-earth` | `#B86A4A` |
| `--warn-earth-soft` | `#F2E4DD` |
| `--ink-surface` | `#14191F` |
| `--ink-surface-text` | `#E6EAEF` |

(Dark mode values live in the `.dark { … }` block of `globals.css` — already correct.)

### Typography
| Family | Variable | Use |
|--------|----------|-----|
| DM Sans | `--font-sans` | All body, captions, buttons |
| Fraunces | `--font-display` | Headlines, big numerals, italic accents |

Existing utility classes to reuse verbatim: `editorial-numeral`, `editorial-numeral--small`, `editorial-headline`, `editorial-caption`, `nums-tabular`, `rule-hair`, `paper-noise`, `ink-panel`, `editorial-stage`, `rule-draw`.

### Spacing
Use the Tailwind tokens `xs (4) sm (8) md (12) lg (16) xl (24) xxl (32) xxxl (48)` (already in `tailwind.config.ts`).

### Radii
`sm 6 / md 10 / lg 14 / xl 20 / pill 999` — already in Tailwind config. The receipt uses radius 4 — keep that as a one-off inline value.

## Motion & Easing

All keyframes used by the prototype that aren't already in `globals.css`:

| Keyframe | Where | Definition |
|----------|-------|------------|
| `pillarRise` | Welcome pillar cards | `from { opacity: 0; transform: perspective(900px) rotateY(-22deg) translateZ(-40px) translateY(20px); } to { opacity: 1; transform: none; }` |
| `chipPopIn` | Selected brand chips | 0% scale(0.6) ty(8) → 60% scale(1.08) → 100% scale(1) |
| `driftSlow` | Welcome background watermark | gentle 18 s loop, ±8 px, ±0.5° |

Standard easings used:
- **Gravitational ease-out** (page rises, digit rolls, print-in): `cubic-bezier(0.16, 1, 0.3, 1)`
- **Back-spring** (chip pop, stamp land, ticked-circle pop, seal): `cubic-bezier(0.34, 1.56, 0.64, 1)`

**Reduced-motion**: respect `prefers-reduced-motion: reduce` everywhere — the existing global rule short-circuits `.editorial-stage > *`, `.rule-draw`, fade utilities. The new components must add equivalent short-circuits (the `useReduceMotion` hook in the prototype's `fx.jsx` shows the pattern).

## Components to add

Build these as `web/components/onboarding/` (new folder), then consume from the page files:

- `<DigitRoll value={…} />` — odometer number. Each digit is a `0–9` vertical strip translated by digit-em.
- `<TiltCard max lift glare>` — cursor-following 3D tilt with optional glare radial gradient.
- `<Stamp show color rotate>` — rubber-stamp impression with back-spring landing.
- `<SealCircle size label show>` — circular wax-seal SVG with text-on-path ring.
- `<PaperEdge side="top|bottom" color>` — torn-paper SVG mask.
- `<PageTurn stepKey direction>` — `rotateX` page-turn transition. Wrap the active step inside it.
- `<ThemeToggle>` — sliding-pill light/dark toggle. **Prefer extending the existing `web/components/layout/ThemeToggle.tsx`** rather than introducing a new one — the visual style here is the target spec for that component.

## State Management

No new client state stores. Use the existing pattern:
- Each step is its own `'use client'` page that holds local form state with `useState`
- Persistence calls go to the existing repositories under `db/repositories/*`
- Cross-step state survives because each step writes to the profile / settings / goals / brands tables before navigating

## Files in this bundle

| File | What it is | How to use |
|------|------------|------------|
| `Smoke Ledger Onboarding.html` | Entry — sets up theme tokens, fonts, mounts React | Open in a browser to run the prototype. **Reference only.** |
| `onboarding-app.jsx` | Shell — browser frame, layouts, theme toggle, state machine, tweaks panel | Reference for layout structure + how the theme toggle is mounted in each layout |
| `onboarding-steps.jsx` | All 6 step components + atoms (Button, Chip, Caption, Hairline, Field, TextInput) | Reference for per-step layout, exact copy, motion |
| `fx.jsx` | DigitRoll, TiltCard, Stamp, SealCircle, PaperEdge, PageTurn, useReduceMotion, useCountUp | Port each into `web/components/onboarding/` as TypeScript React components |
| `browser-window.jsx` | Browser frame chrome — prototype-only | **Do not port.** |
| `tweaks-panel.jsx` | In-design tweaks panel — prototype-only | **Do not port.** |

## QA Checklist

- [ ] All five Privacy consents stamp in correctly; "stamp all" cascades at 130 ms
- [ ] DigitRoll renders correctly with commas and the `₹` prefix
- [ ] TiltCards on Welcome and Goal screens tilt smoothly and lift on hover
- [ ] Selected Goal card calms its tilt and pops its Roman numeral
- [ ] Brand row stamps re-trigger their animation on each toggle (use timestamp as React key)
- [ ] Receipt print-in clip-path animates exactly 1100 ms
- [ ] Wax seal lands at 600 ms delay with a back-spring rotation
- [ ] DigitRolls in the receipt stagger correctly (400/500/700/900/1100 ms)
- [ ] In-design theme toggle flips `dark` class on `<html>` and swaps the existing `globals.css` palette
- [ ] `prefers-reduced-motion` disables every animation
- [ ] All existing repository / audit calls remain intact — onboarding completion still writes `onboardedAt`, `setOnboardingStep('done')`, and records the `onboarding_completed` audit event
- [ ] Middleware redirects still behave correctly: unauth → `/login`, auth-not-onboarded → `/onboarding/privacy` (or `/onboarding` if you wire the Welcome route as default)

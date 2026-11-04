# Design

## Theme

Editorial "ink on paper" — a printed-journal aesthetic rendered for screen. Default theme
is **dark**; light is a first-class alternate (class-based, `next-themes`, system disabled).
The surface reads as a quiet publication: Fraunces display serif over DM Sans body, hairline
rules doing layout work, small-caps section captions, and a faint paper-noise atmosphere
behind mastheads. Color strategy is **restrained** — tinted near-neutral surfaces with a
single teal accent and a terracotta "concern" tone; chrome is minimal and typography carries
the hierarchy.

## Color

Semantic tokens are CSS variables that swap by theme (`.dark`). All pairings verified for
WCAG AA in both themes. Mobile (`src/constants/theme.ts`) and web share the same
`text-faint` values (light `#64707D`, dark `#7D8896`), both ≥ 4.5:1 on bg/card/elevated; mobile is pinned by
`src/tests/themeContrast.test.ts`, web by `web/__tests__/tokenContrast.test.ts`.

### Light
- `--bg` `#F6F7F9` (cool near-white) · `--bg-elevated` / `--card` `#FFFFFF`
- `--text` `#0B0F14` · `--text-muted` `#5A6673` · `--text-faint` `#64707D`
- `--border` `#E1E5EB` · `--rule` `#D6DBE2` · `--rule-strong` `#B9C1CC`
- `--accent` `#2FA39B` (teal) — reserved for genuinely positive states; ≤10% of surface
- `--warn-earth` `#B86A4A` (terracotta) — concern / up-trend, **not** alarm-red
- `--ink-surface` `#14191F` + `--ink-soft` `#F2E9DD` — inversion slots for contrast sections

Text never uses `--accent`; teal text uses `--accent-ink` (AA in both themes), pinned by `web/__tests__/accentTextGuard.test.ts`. On the inverted ink panel, teal text uses `--ink-surface-accent`.

### Dark (default)
- `--bg` `#0B0F14` · `--bg-elevated` `#11161D` · `--card` `#1A2029`
- `--text` `#E6EAEF` · `--text-muted` `#A9B3BF` · `--text-faint` `#7D8896`
- `--rule` `#2A333F` · `--rule-strong` `#3A4452`
- `--accent` `#2FA39B` · `--warn-earth` `#D08267` (lightened for the dark surface)

### Data-viz
Six theme-aware series (teal, terracotta, blue, violet, amber, green). Ticks darker than
`--text-muted` for axis legibility; gridlines soft.

## Typography

- **Display:** Fraunces (variable serif) — `--font-display`, via `next/font`. Numerals,
  headlines, pullquotes. Tuned per role with `font-variation-settings` (`opsz`, `SOFT`, `WONK`).
- **Body / UI:** DM Sans — `--font-sans`. Tabular figures (`tnum`) on all ledger numbers.
- **Pairing axis:** serif display + sans body — a real contrast axis, not two similar sans.

### Roles
- `editorial-numeral` `clamp(4rem, 18vw, 11rem)` · `--small` `clamp(1.75, 5vw, 2.75rem)` ·
  `--micro` `clamp(1.125, 2.2vw, 1.375rem)`
- `editorial-headline` opsz 144, weight 360, ls −0.015em
- `editorial-pullquote` italic, opsz 24, `text-wrap: balance`
- `editorial-caption` — uppercase 11px, tracking 0.18em — the small-caps section label
- UI scale: display `clamp(28→34)` · h1 22 · h2 18 · h3 16 · body 15 · small 13 · caption 12

## Spacing & Radius

- Spacing: `xs` 4 · `sm` 8 · `md` 12 · `lg` 16 · `xl` 24 · `xxl` 32 · `xxxl` 48
- Radius: `sm` 6 · `md` 10 · `lg` 14 · `xl` 20 · `pill` 999

## Components / Primitives

- **SectionLabel** — `<h2 editorial-caption>` opening every section; optional hairline below.
- **MetricRow** — `grid [1fr_auto]` hairline ledger row: label + subtitle / `editorial-numeral`
  value, tone-colored (neutral / accent / warn / danger).
- **InlineRule** & `rule-hair[-strong]` — hairline dividers that do layout work; optional
  left-to-right `rule-draw` entrance.
- **ChoiceRun** — small-caps choices separated by middots, active = underline. The chip
  replacement (purchase mode, trigger, mood, context, backdate presets).
- **EditorialInput** — borderless input with a single hairline underline that strengthens on
  focus; tabular figures.
- **EditorialPillRow** — horizontally-scrolling hairline-outline pills (brand / variant pickers).
- **`.page-column`** — the one reading measure for every authenticated page: `max-w` 44 → 52 → 60rem
  at `md`/`lg`/`xl`, with the horizontal padding. Pages add their own vertical rhythm. Never
  re-type the widths inline.

## Motion

- **editorial-stage** — page-load choreography: each child rises (opacity + translate) on a
  staggered delay (`--ed-step` 90ms, `--ed-lead` 60ms), 720ms `cubic-bezier(0.16, 1, 0.3, 1)`
  — slow, gravitational, no spring, no bounce.
- **rule-draw** — left-to-right hairline fill, staggered by section index.
- **Reduced motion:** all reveals degrade to crossfade / instant under
  `prefers-reduced-motion: reduce`.
- **Materials:** transform / opacity primarily; paper-noise + `mix-blend-mode` for atmosphere.

## Accessibility

WCAG AA in both themes. `color-scheme` ties native controls (date / select popups, scrollbars)
to the app theme so they stay legible in dark mode. Focus-visible rings (accent, 2px, offset).
Touch targets ≥44px. Tabular figures keep ledger columns aligned. Discreet/masking modes never
drop below AA contrast.

**44px, two mechanisms, one rule.** `min-h-11 min-w-11` when the control may grow to fill its
target (text-link buttons, inputs, nav items). `.hit-target` when the visual must stay compact
(pills in a `ChoiceRun`, steppers, caption-sized source links): it grows only the tap area with an
invisible `::after`. Never put `.hit-target` on or beside a destructive control — the halo can
steal a tap meant for its neighbour, and the responsive e2e credits it as 44px without checking
overlap.

**Masking is applied at the render site.** `maskInr` / `maskCount` / `maskBrandName`
(`src/lib/discreet.ts`) are pure helpers; nothing masks at the data source. Every new place a
money amount or stick count is rendered — headline, chart axis, tooltip, matrix cell, model prose —
passes through them. A masked heading over an unmasked axis is a leak (Trends money and stick
counts, fixed 2026-11-01). The render site is every channel a reader or screen reader can reach,
not just the drawn pixels: the visually hidden `sr-only` chart data table, the chart's
`aria-label`, SVG `<title>` hover text, tooltips, visible bar values, and React keys. Charts take a
formatter prop and forward it to every channel the chart has (tooltip, sr table, and the
`aria-label`/`title` where present; Line/Bar are `aria-hidden`). Nothing changes with discreet off: the
hour-of-day chart keeps its hidden Y axis (`showYAxis={false}`), and the donut's tooltip and table show
compact money. Brand names under discreet mode become distinct
aliases by list position (`maskBrandAt` / `brandAlias`: "Brand A", "Brand B"…), never one shared
"Brand hidden" label, so rows stay readable and keys unique. The Home last-entry label drops the
variant under discreet (`lastEntryLabel`). A clock time ("busiest at 15:00") is a
pattern, not a count, and stays. The responsive e2e scans for currency, digits in sr-only table
cells and chart aria-labels, and a seeded brand name (CI only); `web/__tests__/chartMasking.test.ts`
pins each chart except the mood × trigger matrix.
`KpiCard` takes a pre-masked `value: ReactNode`; do not add a raw-number prop.

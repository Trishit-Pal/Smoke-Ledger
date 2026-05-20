# Smoke Ledger India — End-to-End Implementation Plan

_Drafted 2026-05-04. Scope: ship a polished, production-ready release of the existing Expo + Supabase app, with richer trends/insights, smoking-facts education, health-milestone gamification, and tasteful 4D-style motion._

---

## 1. Current state (audit summary)

**Stack.** Expo SDK 51 + Expo Router, Supabase (Postgres + Auth, RLS), Zustand, Zod, dayjs, react-native-svg, react-native-reanimated 3.10 (installed but **unused**).

**Architecture.**
- `app/` — routed screens: `(auth)/` login/signup/reset, `(tabs)/` Home/Log/Trends/History/Settings, `onboarding/` 7-step funnel, `log/new` modal.
- `src/domain/` — pure calculations: `calc.ts`, `savings.ts`, `goals.ts`, `insights.ts` (rules-based, explainable).
- `src/db/repositories/` — Supabase data access for logs, brands, profile, goals, settings.
- `src/store/` — `auth` (session) + `session` (hydrated cache: profile, last 120 d logs, brands, goals).
- `src/components/` — `ui/` primitives + `charts/` (BarChart, LineChart, Donut — static SVG).
- `supabase/migrations/20250426120000_initial_schema.sql` — 9 tables, full RLS, auth trigger that seeds 16 Indian brands per user.

**Strengths.** Clean separation of pure domain vs. data; strong RLS; tested calculations; calm UI palette; good privacy posture.

**Gaps.**
1. No animations anywhere despite Reanimated being a dep.
2. Static charts — no value transitions when window changes.
3. No educational layer (facts, milestones, "why this matters").
4. Tab glyphs (`◇ + ~ ≡ ⚙`) lack accessibility labels.
5. `quickLog`/`boot()` lack error UX (silent failure / infinite spinner).
6. No error boundary; one render error crashes the whole tab.
7. `price_entries` table exists but is unused — no price-history UI.
8. No mood/trigger correlation surfacing in the UI (the data is logged, never visualized).

---

## 2. Goals for this release

| Theme | Outcome |
| --- | --- |
| **Polish** | App feels alive — entrance motion, animated counters, chart reveals, haptic-coupled gestures. |
| **Insight** | Users see *why* their pattern matters: health milestones, fact carousel, mood↔trigger heatmap. |
| **Reliability** | No silent failures; error boundary; retryable boot. |
| **Accessibility** | Screen-reader labels on tabs; sufficient contrast; reduce-motion respected. |
| **Schema** | Additive migration introducing facts catalog, health milestones, mood-correlation view, price-history rollup. |

Non-goals: rewriting auth, swapping the chart library, adding ML, adding social/sharing.

---

## 3. Database schema — additions

New migration: `supabase/migrations/20260504000000_enhancements.sql` — **additive, no breaking changes**.

### 3.1 `smoke_seed.smoking_facts` (server-only catalog, no RLS exposure)

Curated facts with citations. Seeded once; client never writes to it.

```sql
CREATE TABLE smoke_seed.smoking_facts (
  id text PRIMARY KEY,
  category text NOT NULL,         -- 'health' | 'india' | 'finance' | 'recovery' | 'environment'
  headline text NOT NULL,
  body text NOT NULL,
  source text NOT NULL,           -- 'WHO 2024', 'ICMR', 'GATS-2 India', 'CDC', etc.
  source_url text,
  weight int NOT NULL DEFAULT 1   -- carousel sampling weight
);
```

Seed ~30 rows covering: WHO global mortality, GATS-2 India tobacco prevalence, average INR cost-of-habit math, lung-recovery timeline, environmental impact (cigarette butts = #1 ocean litter), passive-smoking risk.

### 3.2 `smoke_seed.health_milestones` (server-only catalog)

Time-since-last-cigarette → physiological recovery checkpoint. Used by client to render the milestones panel.

```sql
CREATE TABLE smoke_seed.health_milestones (
  minutes int PRIMARY KEY,
  title text NOT NULL,
  body text NOT NULL,
  source text NOT NULL
);
```

Seed: 20 min (BP/HR drop), 8 h (CO halves), 24 h (heart-attack risk drops), 48 h (taste/smell return), 72 h (bronchi relax), 2 wk (circulation), 1 mo (cilia regrow), 3 mo (lung function +30%), 1 y (CHD risk halved), 5 y (stroke risk → non-smoker), 10 y (lung-cancer risk halved). Sources: CDC, NHS, WHO.

### 3.3 `public.user_facts_seen` (per-user state, RLS-enforced)

Tracks which facts a user has viewed so the carousel rotates intelligently.

```sql
CREATE TABLE public.user_facts_seen (
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  fact_id text NOT NULL,
  seen_at timestamptz NOT NULL DEFAULT now(),
  liked boolean,
  PRIMARY KEY (user_id, fact_id)
);
```

Standard `user_id = auth.uid()` policy.

### 3.4 RPCs

```sql
get_random_facts(p_limit int)         -- weighted-random, deprioritizes already-seen
get_health_milestones()               -- returns full milestone catalog (cached client-side)
mark_fact_seen(p_fact_id text, p_liked boolean)
```

All `SECURITY DEFINER`, `GRANT EXECUTE ... TO authenticated`.

### 3.5 View: `public.v_mood_trigger_heatmap` (RLS via underlying `cigarette_logs`)

```sql
CREATE VIEW public.v_mood_trigger_heatmap AS
SELECT user_id, mood_before, trigger_tag, count(*) AS n,
       avg(unit_price_inr) AS avg_unit_price
FROM public.cigarette_logs
WHERE mood_before IS NOT NULL AND trigger_tag IS NOT NULL
GROUP BY user_id, mood_before, trigger_tag;
```

Inherits row visibility from base table; surfaces mood↔trigger pairs the user already logs.

### 3.6 Index for forecast/streak queries

```sql
CREATE INDEX idx_logs_user_ts ON public.cigarette_logs (user_id, ts_utc DESC);
```

(Existing `idx_logs_user_local_date` is by `local_date`, but streak/last-log queries need `ts_utc DESC`.)

---

## 4. Client additions

### 4.1 Domain layer

- `src/domain/health.ts` — `currentMilestone(lastSmokeAt, now)`, `nextMilestone(...)`, `progressToNext(...)`. Pure, unit-tested.
- `src/domain/correlations.ts` — `moodTriggerMatrix(logs)`, `topMoodTriggerPairs(logs, k)`.

### 4.2 Constants / data

- `src/constants/facts.ts` — typed fallback dataset (the same content seeded into `smoke_seed.smoking_facts`), so the app is fully usable offline before the migration runs.
- `src/constants/milestones.ts` — same for health milestones.

### 4.3 Repositories

- `src/db/repositories/facts.ts` — `getRandomFacts(n)`, `markFactSeen(id, liked?)`. Falls back to bundled dataset on network failure.

### 4.4 Animation primitives (Reanimated 3)

New file `src/components/anim/`:
- `AnimatedNumber.tsx` — counts from 0 → value with `withTiming`, eased out-cubic. Used in `StatTile`.
- `FadeSlideIn.tsx` — staggered enter (`entering={FadeInDown.delay(i * 60)}`) for cards on Home / Trends.
- `Pulse.tsx` — subtle 1.0 → 1.04 loop for the "Quick add" CTA when streak >= 1.
- `Tilt.tsx` — gesture-driven 3D tilt (rotateX/rotateY based on touch position) — the "4D" feel — applied to hero cards (Today's stat tile, Streak tile). Respects `AccessibilityInfo.isReduceMotionEnabled()`.
- `Reveal.tsx` — wraps charts; bars scale-Y from 0→1 over 600 ms on mount + on data change.

### 4.5 New UI components

- `src/components/ui/FactsCarousel.tsx` — horizontal pager (FlatList + snap) of fact cards with parallax title and citation footer; "Helpful?" thumbs marks `user_facts_seen`.
- `src/components/ui/HealthMilestones.tsx` — vertical timeline of milestones; current one highlighted with progress ring; future ones dimmed. Shows time-to-next.
- `src/components/charts/Heatmap.tsx` — 7×24 grid cells (DOW × hour) coloured by intensity for the Trends screen.
- `src/components/charts/MoodTriggerMatrix.tsx` — labelled grid surfacing top-3 mood↔trigger pairs.
- `src/components/ErrorBoundary.tsx` — catches render errors, shows recovery card + "Reload".

### 4.6 Screen wiring

- **Home (`app/(tabs)/index.tsx`)** — staggered entry; `AnimatedNumber` in StatTile; `FactsCarousel` (3 facts) below savings; `HealthMilestones` strip if `smokeFreeStreak >= 1`; `Tilt` on Today card.
- **Trends (`app/(tabs)/trends.tsx`)** — `Reveal` wrapping each chart; new Heatmap card; new MoodTriggerMatrix card; window-chip change cross-fades the chart values.
- **History** — list rows enter with `FadeInRight.delay(i * 25)`; swipe-to-reveal mood/notes (`react-native-gesture-handler`).
- **Onboarding** — page transitions get `SlideInRight` / `SlideOutLeft`; "Welcome" card breathes via `Pulse`.
- **Tabs `_layout.tsx`** — add `tabBarAccessibilityLabel` per route.

### 4.7 Quality fixes

- Wrap `<Tabs>` in `ErrorBoundary` (and onboarding stack).
- `app/_layout.tsx`: if `boot()` rejects → show "Couldn't sync" card + Retry button instead of indefinite spinner.
- `Home.quickLog`: try/catch → toast on failure, no silent loss.
- `useReduceMotion` hook gates non-essential animation.
- Tab glyphs: pair each with `tabBarAccessibilityLabel`.

---

## 5. File-by-file change list

| Path | Change |
| --- | --- |
| `supabase/migrations/20260504000000_enhancements.sql` | NEW — facts/milestones catalogs, `user_facts_seen`, view, RPCs, index. |
| `src/constants/facts.ts` | NEW — bundled fact dataset. |
| `src/constants/milestones.ts` | NEW — bundled milestone timeline. |
| `src/domain/health.ts` | NEW — milestone math + tests in `src/tests/health.test.ts`. |
| `src/domain/correlations.ts` | NEW — mood↔trigger aggregations + tests. |
| `src/db/repositories/facts.ts` | NEW — Supabase calls + offline fallback. |
| `src/components/anim/{AnimatedNumber,FadeSlideIn,Pulse,Tilt,Reveal}.tsx` | NEW. |
| `src/components/ui/FactsCarousel.tsx` | NEW. |
| `src/components/ui/HealthMilestones.tsx` | NEW. |
| `src/components/charts/{Heatmap,MoodTriggerMatrix}.tsx` | NEW. |
| `src/components/ErrorBoundary.tsx` | NEW. |
| `src/hooks/useReduceMotion.ts` | NEW. |
| `src/components/ui/StatTile.tsx` | swap value to `<AnimatedNumber>`; pass tone to ring color. |
| `src/components/charts/BarChart.tsx` | wrap bars in `Reveal` (scale-Y). |
| `app/(tabs)/index.tsx` | stagger + facts + milestones + tilt hero + try/catch quickLog. |
| `app/(tabs)/trends.tsx` | Reveal + Heatmap + MoodTriggerMatrix. |
| `app/(tabs)/_layout.tsx` | `tabBarAccessibilityLabel` per tab. |
| `app/_layout.tsx` | boot retry UX. |

---

## 6. Animation principles ("4D" without overdoing it)

1. **Spatial**: hero cards respond to touch with `Tilt` (rotateX/rotateY ≤ 6°, parallax inner shadow). This is the "depth" axis.
2. **Temporal**: chart bars and counters animate over 400–700 ms with eased curves.
3. **Sequential**: cards on a screen stagger in (60 ms steps) so the hierarchy reads naturally.
4. **Responsive**: every animation honours `useReduceMotion()` and falls back to instant.
5. **Restraint**: no parallax-everything. Only hero and educational content animate; data tables stay calm.

Performance budget: keep all motion on the UI thread (Reanimated worklets), no layout animations on long lists.

---

## 7. Testing plan

- `src/tests/health.test.ts` — milestone selection at boundaries (1199 s, 1200 s, 28799 s).
- `src/tests/correlations.test.ts` — top-pairs ordering, ties, empty input.
- `src/tests/facts.test.ts` — offline fallback when repo throws.
- Manual QA matrix: signup → onboarding → first log → Home animations → Trends heatmap → reduce-motion ON → tab a11y via TalkBack.

---

## 8. Rollout / sequencing

1. Land plan + memory + this doc.
2. Migration file (review with Supabase MCP if needed; not auto-applied).
3. Bundled datasets + domain modules + tests (no UI risk).
4. Animation primitives + `ErrorBoundary` (composable, additive).
5. Wire Home, then Trends, then History.
6. Onboarding polish.
7. Smoke-test on Expo Go (Android + iOS).
8. `npm run typecheck && npm run test`.
9. Tag release `v0.2.0`.

---

## 9. Open questions

- Hosting region for Supabase project (latency for India users) — confirm `ap-south-1` if not already.
- Are facts allowed to deep-link to source URLs (privacy concern: opening WHO/CDC pages discloses interest)? Default: open in in-app `WebBrowser` with a one-line consent on first open.
- Notification copy for milestones ("You just hit 24 h smoke-free") — opt-in only; default OFF.

---

## 10. Out of scope (explicit non-goals)

- Cessation programs / quit-coaching content.
- Social sharing, leaderboards, streak comparisons with friends.
- ML predictions of relapse risk.
- Replacing Supabase or migrating off Expo.

---

_Owner: SmokeCalc devs. Plan lives at repo root and is the source of truth for the 0.2.0 release._

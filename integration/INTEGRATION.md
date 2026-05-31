# Smoke-Ledger · Character animations — integration guide

Drop-in package for adding a single shared minimal-geometric character with 8 mood animations to the Smoke-Ledger Next.js app. Built to match the existing editorial aesthetic (Fraunces + DM Sans + paper noise + hairline rules + teal/terracotta) and to respect `prefers-reduced-motion` automatically.

---

## 1. What's in this folder

Mirrors your `web/` path structure so every file copies into the obvious place.

```
integration/web/
├── lib/character/
│   └── mood.ts                          NEW · typed window-event mood bus
├── components/character/
│   ├── Figure.tsx                       NEW · 200×240 SVG figure, 8 moods
│   ├── ConfettiBurst.tsx                NEW · paper-fleck one-shot burst
│   ├── CharacterCompanion.tsx           NEW · masthead-resident figure + caption
│   ├── MilestoneCelebration.tsx         NEW · streak-milestone modal portal
│   ├── LogoutFarewell.tsx               NEW · sign-out farewell portal
│   ├── character-animations.css         NEW · keyframes (alt to globals.css append)
│   └── index.ts                         NEW · barrel exports
├── components/editorial/
│   └── EditorialMasthead.tsx            PATCHED · optional `companion` slot
├── app/(app)/
│   ├── layout.tsx                       PATCHED · mounts milestone+farewell portals
│   └── dashboard/DashboardClient.tsx    PATCHED · companion + mood dispatches
└── app/
    └── globals.character.css            APPEND TO app/globals.css
```

`PATCHED` files contain everything from the original plus five tagged additions marked `// CHARACTER:` so you can see exactly what changed.

---

## 2. Copy steps

```bash
# from your repo root:
cp -r integration/web/lib/character        web/lib/
cp -r integration/web/components/character  web/components/

# overwrite patched files
cp integration/web/components/editorial/EditorialMasthead.tsx web/components/editorial/EditorialMasthead.tsx
cp integration/web/app/\(app\)/layout.tsx                       web/app/\(app\)/layout.tsx
cp integration/web/app/\(app\)/dashboard/DashboardClient.tsx     web/app/\(app\)/dashboard/DashboardClient.tsx

# append the CSS to globals.css
cat integration/web/app/globals.character.css >> web/app/globals.css
```

That's it. `npm run dev` should compile clean.

---

## 3. How the system works

### The mood bus

A tiny typed wrapper around `window.dispatchEvent(new CustomEvent(...))`:

```ts
import { dispatchMood } from '@web/lib/character/mood';

dispatchMood('regret', { caption: 'Noted. No judgment.' });
dispatchMood('thumb',  { caption: 'Quiet win recorded.' });
dispatchMood('breathe', { durationMs: 5000 });

// streak milestone modal (auto-fires applaud on the companion in parallel)
import { dispatchMilestone, milestoneForStreak } from '@web/lib/character/mood';
const m = milestoneForStreak(7);
if (m) dispatchMilestone(m);

// logout
import { dispatchFarewell } from '@web/lib/character/mood';
dispatchFarewell();
await new Promise((r) => setTimeout(r, 1600)); // let it play
await supabase.auth.signOut();
```

Mood values: `'greet' | 'regret' | 'thumb' | 'applaud' | 'victory' | 'breathe' | 'concern' | 'bye'`.

### The listeners

- `<CharacterCompanion>` listens for `character:mood` and renders the figure + optional caption + optional confetti.
- `<MilestoneCelebration>` listens for `character:milestone` and renders a full modal (auto-dismisses in 5.2s, also fires the masthead applaud).
- `<LogoutFarewell>` listens for `character:farewell` and renders a full-screen wave-off until the route changes.

The latter two are mounted once in `app/(app)/layout.tsx`. They render nothing until their event fires — zero cost at idle.

---

## 4. Wiring extra triggers

The patched `DashboardClient.tsx` already covers:

- **Greet on dashboard mount** (once per mount, 400ms after paint).
- **Regret / Concern on quick-log** — the post-log day total vs `profile.baselinePerDay` decides which.
- **Milestone modal** — fires automatically when `smokeFreeStreak()` crosses a tier (1, 3, 7, 14, 30 days).

To extend further, dispatch from wherever the event happens:

| Where | What to add |
|---|---|
| `web/app/(app)/log/new/page.tsx` (or its action) | `dispatchMood('regret', { caption: 'Noted. No judgment.' })` on successful submission. Mirror the under/over-baseline branching from the dashboard if you want. |
| `web/components/ui/HealthMilestones.tsx` | When a new milestone tier is reached client-side, `dispatchMood('breathe', { durationMs: 5000, caption: 'Lungs clearing.' })`. |
| Sidebar / settings sign-out button | Call `dispatchFarewell()`, then `await new Promise(r => setTimeout(r, 1600))`, then run your existing `supabase.auth.signOut()` + `router.push('/login')`. |
| `web/app/(app)/dashboard/DashboardClient.tsx` "Quiet win recorded" path (if you add a manual-skip button) | `dispatchMood('thumb', { caption: 'Quiet win recorded.' })`. |

---

## 5. Aesthetic guarantees

- **Stick figure only.** Single ink circle + ink line limbs. No mascot, no character with a face beyond two dots and a quiet mouth curve. Reads as editorial illustration, not a cartoon.
- **Palette stays in token system.** `var(--text)` for ink, `var(--accent)` for positive accents, `var(--warn-earth)` for the cigarette ember and concern moments. No new colors introduced.
- **Confetti is paper hairlines** in ink + teal + terracotta. No balloons, sparkles, or starbursts.
- **Captions use `var(--font-display)` italic** — same voice as the existing "Quiet, on purpose." footer.
- **Reduced motion** is enforced by a global media-query rule in the CSS file; it disables every figure animation, all confetti, and the modal rise. The figure stays visible in a neutral resting pose.

---

## 6. Removing the system

If you ever want it gone:

1. Revert the three `PATCHED` files (each has a `// CHARACTER:` tag at every touch-point — easy to grep and strip).
2. `rm -rf web/lib/character web/components/character`.
3. Delete the appended block in `globals.css` (search for `Character animations`).

Zero other parts of the codebase depend on it.

---

## 7. Out of scope (deliberate)

- **No settings toggle.** Per spec, reduced-motion alone is the off-switch. Adding a toggle is ~10 lines: read `profile.discreetMode` or a new field in `mood.ts`'s dispatchers and early-return.
- **No haptics.** The existing `web/lib/haptics.ts` could be wired into `dispatchMood` if you want a tiny vibration on milestone modal open. One line in `MilestoneCelebration`'s effect.
- **No animation toggle in tweak-mode.** This is a prototype-only concept; in production, the toggle would live in `web/app/(app)/settings/`.

---

## 8. Visual reference

The full design exploration lives at `Smoke-Ledger Character Animations.html` in this project — open it for the side-by-side library + interactive dashboard + contextual moment mocks. The figures and animations in this integration are bit-for-bit the same components.

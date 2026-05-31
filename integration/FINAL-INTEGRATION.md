# Smoke-Ledger · Final integration package

Complete, theme-aware character animation system + landing/auth enhancements for the Next.js app. Drop-in, additive, fully reversible.

---

## What this delivers

### 1. Dashboard character system (Phase 1)
A minimal geometric stick-figure that lives in the dashboard masthead and reacts to user actions in real time. Eight moods:

| Mood | Triggered when |
|---|---|
| `greet` | Login / dashboard mount (resting pose) |
| `regret` | Cigarette logged (slow sigh, smoke wisp) |
| `thumb` | Quiet win recorded (teal thumbs-up) |
| `applaud` | Streak milestone (clap + confetti) |
| `victory` | Daily goal hit (small jump) |
| `breathe` | Health milestone unlocked (chest expands) |
| `concern` | Above baseline (head tilt) |
| `bye` | Logout (sweeping wave + fade pulse) |

Plus: full-screen milestone modal at days 1/3/7/14/30, full-screen farewell overlay on sign-out.

### 2. Auth integration (Phase 2)
Login + signup pages get the same companion in the form gutter, reacting to:
- `greet` on form mount
- `regret` on sign-in error
- `thumb` on OTP / magic link sent
- `thumb` when signup form is fully valid ("Ready when you are.")
- `applaud` + confetti on account creation

### 3. Theme-awareness (NEW)

The character figure **auto-flips between light and dark mode** using your existing `.dark` class on the root element. Zero per-component code change required.

How it works: every figure stroke and fill resolves to `var(--character-ink, var(--text))`. Since `--text` is already defined in both light (`#0B0F14`) and dark (`#E6EAEF`) scopes of your `globals.css`, the character stroke automatically:
- **Light mode**: dark ink stroke against pale paper background — high contrast
- **Dark mode**: pale ink stroke against deep paper background — high contrast

For special surfaces (e.g. the inverted ink CTA section that forces dark even in light mode), override per-instance:

```tsx
<Figure mood="bye" style={{ '--character-ink': 'var(--ink-surface-text)' }} />
```

The teal accent (thumbs-up, applause flecks, breathing motes) uses `var(--accent)` which is the same `#2FA39B` in both themes — intentional brand consistency.

---

## File map

Mirrors `web/` paths exactly. Everything in `integration/web/` copies into the same location in your real `web/` directory.

```
integration/
├── FINAL-INTEGRATION.md                                  this file
├── INTEGRATION.md                                        Phase 1 (dashboard) deep dive
├── AUTH-INTEGRATION.md                                   Phase 2 (auth) deep dive
└── web/
    ├── lib/character/mood.ts                             NEW · typed window-event mood bus
    ├── components/character/
    │   ├── Figure.tsx                                    NEW · the SVG figure, 8 moods
    │   ├── ConfettiBurst.tsx                             NEW · one-shot confetti
    │   ├── CharacterCompanion.tsx                        NEW · masthead-resident figure + caption
    │   ├── MilestoneCelebration.tsx                      NEW · streak milestone modal portal
    │   ├── LogoutFarewell.tsx                            NEW · sign-out farewell portal
    │   ├── character-animations.css                      NEW · keyframes (alt to globals.css append)
    │   └── index.ts                                      NEW · barrel exports
    ├── components/editorial/
    │   ├── EditorialMasthead.tsx                         PATCHED · optional `companion` slot
    │   └── EditorialPageShell.tsx                        PATCHED · companion to right of form column
    ├── app/(app)/
    │   ├── layout.tsx                                    PATCHED · mounts milestone + farewell portals
    │   └── dashboard/DashboardClient.tsx                 PATCHED · companion + mood dispatches
    ├── app/(auth)/
    │   ├── login/page.tsx                                PATCHED · greet / regret / thumb hooks
    │   └── signup/page.tsx                               PATCHED · greet / thumb / applaud hooks
    └── app/globals.character.css                         APPEND TO web/app/globals.css
```

Patched files have every addition tagged `// CHARACTER:` so you can grep for every touch-point — easy to review and easy to revert.

---

## Install (six commands)

```bash
# from your repo root

# 1. New character system files
cp -r integration/web/lib/character       web/lib/
cp -r integration/web/components/character web/components/

# 2. Patched files
cp integration/web/components/editorial/EditorialMasthead.tsx   web/components/editorial/
cp integration/web/components/editorial/EditorialPageShell.tsx  web/components/editorial/
cp "integration/web/app/(app)/layout.tsx"                       "web/app/(app)/"
cp "integration/web/app/(app)/dashboard/DashboardClient.tsx"    "web/app/(app)/dashboard/"
cp "integration/web/app/(auth)/login/page.tsx"                  "web/app/(auth)/login/"
cp "integration/web/app/(auth)/signup/page.tsx"                 "web/app/(auth)/signup/"

# 3. Append the CSS to globals.css
cat integration/web/app/globals.character.css >> web/app/globals.css
```

Verify:
```bash
cd web
npx tsc --noEmit
npm run lint
npm run dev
```

---

## Theme verification checklist

After integration, run `npm run dev` and:

- [ ] Open the dashboard in light mode — character visible, dark ink lines against pale background
- [ ] Toggle `.dark` class on `<html>` (e.g. add it via DevTools) — character flips to pale ink against dark background, still clearly visible
- [ ] Trigger every mood once via the Quick Actions card — confetti and accents remain teal in both themes
- [ ] Visit `/login` and `/signup` — companion in the gutter is visible in both themes
- [ ] DevTools → Rendering → "Emulate prefers-reduced-motion: reduce" — all animations stop, figures remain visible in resting pose

---

## Aesthetic guarantees

- **Single geometric stick figure.** Circle head, ink lines for body/limbs, two dots for eyes, a quiet mouth curve. No mascot, no cartoon, no facial detail.
- **Palette stays in token system.** `var(--text)` for ink, `var(--accent)` for positive accents, `var(--warn-earth)` for cigarette ember + concern moments. No new colors introduced.
- **Confetti is paper hairlines** in ink + teal + terracotta. Never balloons, sparkles, or starbursts.
- **Captions use `var(--font-display)` italic teal** — same voice as your existing "Quiet, on purpose." footer.
- **Reduced motion** is enforced by a global media-query rule in the CSS file; it disables every figure animation, all confetti, and the modal rise. Figure stays visible in a neutral resting pose.

---

## Removing the integration

Three steps:
1. Revert the seven patched files (grep `// CHARACTER:` to find every touch-point).
2. `rm -rf web/lib/character web/components/character`
3. Delete the appended block in `globals.css` (search for `Character animations`).

Zero other parts of the codebase depend on it.

---

## Out of scope (deliberate)

- **No settings toggle.** `prefers-reduced-motion` is the off-switch. Adding a toggle is ~10 lines: read a new field in `mood.ts`'s dispatchers and early-return.
- **No haptics.** The existing `web/lib/haptics.ts` could be wired into `dispatchMood` if you want a tiny vibration on milestone modal open. One line in `MilestoneCelebration`'s effect.
- **Landing page animations** (mouse parallax hero, animated stat counters, SVG bento illustrations, phone-frame stepper, accordion FAQ, particle-bath final CTA) live in the prototype at `Smoke-Ledger Landing Animations.html` and source `landing-sections.jsx`. Port these to TSX in a follow-up phase if desired — the pattern is identical to the character files.

---

## Demo

The full prototype is at `Smoke-Ledger Prototype.html` — landing → signup → inbox → login → dashboard → farewell, with a dark/light toggle in the bottom-left bar. Use it to:
- Validate the character + theme system together
- Show stakeholders what the finished integration will look like
- Walk QA through every mood reaction

Both modes have been visually verified end-to-end.

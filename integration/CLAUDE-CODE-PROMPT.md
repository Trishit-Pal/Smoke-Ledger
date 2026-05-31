# Claude Code prompt — Final Smoke-Ledger integration

Copy this entire prompt and paste it into Claude Code (or a fresh Claude chat with access to your `web/` directory). Claude will execute every step, run type-checks, and report back.

---

```
I have a complete integration package for Smoke-Ledger character animations at `integration/` in this project. The package is theme-aware: the character auto-flips between light and dark mode using the existing `.dark` class on the root element. Please integrate it cleanly into the existing Next.js app at `web/` with zero TypeScript errors and zero behavior regressions.

## What you're integrating

A minimal geometric stick-figure character with 8 mood animations (greet, regret, thumb, applaud, victory, breathe, concern, bye) plus a streak-milestone modal and a logout farewell overlay. The character lives in:
- Dashboard masthead (always visible, reacts to quick-action buttons)
- Login form gutter (greets on mount, regrets on error)
- Signup form gutter (greets on mount, thumbs-up when form is valid, applauds on success)

The complete spec is in `integration/FINAL-INTEGRATION.md`.

## Theme awareness — THE KEY DETAIL

The character figure stroke uses `var(--character-ink, var(--text))`. Since `--text` is already defined in both `:root` (light: `#0B0F14`) and `.dark` (dark: `#E6EAEF`) in `web/app/globals.css`, the character auto-flips with your existing dark-mode toggle. **You do not need to thread theme as a prop anywhere.**

For special inverted surfaces (e.g. ink CTA sections), override per-instance:
```tsx
<Figure mood="bye" style={{ '--character-ink': 'var(--ink-surface-text)' }} />
```

## Execute these steps in order

### Step 1 — Copy new files

```bash
cp -r integration/web/lib/character       web/lib/
cp -r integration/web/components/character web/components/
```

This creates 7 new files: `mood.ts`, `Figure.tsx`, `ConfettiBurst.tsx`, `CharacterCompanion.tsx`, `MilestoneCelebration.tsx`, `LogoutFarewell.tsx`, `character-animations.css`, `index.ts`. No conflicts with existing files.

### Step 2 — Replace patched files

Every patched file has `// CHARACTER:` markers on every added line — grep for that string to verify changes survived the copy.

```bash
cp integration/web/components/editorial/EditorialMasthead.tsx   web/components/editorial/
cp integration/web/components/editorial/EditorialPageShell.tsx  web/components/editorial/
cp "integration/web/app/(app)/layout.tsx"                       "web/app/(app)/"
cp "integration/web/app/(app)/dashboard/DashboardClient.tsx"    "web/app/(app)/dashboard/"
cp "integration/web/app/(auth)/login/page.tsx"                  "web/app/(auth)/login/"
cp "integration/web/app/(auth)/signup/page.tsx"                 "web/app/(auth)/signup/"
```

### Step 3 — Append CSS

```bash
cat integration/web/app/globals.character.css >> web/app/globals.css
```

### Step 4 — Type-check and lint

```bash
cd web
npx tsc --noEmit
npm run lint
```

If either reports errors:
- Type errors: most likely a path alias issue. The integration uses `@web/*` (which should map to `web/*` per `tsconfig.json`) and `@/*` (which maps to `web/src/*` or similar). Verify your `tsconfig.json` matches and fix mismatches in the import lines only.
- Lint errors: report the exact rule + line.

### Step 5 — Visual verification

Run `npm run dev` and verify each of these:

1. **Light mode dashboard** (`/dashboard`): character visible in the masthead, dark ink against pale paper background. Click `+1 cigarette` — figure droops with cigarette wisp. Click `Streak +1` enough times to hit day 7 (or wire a manual trigger) — milestone modal fires with applause + confetti.

2. **Dark mode dashboard**: toggle `.dark` class on `<html>` via DevTools (or via your existing theme toggle if you have one). Character flips to **pale stroke against dark background**, still high contrast and clearly visible. Confetti and accent dots remain teal.

3. **Login page** (`/login`): companion visible to the right of the form column on viewports ≥ 768px, hidden below. Type a wrong password — figure droops with caption "Noted. No judgment."

4. **Signup page** (`/signup`): companion visible. Fill all fields correctly (valid email, password ≥ 8 chars, passwords match, checkbox ticked) — figure shifts to thumbs-up with caption "Ready when you are." even before submit.

5. **Reduced motion**: DevTools → Rendering → "Emulate prefers-reduced-motion: reduce" — every animation stops, figures remain visible in neutral resting pose. No CSS warnings.

### Step 6 — Report back

For each of the 5 visual checks above, report PASS / FAIL with a 1-line note. If any failed, list the exact file + line where the issue is.

If everything passes, take a screenshot of:
- `/dashboard` in light mode
- `/dashboard` in dark mode

and confirm the character is visible in both. We're done.

## Hard constraints (NON-NEGOTIABLE)

- ZERO new npm dependencies.
- Every `// CHARACTER:` marker in patched files must survive (so future devs can grep and revert).
- No other files modified. The integration is purely additive.
- No emojis in any UI copy unless they were already there.
- The character figure must adapt its stroke color to both light AND dark surfaces automatically — do not hard-code stroke colors.
- Match the editorial palette exactly: `var(--text)`, `var(--accent)`, `var(--rule)`, `var(--warn-earth)`. No new colors.
- All new files using `useState`/`useEffect`/`useRef` must have `'use client'` at the top.

## Reversal

If you need to roll back: revert the 7 patched files (grep `// CHARACTER:`), `rm -rf web/lib/character web/components/character`, and delete the appended block in `globals.css` (search for `Character animations`).
```

---

**After running the prompt:** if Claude reports any issues, paste them back here and I'll fix the integration source files directly.

**Already verified:**
- The prototype at `Smoke-Ledger Prototype.html` works end-to-end in both light and dark modes (toggle in the bottom-left bar).
- Type signatures of `mood.ts`, `Figure.tsx`, etc. compile against the existing `tsconfig.json` path aliases.
- All patched files preserve their original behavior; the only additions are the tagged `// CHARACTER:` blocks.

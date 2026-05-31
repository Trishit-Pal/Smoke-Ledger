# Smoke-Ledger · Auth page character animations — Claude Code integration prompt

Paste this entire prompt into Claude Code to integrate the character animations into the auth pages.

---

## Prompt to paste

I have a character animation integration package for Smoke-Ledger (Next.js, in the `web/` directory). The character system (mood bus, Figure, ConfettiBurst, CharacterCompanion, MilestoneCelebration, LogoutFarewell) is already installed at:
- `web/lib/character/mood.ts`
- `web/components/character/` (Figure, ConfettiBurst, CharacterCompanion, MilestoneCelebration, LogoutFarewell, index.ts)

I now need you to integrate the character into the **auth pages** (login and signup). Please do the following:

### Step 1 — Replace EditorialPageShell

Replace `web/components/editorial/EditorialPageShell.tsx` with `integration/web/components/editorial/EditorialPageShell.tsx`.

This patched version adds a single `<CharacterCompanion>` absolutely positioned just outside the right edge of the form column — hidden below `md` breakpoint so mobile is unaffected. Every other line is identical to the original.

### Step 2 — Replace login page

Replace `web/app/(auth)/login/page.tsx` with `integration/web/app/(auth)/login/page.tsx`.

Additions (tagged `// CHARACTER:` in the file):
1. One import: `dispatchMood` from `@web/lib/character/mood`.
2. `useEffect` — fires `greet` 500ms after mount (figure waves as the form loads).
3. `useEffect` — fires `regret` whenever `passwordError` is set (figure droops).
4. `useEffect` — fires `thumb` whenever `otpInfo` is set (OTP link sent successfully).

### Step 3 — Replace signup page

Replace `web/app/(auth)/signup/page.tsx` with `integration/web/app/(auth)/signup/page.tsx`.

Additions (tagged `// CHARACTER:`):
1. One import: `dispatchMood`.
2. `useEffect` — fires `greet` on mount.
3. `useEffect` — fires `thumb` + caption "Ready when you are." when all four fields are correctly filled (email valid, password ≥ 8 chars, passwords match, checkbox checked).
4. `useEffect` — fires `applaud` + `celebrate: true` when `successEmail` is set (account created).

### Step 4 — Verify

Run `npx tsc --noEmit` inside `web/` and fix any type errors. All `// CHARACTER:` additions are tagged — grep for that string to find every touch-point.

Check:
- `web/components/editorial/EditorialPageShell.tsx` imports `CharacterCompanion`
- `web/app/(auth)/login/page.tsx` imports `dispatchMood` and has three character `useEffect` hooks
- `web/app/(auth)/signup/page.tsx` imports `dispatchMood` and has three character `useEffect` hooks
- No other files were changed

### Character mood map for auth

| Moment | Mood | Caption |
|---|---|---|
| Login / signup page load | `greet` | — |
| Sign-in error (wrong password, etc.) | `regret` | "Noted. No judgment." |
| OTP / magic link sent | `thumb` | "Link on its way." |
| Signup form fully filled | `thumb` | "Ready when you are." |
| Account created successfully | `applaud` + confetti | "Welcome aboard." |

### Character placement

The `CharacterCompanion` in `EditorialPageShell` uses this position formula:

```
right: max(1rem, calc(50% - {maxWidth/2}px - 116px))
```

For `maxWidth=520` (the auth layout default), on a 1440px viewport this resolves to ~354px from the right — comfortably outside the form column with breathing room. Hidden via `className="hidden md:block"` on narrow screens.

### Removing the integration

To revert:
1. Restore the original three files (each has `// CHARACTER:` markers — easy to strip).
2. The character system files (`web/lib/character/`, `web/components/character/`) are shared with the dashboard and should remain unless you remove that integration too.

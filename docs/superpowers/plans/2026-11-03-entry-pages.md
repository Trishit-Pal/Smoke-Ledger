# Entry pages: teal text contrast, existing readers never in the wizard, distinct landing / sign-in / onboarding

Branch: `feat/entry-pages` (from `fix/review-mediums` 41a9e5d). Workflow: subagent-driven, TDD, one task review per task, one visual pass at the end (desktop + mobile, both themes).

## Context

The owner asked for (2026-11-03): the teal accent used as text fixed (≈2.9:1 in light mode); a proper landing page with distinct onboarding and sign-in pages; earlier, that the homepage and landing "coincide" and that onboarding steps (Welcome, Privacy, Baseline, Goal, Brands, Done) must appear only to new sign-ups, never to existing users. Findings from the code and screenshots:

1. `web/app/onboarding/page.tsx` (Welcome) repeats the landing hero verbatim: headline "Know every stick. Spend less. Quit on your terms.", the ghost "№.01" numeral, and the Free / Private / Honest pillars from `web/components/marketing/LandingHero.tsx`.
2. Existing readers are pushed into the wizard. `web/middleware.ts` sends any reader with `!hasRequiredConsents` to `resumeOnboardingRoute` (the wizard's Privacy step) even when `onboarded_at` is set — then its onboarded bounce sends them back to `/dashboard`, a redirect loop. `web/lib/auth/postAuthDestination.ts` does the same after sign-in (`!hasRequiredConsents → '/onboarding/privacy'`). `consentsOutdated` (src/lib/onboardingSteps.ts) returns false when a required consent is missing, so `/consent` never catches them, and `acceptChangedTerms` (src/services/onboarding.ts) cannot stamp `ageConfirmedAt` or `dataProcessingConsentAt`.
3. `/login` and `/signup` share one composition (eyebrow "ACCOUNT · …", stick figure, full-width teal button). A "Go to Homepage" link floats at mid-right on both.
4. About 20 web sites colour TEXT with `var(--accent)` (#2FA39B, ≈2.9:1 on light `--bg`); `--accent-ink` (#1C756E light ≈5.1:1, #33B0A8 dark) already exists for text and filled controls.

## Decisions

| # | Decision |
|---|---|
| E-D1 | Teal text uses `--accent-ink` (web). `--accent` stays for borders, rings, fills, chart strokes, glows. Mobile parity is a follow-up (mobile has no ink token yet). |
| E-D2 | An onboarded reader is never sent to an onboarding step. Missing or outdated consents → `/consent`. The wizard is only for readers without `onboarded_at` (new sign-ups, or after Erase, which resets it on purpose). |
| E-D3 | `/consent` (web and mobile) collects whatever is missing: age confirmation and data-processing consent when absent, plus the existing changed-terms and health-data rows. |
| E-D4 | Landing = persuade (unchanged, it already renders well). Sign-in = the returning reader: quiet, fastest path, no setup signals. Sign-up = the first page of setup: it shows it is step one of the journey that onboarding continues. Onboarding Welcome = a setup welcome that explains what the four steps ask and why, never the landing pitch. |
| E-D5 | Auth pages get a top-left wordmark link home in place of the floating mid-right "Go to Homepage". |

## Always / Never

- Read `PRODUCT.md`, `DESIGN.md` and the impeccable craft floor (`C:/Users/trish/.claude/skills/impeccable/reference/craft-floor.md`) before any UI edit. Editorial voice; teal only for positive moments; terracotta for concern; AA in both themes; reduced-motion fallback for every animation; tokens not literals; reuse `web/components/visual/` primitives.
- TDD for logic. Root jest from the repo root; web vitest from `web/`. Regex code via Edit/Write only.
- No new dependencies. No edits to `LEGAL_VERSIONS`. No invented product claims in copy — every factual sentence must be true in code.
- Implementers never dispatch subagents.

## Tasks

### Task 1 — Teal text uses the ink token (S)
Every place in `web/app`, `web/components` and `web/app/globals.css` where `var(--accent)` or a Tailwind `text-accent` (not `-ink`) colours TEXT (including italic headline words, link text, selected-option labels, step labels, tone helpers whose result colours text — follow each to where it's applied) switches to `var(--accent-ink)` / `text-accent-ink`. Leave borders, outlines, rings, backgrounds, fills, strokes, glows, gradients, the confetti palette and chart strokes on `--accent`. Add a web vitest guard that scans web/app and web/components source for `color: 'var(--accent)'`, `color: var(--accent)` in globals.css text rules, and `text-accent` not followed by `-` — failing with the file:line — with a short allowlist only for proven non-text uses if any slip through the pattern. Note in DESIGN.md (Color section): text never uses `--accent`; it uses `--accent-ink`.

### Task 2 — Existing readers never land in the wizard (M)
- `src/lib/onboardingSteps.ts`: one shared predicate for "an onboarded reader must re-consent" = onboarded && (!hasRequiredConsents || consentsOutdated); `consentGateRedirect` uses it. Keep `consentsOutdated`'s current meaning for callers that rely on it (grep), or update them deliberately.
- `web/middleware.ts`: the `!consented` → resume redirect applies only when `!onboarded`; onboarded readers fall through to the consent gate. No redirect loop for any combination of onboarded × consents × path (enumerate in tests).
- `web/lib/auth/postAuthDestination.ts`: onboarded readers missing consents go to `/consent` (not `/onboarding/privacy`); new readers unchanged (including `?welcome=1`).
- `src/services/onboarding.ts` `acceptChangedTerms`: also stamps `ageConfirmedAt` and `dataProcessingConsentAt` when the caller says they were missing and the reader ticked them; validation errors if a missing required row isn't ticked. The web `/consent` page (`web/app/consent/page.tsx`, `ConsentClient.tsx`) and mobile `app/consent.tsx` render those rows (reuse `ConsentRows` on web and the exported `ConsentRow` on mobile) only when missing.
- Mobile: `src/lib/routeGuard.ts` uses the shared gate; confirm an onboarded mobile reader missing consents goes to `/consent`, not onboarding.
- Tests: the decision tables (middleware, postAuthDestination, routeGuard, consentGateRedirect) for onboarded/not × each missing consent × each path; `acceptChangedTerms` stamps only what was missing.

### Task 3 — Distinct entry pages (M, frontend-design + impeccable)
- Onboarding Welcome (`web/app/onboarding/page.tsx`): replace the landing reprise with a setup welcome. Caption "Setup" style label is fine; headline about setting up the reader's ledger (no landing slogan); one sentence on time and that answers can be changed later (verify true per step in code, else word it accurately); a real numbered list of the four steps with what each asks and why (Privacy choices, usual-day baseline, an optional goal, your brands) — numbering is legitimate because it is a sequence and must match `OnboardingRail` labels; the existing primary button and Enter-to-continue. Remove the ghost "№.01", the pillars and the TiltCards. Keep editorial-stage entrance with its reduced-motion fallback.
- Sign-in (`web/app/(auth)/login/page.tsx`): the returning reader. Keep the form, modes, errors, re-auth notice and every behaviour; drop setup-flavoured signals; quieter composition; links "Create an account" and "Forgot password?" stay. Accent only per Task 1.
- Sign-up (`web/app/(auth)/signup/page.tsx`): visibly step one of setup — a compact progress line that names this as the account step and what follows (matching the onboarding rail's step names), so the journey reads landing → account → setup. Keep every field, validation and behaviour.
- Auth layout (`web/app/(auth)/layout.tsx` / `EditorialPageShell` / `GoToHomepageLink`): a top-left wordmark link to `/` replaces the floating mid-right "Go to Homepage" on auth pages (check where else GoToHomepageLink renders and keep those unless equally broken). The stick figure: keep on sign-in (returning greeting), drop from sign-up if it fights the progress line.
- Landing stays as is apart from Task 1's token swap.
- Tests: existing e2e/vitest pins that reference changed copy or structure updated (grep web/e2e and web/__tests__ for the old Welcome headline, "Go to Homepage", auth captions); add a vitest pin that the Welcome page no longer contains the landing headline and that its step list matches `OnboardingRail` labels.

## Verification

Per task: focused tests red→green; root `npx jest`, `cd web && npx vitest run`, both typechecks, web lint; `npx playwright test --list` for touched specs. Visual pass (controller): `/`, `/login`, `/signup` at 1440×900 and 390×844 in dark and light (placeholder Supabase env on `next dev`). The Welcome step needs a session, so it is checked by code review and its vitest pin. Run the impeccable detector once over changed UI files at the end.

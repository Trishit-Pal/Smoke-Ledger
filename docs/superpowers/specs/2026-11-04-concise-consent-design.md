# Concise consent: two ticks and one real choice

**Date:** 2026-11-04 · **Owner decisions:** in chat 2026-11-04 (Option B now, Option A at the next policy bump)

## Why

The consent screens ask for too many ticks. Sign-up asks for five required ticks, the health-data tick and an analytics tick; `/consent` asks for up to six. The health-data row also has an "I don't consent" button that looks like a choice but has no selected state. Without that consent nothing else can proceed.

The owner reported the decline as confusing. In the conversation the owner decided:

- **Keeping the ledger is part of what you agree to in order to use the app.** It is worded plainly and explicitly. It is not a choice that can be turned down while still using the app. A "No" that changes nothing would mislead, because what a reader logs is health information (GDPR Art 9, DPDP s.6).
- **The real, no-penalty choice is Ask the ledger.** It is a Yes / No pair, the same size, with nothing pre-selected. Declining leaves everything else working, and the chat can be turned on later in Settings.
- **Option B now.**
  - Two required ticks: one for the terms, one for the ledger, with the ledger on its own line.
  - The published Privacy Policy says the ledger consent is "given on its own unticked line" (`web/app/privacy/page.tsx`, legal-basis section). Option B needs no policy change and no `LEGAL_VERSIONS` bump.
- **Option A later.** One tick for everything, when the policy is bumped anyway for the EU representative and the chat. Not in this work.
- **The chat stays off in Production** until the EU representative is signed. While the chat is off, the screen shows no chat question.

## Goals

- **Sign-up** (`/onboarding/privacy`, Expo `app/onboarding/privacy.tsx`):
  - Tick 1: "I am 18 or older, I agree to the Terms of Service and the Privacy Policy, and I understand this app does not provide medical advice."
  - Tick 2: the existing explicit health-data line (`HEALTH_CONSENT_LABEL` / `HEALTH_CONSENT_SUB`, wording unchanged).
  - The optional analytics tick, unchanged.
  - The chat Yes / No pair, only while the chat is enabled for this build.
- **Re-consent** (`/consent`, Expo `app/consent.tsx`): the same tick 1 and tick 2. Tick 2 appears only when the profile has no `health_data_consent_at`, as today. The chat pair follows the same rule as sign-up, and there is no analytics tick, as today.
- **Continue / Accept** unlocks when every shown required tick is ticked and, if the chat pair is shown, it has been answered either way.
- **Remove the health-data decline button** ("I don't consent") and its two notes (`HEALTH_DECLINE_*` in `src/lib/healthConsent.ts`). On `/consent`, the existing "Not now — export or delete my data" link to Settings stays as the way out.
- **Web and mobile match**, using shared copy in `src/lib` as today.

## Non-goals

- No schema, RLS or migration change.
- No change to the Privacy Policy or Terms text, and no `LEGAL_VERSIONS` bump.
- No change to the withdraw flow (`WITHDRAW_*`), Settings, the chat release gate (`isChatPolicyLive`) or the chat panel's first-ask consent card.
- No provider switch for the chat. That is project 2.
- No Option A (single tick).

## Anti-goals (failure even if it works)

- **A pre-ticked box, or a default chat answer.**
- **A decline that looks available but does nothing.**
- **Breaking the stamp contract.** Ticking must still write every stamp the middleware and the services already read:
  - `age_confirmed_at`, `terms_version`, `privacy_version`, `health_disclaimer_version`, `data_processing_consent_at` and `health_data_consent_at`;
  - the `consent.*` settings;
  - exactly one `consent_accepted` audit row per version, as today.
- **A screen that mentions the chat while the chat is off.**

## Constraints

- **Stamping.** Tick 1 stands for the five rows it replaces: `age`, `terms`, `privacy`, `medical` and `dataProcessing` (`REQUIRED_ROWS`, `web/components/onboarding/ConsentRows.tsx`).
  - On sign-up, `submitConsentStep` (`src/services/onboarding.ts`) already stamps all of them, so the service needs no logic change.
  - On `/consent`, `acceptChangedTerms` takes `ageConfirmed` and `dataProcessingConsent` (used only when missing) and `healthDataConsent`. Tick 1 supplies the first two.
  - The wording of tick 1 must still cover data processing. Add a sub-line: "We process your data to run your account, sync it and keep it secure." That matches the policy's "needed to provide the service" basis.
- **Chat pair visibility.**
  - Web: the page passes the server-side `isLedgerChatEnabled()` result down, as Settings does with `chatEnabled`.
  - Mobile: `isLedgerChatEnabled()` (the build flag).
  - Show the pair only when the chat is enabled and the reader has no stored chat answer (`consent.ledgerChatOptIn` is unset).
  - On Continue, "Yes" writes `chatOptInValue(true)` and "No" writes `chatOptInValue(false)` to `consent.ledgerChatOptIn`. Record the `ledger_chat_consent_toggled` audit (`enabled`, `privacyVersion`, `noticeVersion`) without awaiting it and drop any failure, as the panel now does (#110).
  - The chat wording is the **full existing notice**, not the summary. The web panel renders it from `web/components/chat/notice`, and mobile uses `mobileNoticeParagraphs()`. It sits inline with the pair, with a "Read the details" expander if it doesn't fit at 360 px.
    - *Builder-check ruling:* "Yes" stores `LEDGER_CHAT_NOTICE_VERSION`, which records that the reader saw that notice. Showing only `IN_SCOPE_SUMMARY` would make that record untrue and would hide the cross-border AI processor.
    - Reusing the notice keeps the hash test (`web/__tests__/ledgerChatScope.test.ts`) green unchanged.
  - **What counts as "no stored chat answer":** only an **unset** `consent.ledgerChatOptIn`. Read the raw setting, not `isCurrentChatOptIn`, which collapses unset, declined and stale into one value.
    - A reader who declined stays declined and isn't asked here.
    - A stale notice version isn't re-asked here either; the chat panel's first-ask card handles it, as today.
- **Design.**
  - Use the existing editorial primitives (`web/components/visual/`: `SectionLabel`, `ChoiceRun` for the Yes / No pair if it fits) and tokens (`--accent-ink` for teal text).
  - AA contrast in both themes, a 44 px minimum target, and any motion with a reduced-motion fallback.
  - Copy in the product voice (`PRODUCT.md`).
- **Tests.**
  - Unit/source tests for: tick 1 stamping all five, no decline button, the chat pair hidden when the chat is disabled, the chat pair writing the versioned opt-in, and Continue gating.
  - Update `web/e2e/consent.spec.ts`, which ticks four boxes today, and `web/e2e/_helpers/fixtures.ts` (`completeOnboarding`) for the new rows. CI's functional e2e runs with the chat enabled, so it must answer the chat pair.
    - The helper answers **"No"**. That keeps every existing spec in today's unconsented chat state, so the panel's first-ask card still appears where specs expect it.
    - One dedicated spec covers "Yes": the opt-in is stored and the panel opens consented.
  - Keep the sign-up "Stamp all consents" dev shortcut and the "N / M acknowledged" counter, adjusted to the new row count.
  - `src/tests/consent-stamp-all.test.ts` and `src/tests/consent-gate-wiring.test.ts` stay green.
- **Mobile.**
  - The Expo screens change in the same PR.
  - Shipping them needs a new store build, which is the owner's step.
  - Mobile must not ship ahead of web.

## Left to the builder

- Exact component split. A shared `AgreementRows` for web, used by both screens, is fine.
- Whether `REQUIRED_ROWS` stays as data behind one rendered row or becomes a single entry.
- The numbering on the printed row stamps ("01", "02").
- How the chat pair reads on a 360 px phone.

## Done when

- Sign-up and `/consent` show tick 1 and tick 2 (tick 2 only when needed). Neither shows the chat pair while `LEDGER_CHAT_ENABLED` is off.
- With the chat enabled (Preview, CI), the pair appears once and records the answer.
- Root jest, web vitest, both typechecks, lint, `spec:drift`, and CI `responsive-e2e` (27/27 functional, no skips) are green.
- The spec sections `security-privacy`, `identity-profile` and `auth` are updated by `spec-update`.

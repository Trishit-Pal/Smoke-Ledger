# Concise Consent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the long consent screens with two required ticks and one real choice:
- **Tick 1, the terms:** age, terms, privacy, the medical notice and data processing, as one line.
- **Tick 2, your ledger:** the explicit health-data consent, on its own line.
- **The choice:** an optional Ask the ledger Yes / No, shown only while the chat is on.

**Architecture:**
- Shared copy and one pure gating helper live in `src/lib`, so web and mobile cannot drift.
- Web and Expo each render the same rows.
- The services (`submitConsentStep`, `acceptChangedTerms`) keep their stamping contract, so no schema change is needed. Tick 1 simply supplies every acknowledgement it replaces.

**Tech Stack:** Next.js 15 (server and client components), Expo React Native, TypeScript, root jest (`src/`, `app/`), web vitest, Playwright e2e.

**Spec:** `docs/superpowers/specs/2026-11-04-concise-consent-design.md` (owner-approved 2026-11-04, builder-check answers folded in).

**Branch:** `feat/concise-consent`. It already holds the spec at b651d3e. Rebase it on GitHub `main` (fetch by URL) before Task 1.

## Global Constraints

- **Tick 1 wording (verbatim):**
  - Label: "I am 18 or older, I agree to the Terms of Service and the Privacy Policy, and I understand this app does not provide medical advice."
  - Sub-line: "We process your data to run your account, sync it and keep it secure."
  - The two document names are links to `/terms` and `/privacy`.
- **Tick 2 wording:** the existing `HEALTH_CONSENT_LABEL` / `HEALTH_CONSENT_SUB` (`src/lib/healthConsent.ts`), unchanged, on its own line. The Privacy Policy says "given on its own unticked line".
- **Remove the decline:** remove "I don't consent" and its notes (`HEALTH_DECLINE_LABEL`, `HEALTH_DECLINE_NOTE`, `HEALTH_DECLINE_NOTE_EXISTING`) from web and mobile. On `/consent`, the existing "Not now — export or delete my data" link stays.
- **No pre-ticked box and no default chat answer.** Continue or Accept unlocks only when every required tick shown is ticked and, if the chat pair is shown, it has an answer.
- **When the chat pair shows:** only when the chat is enabled for the build (web server `isLedgerChatEnabled()` from `web/lib/server/ledgerChat/enabled.ts`; mobile `isLedgerChatEnabled()` from `src/lib/askPill.ts`) **and** the raw `consent.ledgerChatOptIn` setting is **unset** (`null`).
  - Declined (`false`) or stale-version readers are not asked here.
  - The pair renders the **full** existing notice: web `LEDGER_CHAT_NOTICE` paragraphs as `AskLedgerPanel.tsx` does; mobile `mobileNoticeParagraphs()`. No new notice text, so the hash test in `web/__tests__/ledgerChatScope.test.ts` stays green.
  - "Yes" stores `chatOptInValue(true)`; "No" stores `chatOptInValue(false)`.
  - The `ledger_chat_consent_toggled` audit is sent without awaiting, with its failure dropped, as in #110.
- **Stamping is unchanged:** exactly one `consent_accepted` audit per version, and every stamp the middleware reads. There is no schema, RLS, migration, policy or `LEGAL_VERSIONS` change.
- **Design:**
  - tokens only (`--accent-ink` for teal text);
  - reuse the `web/components/visual/` primitives (`ChoiceRun` for the Yes / No pair if it fits; otherwise two equal 44 px buttons with `aria-pressed`);
  - AA in both themes;
  - reduced-motion fallback;
  - product voice.
- **Process:**
  - TDD.
  - Root jest from the repo root; web vitest from `web/`.
  - Regex and backslash code via Edit/Write only.
  - Never `git add -A`; leave `Images/` alone.
  - Commits end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

- **An onboarded reader with age and data-processing stamps present but outdated terms:** tick 1 still shows, the services stamp only what is missing, and there is one audit row. This is pinned in Task 4.
- **Chat enabled but the stored opt-in is a stale version string:** the pair does not show, and the panel's first-ask card handles it later. This is pinned in Tasks 3 and 4.
- **A reader who ticks then un-ticks:** Continue disables again. This is pinned in Task 1 (helper) and Task 2 (render).
- **At 360 px with the full notice:** the "Read the details" expander keeps Continue reachable without scrolling past a wall of text. This is pinned in Task 2 and in the Task 6 visual pass.
- **A failed raw-setting read on the server:** the pair is hidden (fail quiet) and the page still renders. This is pinned in Task 3.

---

### Task 1: Shared copy and gating helper

**Files:**
- Create: `src/lib/consentForm.ts`
- Modify: `src/lib/healthConsent.ts` (remove the `HEALTH_DECLINE_*` exports; add `AGREEMENT_LABEL_PARTS` and `AGREEMENT_SUB`)
- Test: `src/tests/consentForm.test.ts`

**Interfaces:**
- Produces:
  - `AGREEMENT_SUB: string` (the verbatim sub-line).
  - `AGREEMENT_LABEL_PARTS: { before: string; terms: string; middle: string; privacy: string; after: string }`. Joined, the parts are the verbatim label. They are split so each platform can make the two names links.
  - `canContinueConsent(input: { agreed: boolean; needsHealth: boolean; health: boolean; chatShown: boolean; chatAnswer: boolean | null }): boolean`
  - `type ChatAnswer = boolean | null`

- [ ] **Step 1: Write the failing tests.**
  - Joined `AGREEMENT_LABEL_PARTS` equals the verbatim label from Global Constraints. `AGREEMENT_SUB` is verbatim.
  - `canContinueConsent`:
    - false when `!agreed`;
    - false when `needsHealth && !health`;
    - false when `chatShown && chatAnswer === null`;
    - true with `chatAnswer === false` (a "No" still continues);
    - true when `!chatShown` and `chatAnswer` is null;
    - un-ticking flips true back to false.
  - Source guard: no file under `app/`, `src/` or `web/` imports `HEALTH_DECLINE_`.
- [ ] **Step 2: Run** `npx jest src/tests/consentForm.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** `consentForm.ts` and the copy constants. Remove the `HEALTH_DECLINE_*` exports; their importers change in Tasks 2 to 5, so in this task keep a temporary local copy where removal would break the typecheck, and delete it in the task that rewrites that importer.
- [ ] **Step 4: Run** `npx jest src/tests/consentForm.test.ts` and `npm run typecheck`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(consent): shared agreement copy and continue rule`.

### Task 2: Web rows

**Files:**
- Modify: `web/components/onboarding/ConsentRows.tsx`
  - Add `AgreementRow`.
  - Remove the decline from `HealthConsentRow`.
  - Add `ChatChoiceRow`.
  - Keep `REQUIRED_ROWS` exported only if another importer still needs it; otherwise remove it.
- Test: `web/__tests__/consentRows.test.tsx` (via `renderToStaticMarkup`)

**Interfaces:**
- Consumes: `AGREEMENT_LABEL_PARTS`, `AGREEMENT_SUB` (Task 1); `LEDGER_CHAT_NOTICE` from `@web/components/chat/notice`.
- Produces:
  - `AgreementRow({ checked, onChange, number }: { checked: boolean; onChange(v: boolean): void; number: string })`
  - `HealthConsentRow({ checked, onChange, number })`. The `declined` and `existingLedger` props are removed.
  - `ChatChoiceRow({ answer, onAnswer, number }: { answer: boolean | null; onAnswer(v: boolean): void; number: string })`

- [ ] **Step 1: Write the failing tests.**
  - `AgreementRow` renders one checkbox whose accessible name contains the full label, plus links to `/terms` and `/privacy`.
  - `HealthConsentRow` renders no "I don't consent" button and no decline note.
  - `ChatChoiceRow`:
    - renders every `LEDGER_CHAT_NOTICE` paragraph;
    - renders two equal buttons, "Yes, turn it on" and "No, thanks", with `aria-pressed="false"` when `answer` is null;
    - `aria-pressed="true"` follows `answer`;
    - renders a `<details>` "Read the details" wrapper around everything after the lead paragraph.
  - No colour literals.
- [ ] **Step 2: Run** `cd web && npx vitest run __tests__/consentRows.test.tsx`. Expected: FAIL.
- [ ] **Step 3: Implement** in the existing editorial style of the file: numbered stamps, hairlines, tokens. The pair takes `min-h-11` targets.
- [ ] **Step 4: Run** the test, `npm run typecheck` and `npx next lint --quiet`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(consent): agreement, ledger and chat rows (web)`.

### Task 3: Web sign-up step

**Files:**
- Modify:
  - `web/app/onboarding/privacy/page.tsx`
  - `web/app/onboarding/privacy/OnboardingPrivacyClient.tsx`
  - `web/e2e/_helpers/fixtures.ts` (`completeOnboarding`)
- Test: `web/__tests__/onboardingPrivacyChat.test.ts` (source guards plus the pure gating); `web/e2e/consent-chat.spec.ts` (new, the dedicated "Yes" path)

**Interfaces:**
- Consumes: Task 1 and Task 2 exports; `getServerSetting<T>(key)` from `@web/lib/server/data`; `isLedgerChatEnabled()` from `@web/lib/server/ledgerChat/enabled`; `chatOptInValue` from `@web/components/chat/notice`; `recordAuditEvent` from `@/services/audit`; `setSetting`.
- Produces: the `OnboardingPrivacyClient` prop `chatAsk: boolean`.

- [ ] **Step 1: Write the failing tests.**
  - The page computes `chatAsk = isLedgerChatEnabled() && (await getServerSetting('consent.ledgerChatOptIn').catch(() => undefined)) === null`. A failed read gives `false`.
  - The client renders `AgreementRow`, `HealthConsentRow`, the existing analytics tick, and `ChatChoiceRow` only when `chatAsk`.
  - Continue uses `canContinueConsent`.
  - On submit it calls `submitConsentStep(...)`. When an answer was given it then calls `setSetting('consent.ledgerChatOptIn', chatOptInValue(answer))` plus a `void recordAuditEvent('ledger_chat_consent_toggled', 'privacy', …).catch(…)`.
  - "Stamp all consents" ticks the agreement only, never the health row or the chat.
  - The counter shows the shown required rows.
- [ ] **Step 2: Run** `cd web && npx vitest run __tests__/onboardingPrivacyChat.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.** Update `completeOnboarding`: after "Stamp all", tick the health box and, when the "No, thanks" button is visible, click it. Add `consent-chat.spec.ts`: sign up, answer "Yes", then the dock panel opens consented, with no first-ask card.
- [ ] **Step 4: Run** the vitest file, the full vitest, typecheck and lint, then `npx playwright test e2e/consent-chat.spec.ts --list`. Expected: PASS and the spec listed.
- [ ] **Step 5: Commit** `feat(consent): sign-up asks two ticks and the chat choice`.

### Task 4: Web re-consent screen

**Files:**
- Modify: `web/app/consent/page.tsx`, `web/app/consent/ConsentClient.tsx`, `web/e2e/consent.spec.ts`
- Test: `web/__tests__/consentScreenChat.test.ts`

**Interfaces:**
- Consumes: Task 1 to 3 exports; `acceptChangedTerms({ needsHealthConsent, healthDataConsent, needsAgeConfirm, ageConfirmed, needsDataProcessing, dataProcessingConsent })` (`src/services/onboarding.ts`).
- Produces: the `ConsentClient` prop `chatAsk: boolean`, computed in the page exactly as in Task 3.

- [ ] **Step 1: Write the failing tests.**
  - Tick 1 always shows, because terms, privacy and medical are versioned.
  - On accept, tick 1 supplies `ageConfirmed: true` and `dataProcessingConsent: true`. The service still stamps only what is missing.
  - Tick 2 shows only when `needsHealthConsent`.
  - The chat pair follows `chatAsk`.
  - The answer is written after `acceptChangedTerms` resolves, and the audit is not awaited.
  - The "Not now — export or delete my data" link is unchanged.
  - Update `consent.spec.ts`: tick the agreement and the health box, and click "No, thanks" when it shows, instead of the four boxes.
- [ ] **Step 2: Run** `cd web && npx vitest run __tests__/consentScreenChat.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** the change.
- [ ] **Step 4: Run** the vitest file, the full vitest, typecheck and lint, then `npx playwright test e2e/consent.spec.ts --list`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(consent): the re-consent screen asks two ticks and the chat choice`.

### Task 5: Mobile parity

**Files:**
- Modify:
  - `app/onboarding/privacy.tsx` (its `CONSENT_ROWS` collapse to the agreement plus health plus analytics);
  - `app/consent.tsx`;
  - the chat consent service read, through the existing mobile settings getter.
- Test: `src/tests/mobileConsentScreens.test.ts`

**Interfaces:**
- Consumes: Task 1 exports; `mobileNoticeParagraphs()` (`src/lib/askView`); mobile `isLedgerChatEnabled()` (`src/lib/askPill.ts`); `chatOptInValue` (`src/domain/ledgerChat/notice`).

- [ ] **Step 1: Write the failing source-guard tests.** Both screens:
  - render one agreement row from `AGREEMENT_LABEL_PARTS`;
  - render the health row without a decline;
  - render the chat pair only when enabled and the raw setting is unset;
  - gate on `canContinueConsent`;
  - write the answer and the unawaited audit;
  - have no `HEALTH_DECLINE_` reference.
- [ ] **Step 2: Run** `npx jest src/tests/mobileConsentScreens.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** using the screens' existing row component, with 44 px targets and theme tokens from `src/constants/theme.ts`.
- [ ] **Step 4: Run** `npx jest` (full root suite) and `npm run typecheck`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(consent): mobile matches the two ticks and the chat choice`.

### Task 6: Docs, visual pass, review, PR (controller)

- [ ] **Docs:** run `spec-update` for the sections `affected.mjs` names (expected: `security-privacy`, `identity-profile`, `auth`).
- [ ] **Visual pass, one bounded round:**
  - `/onboarding/privacy` and `/consent` at 1440 and 360, in light and dark;
  - with the chat enabled (local) and disabled;
  - check AA and that the expander keeps Continue reachable at 360.
- [ ] **Detector:** run `impeccable detect --json` once on the changed web files.
- [ ] **Review:** a final whole-branch review on opus, then one fix wave and a scoped re-review.
- [ ] **Ship:**
  - Push by URL and open a PR into `main`.
  - Watch CI until `responsive-e2e` is green.
  - The owner merges.
  - The mobile store build is the owner's step and ships with or after web, never ahead of it.

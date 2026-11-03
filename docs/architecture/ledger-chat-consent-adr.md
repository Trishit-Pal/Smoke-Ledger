# ADR: Version the Ask the ledger opt-in

**Status:** Accepted
**Date:** 2026-11-03
**Deciders:** Project owner (decision D2 in `docs/superpowers/plans/2026-11-03-review-fixes.md`)

## Context

Ask the ledger sends a reader's ledger figures to Anthropic, so it needs the reader's own opt-in. That opt-in lives in `settings_kv` under `consent.ledgerChatOptIn`. Until now it was a bare `true` or `false`, and every reader (the chat route, the Settings loader, the mobile service) checked `=== true`.

The notice behind that opt-in has changed since the first readers turned it on. PR #103 showed a narrower notice. The current one also lists goal history, prices from entries (with variant) and edit dates. A bare `true` cannot say which notice it was given to, so an opt-in to the narrower words would silently cover the wider ones when the feature is switched on in Production. The split review of 2026-11-03 recorded this as H2.

The same review found that web Settings rendered the opt-in switch even while the chat flag was off. Mobile already hides it behind `isLedgerChatEnabled()`.

Forces:

- **Consent must rest on the words shown** (DPDP s.6, GDPR Art 7). A changed notice needs a fresh yes.
- **Two clients.** Web and the Expo app both write and read the key, and they share `src/domain`.
- **Free tier, small team.** No migration or backfill job if it can be avoided.
- **Fail closed.** A value the code does not recognise must read as off.

## Decision

Store the notice version instead of `true`.

- `src/domain/ledgerChat/notice.ts` holds `LEDGER_CHAT_NOTICE_VERSION` (`'2026-11-03'`) and two helpers. `chatOptInValue(enabled)` returns the version or `false`, and every writer stores what it returns. `isCurrentChatOptIn(value)` is true only for the current version, and every reader uses it.
- Opting out still stores `false`.
- No migration. Existing `true` rows read as "not consented". Those readers see the consent card again the next time they ask.
- The `ledger_chat_consent_toggled` audit event gains a `noticeVersion` prop beside `privacyVersion`. It is registered in `src/services/audit.ts` and `web/app/api/audit/schema.ts`. The edge function `audit-record` filters props with a key denylist, so the new key passes there without change.
- `web/__tests__/ledgerChatScope.test.ts` pins a sha256 of `LEDGER_CHAT_NOTICE_TEXT` next to the version. If the text changes, the test fails with "notice text changed: bump LEDGER_CHAT_NOTICE_VERSION and update this hash".
- Web Settings shows the switch and its notice dialog only when `isLedgerChatEnabled()` is true. That is the same gate the dock and the route use.

## Options considered

### A. Store the notice version (chosen)

| Dimension | Assessment |
|---|---|
| Complexity | Low: one constant, two one-line helpers, three writers and three readers |
| Cost | None at runtime: the same single `settings_kv` read |
| Reversibility | High: readers could go back to accepting `true` in one line |
| Consent honesty | Every future notice change asks again |

**Pros:** fixes this case and every later one. The stored row says which notice the reader agreed to. **Cons:** each notice change asks every reader again, including for small wording fixes.

### B. One-time reset (clear every `true` at turn-on)

| Dimension | Assessment |
|---|---|
| Complexity | Low: one migration or SQL statement |
| Cost | One-off |
| Consent honesty | Fixes this change only |

**Cons:** the next notice change has the same flaw, and someone has to remember to run the reset again. The row still cannot say which notice it covers.

### C. Keep the boolean

| Dimension | Assessment |
|---|---|
| Complexity | None |
| Consent honesty | An opt-in to the narrower notice carries over to the wider one |

**Cons:** this is the H2 defect itself.

## Trade-off analysis

A and B cost about the same today. Only A keeps the record true as the notice keeps changing. The extra cost of A is that some notice changes ask everyone again. That is the intended behaviour, not a side effect: if the words change, the consent must be given to the new words. The pinned hash makes forgetting the bump a test failure instead of a review catch.

## Consequences

- **Each notice change asks everyone again.** Any edit to `LEDGER_CHAT_NOTICE` needs a new `LEDGER_CHAT_NOTICE_VERSION` and a new pinned hash in the same change. Readers then see the consent card again on their next question.
- **Mobile and web must ship the same version.** Both read the one constant in `src/domain`, but they deploy separately. An installed mobile build with an older version stores that older version when the reader opts in. A build from before this change stores `true`. Either way the web route refuses the opt-in, and the mobile screen asks again, until the reader updates the app. Ship the mobile build with the web deploy whenever the version changes.
- **Readers who opted in before this change opt in again.** Their `true` rows stay in `settings_kv` and read as off. Nothing is deleted.
- **The audit trail names the notice.** `noticeVersion` in `ledger_chat_consent_toggled` records which notice each toggle rested on. Redeploying `audit-record` is already step 2 of owner-actions §8.
- **Only the shared notice is hashed.** On mobile, the device sentence of the notice is `MOBILE_DEVICE_NOTE` in `src/lib/askView.ts`, and the hash does not cover it. A change there needs a manual version bump.

## Action items

1. [x] `LEDGER_CHAT_NOTICE_VERSION`, `isCurrentChatOptIn` and `chatOptInValue` in `src/domain/ledgerChat/notice.ts`, re-exported from `web/components/chat/notice.ts`.
2. [x] Writers (`AskLedgerPanel.tsx`, `SettingsClient.tsx`, `src/services/ledgerChat.ts`) store `chatOptInValue(...)` and audit `noticeVersion`. Readers (`web/app/api/ledger-chat/route.ts`, `web/lib/server/data.ts`, `src/services/ledgerChat.ts`) use `isCurrentChatOptIn`.
3. [x] Settings row and notice dialog behind `isLedgerChatEnabled()`.
4. [x] Hash pin and stale-value tests (`ledgerChatScope`, `ledgerChatRouteHandlers`, `ledgerChatService`, `ledgerChatPanel`), plus the e2e seed.
5. [ ] Owner: redeploy `audit-record` (owner-actions §8 step 2), and ship the mobile build in step with web whenever the version changes.

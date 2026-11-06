# Ask the ledger: India-first MVP launch (design)

Status: implemented on `feat/chat-mvp-launch` (draft PR). Decisions are the owner's, taken in a stepwise interview on 2026-11-05.

## Intent

Turn the finished Ask the ledger chat on in Production as an MVP for mostly Indian readers, without waiting for a GDPR Art 27 EU representative; the legal position is resolved later. Every reader keeps a real yes and no to AI processing of their data. A reader who has not said yes sees the chat waiting, with a plain line saying consent is needed.

## What already existed (and is not rebuilt)

- The chat, its guardrails and its tests (PRs #103, #106 to #110); the Yes/No on `/consent` and sign-up (#113); the dock's first-question consent card; the Settings switch (which also withdraws consent); the route's `consent_required` check and the audit event `ledger_chat_consent_toggled`.
- A single code gate: `isLedgerChatEnabled()` stays off in Production until `LEGAL_VERSIONS.privacy` is later than `CHAT_UNDISCLOSED_PRIVACY` (`2026-11-02`).

## Decisions

| Step | Decision | Cost if wrong |
|---|---|---|
| Provider | Anthropic first, behind an ordered provider list. The owner adds other vendors through LangChain later, in `providers/langchain.ts` | Small; the list works without any second vendor |
| Gate | Bump `LEGAL_VERSIONS` (the alternative, an env override, avoids the forced re-consent) | Every live reader meets `/consent` once; the bump cannot be undone |
| Who | Everyone, EU readers included (the alternative was India only) | Accepted GDPR Art 27 and Art 9 exposure; an India-only server check is about ten lines |
| Locked state | One quiet line under the box before consent; the full notice still appears when a question is typed | The message shows only once the reader opens the panel |
| Platforms | Web and mobile together | A store build cannot be rolled back quickly |
| Order | Production variables first, then merge, so one `/consent` screen asks the ticks and the chat Yes/No | One interruption for everyone; the kill switch is `LEDGER_CHAT_ENABLED` |
| Limits | 10 questions per reader per day, 200 overall, plus a monthly hard limit in the Anthropic console | The overall cap bounds the daily bill |
| Terms | Bump terms and privacy together | One more date |
| Fallback | Claude writes the runner; the owner writes the LangChain adapters | None |
| Vendors named | Anthropic only at launch; other vendors are refused until named | Naming a vendor later re-asks every reader who opted in |

## Design

- **Versions.** `LEGAL_VERSIONS.terms` and `.privacy` move to `2026-11-05`. The release-gate test no longer demands a named representative; it demands that the policy keeps saying one is being appointed. `PUBLISHED` in that test stays at the versions readers accepted before this bump.
- **Provider list.** `providers.ts` holds `[anthropicProvider, ...langchainProviders]`. `fallback.ts` runs a turn on the first provider; a failed model call restarts the whole turn on the next, each attempt with a slice of the 25 s budget (floor 8 s). It skips a provider with no key and refuses one that is not in `LEDGER_CHAT_DISCLOSED_PROVIDERS` or whose label the consent notice does not contain. Errors outside the model call are not retried. `turn.ts`, the guards and the pinned notice text are unchanged.
- **Consent line.** A line outside the hash-pinned notice, so `LEDGER_CHAT_NOTICE_VERSION` does not change and nobody is asked again for wording. Web panel and mobile Ask screen use the same words.
- **Mobile.** `eas.json` preview and production carry `EXPO_PUBLIC_LEDGER_CHAT_ENABLED=true`; the owner fills the web origin. `src/services/ledgerChat.ts` retries a 401 once after a session refresh.

## Non-goals

No migration, RLS, new table or change to the guardrails; no streaming; no second vendor shipped; no India-only gate.

## Constraints

Merging `main` deploys Production and sends every reader to `/consent`, so the PR stays a draft until the owner has done the steps in `docs/legal/owner-actions.md` section 8 (variables first, then merge). Notice or vendor changes need web and mobile to ship together.

## Left to the builder and the owner

Owner: migrations check, `audit-record` and `delete-account` redeploys, the Anthropic key and monthly limit, Vercel variables (Preview first), the live probe, the EAS build with the real web origin and the manual device checks. See `docs/legal/owner-actions.md` sections 2 and 8.

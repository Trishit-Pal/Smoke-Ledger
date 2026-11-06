# ADR: Ask the ledger runs on an ordered provider list, gated by the consent notice

**Status:** Accepted
**Date:** 2026-11-05
**Deciders:** Project owner (interview of 2026-11-05, steps 1 and 9; see `docs/superpowers/specs/2026-11-05-chat-mvp-launch-design.md`)

## Context

Ask the ledger sends a reader's ledger figures to an AI model. Until now the route built one Anthropic client itself (`new Anthropic(...)` in `web/app/api/ledger-chat/route.ts`) and mapped `Anthropic.APIError` to a calm 502. For the India-first MVP launch the owner wants Anthropic to answer first, and room to add other vendors later through LangChain with their own free API keys, falling back when one fails.

Forces:

- **Consent rests on named processors.** The consent notice (`src/domain/ledgerChat/notice.ts`) and the privacy page name Anthropic as the processor. Sending data to any other vendor without naming it breaks the consent the reader gave (DPDP s.6, GDPR Art 7 and Art 13). Free tiers often allow training on inputs, which matters more for health-related data.
- **The turn engine speaks one shape.** `web/lib/server/ledgerChat/turn.ts` runs tool calls over the Anthropic message shape and is injected through a small `ChatModelClient` interface. Vendors differ in tool-call formats.
- **One budget.** A turn must finish inside the route's 25 s budget (Vercel `maxDuration` 30 s) or the reader sees a platform 504.
- **Our bugs are not outages.** An exception from our own tool or guard code must not be retried on another vendor or reported as "the provider is down".
- **Free tier, one maintainer.** No new runtime dependency at launch; the owner adds LangChain packages with their adapters.

## Decision

The route runs each turn through `runWithFallback` (`web/lib/server/ledgerChat/fallback.ts`) over `PROVIDERS` (`providers.ts`): Anthropic first, then the owner's entries from `providers/langchain.ts`, which ships empty.

- A provider is `{ id, label, model(), client() }`. A `client()` that returns `null` (no key set) is skipped.
- **Disclosure check.** A provider runs only if its id is in `LEDGER_CHAT_DISCLOSED_PROVIDERS` **and** the notice text contains its label. This is checked before `client()` is called, so an undisclosed vendor's client is never even built.
- **Whole-turn restart.** When the model call throws, the whole turn restarts on the next provider. The tools only read in-memory data, so a rerun is safe, and two vendors' tool formats are never mixed inside one turn.
- **Only model-call failures fail over.** The runner wraps each client's `messages.create`; errors from anywhere else propagate unchanged, as before (a 500).
- **Time slices.** The runner first builds every disclosed provider's client (cheap, no network). It then shares what is left of the 25 s budget evenly among the providers that can actually run, so a vendor with no key never shrinks the others. Each slice is never below 8 s and never more than is left; when nothing is left, it stops. A `client()` that throws (a malformed key, a broken adapter) is recorded as a failure and skipped.
- **Logs** carry provider id, error class and status only, never a message. Every provider failing becomes one `ChatUpstreamError`, which the route maps to the existing 502 `dependency_failure`.
- **Tripwire.** `web/__tests__/ledgerChatFallback.test.ts` fails if a registered provider is not named in the notice.

## Options considered

### A. Ordered provider list, whole-turn restart, disclosure-gated (chosen)

| Dimension | Assessment |
|---|---|
| Complexity | Low: about 120 lines in one file plus a registry; `turn.ts` untouched |
| Cost | Nothing at launch; a failover re-spends the earlier attempt's tokens |
| Scalability | Fine for a handful of vendors; the time slice floor limits how many fit in one budget |
| Team familiarity | Reuses the existing `ChatModelClient` injection seam |

**Pros:** smallest change to tested code; vendor safety is enforced in code, not by memory; adapters stay the owner's simple code. **Cons:** a failover repeats the turn's earlier model calls; each adapter must translate to and from the Anthropic message shape.

### B. Switch vendors per model call, mid-turn

| Dimension | Assessment |
|---|---|
| Complexity | High: the conversation, including tool calls and results, must be translated between vendors mid-turn |
| Cost | Saves repeating calls that already succeeded |

**Cons:** mixed vendor formats inside one turn are a correctness risk the guard was not built for. Rejected.

### C. LangChain for every vendor, Anthropic included

| Dimension | Assessment |
|---|---|
| Complexity | Medium to high: `turn.ts` is rewritten onto LangChain's abstractions |
| Cost | A new dependency on the request path at launch |

**Cons:** rewrites the most-tested code for no launch benefit. Prompt caching and the low-effort setting are Anthropic-specific features the turn uses today. Rejected for now; it is reachable later through adapters.

### D. Keep the hard-wired Anthropic client

**Cons:** no room for the owner's vendors, which is the requirement.

## Trade-off analysis

A and B differ in where translation happens. A translates once per vendor, in that vendor's adapter, and keeps a whole turn inside one vendor, so the existing guard and narration checks still see a single-vendor conversation. B saves some tokens on failover but puts translation inside the turn loop, where a mistake would corrupt the conversation the guard reads. A's cost, repeated calls after a failure, only arises when a vendor is already failing, and the daily caps bound it. The disclosure check is what makes A safe to extend: a vendor added to the list but not to the notice is refused at run time and fails a test.

## Consequences

- **Adding a vendor is a consent event**, by design. It is named in `LEDGER_CHAT_NOTICE` and `LEDGER_CHAT_DISCLOSED_PROVIDERS`, the privacy page names it, `LEDGER_CHAT_NOTICE_VERSION` is bumped with a new hash in `web/__tests__/ledgerChatScope.test.ts`, and readers who opted in are asked again. Web and mobile ship together. The runbook is `docs/legal/owner-actions.md` section 8, step 9.
- **Adapters own their translation**, including dropping thinking blocks and passing `options.signal` so the time slice is honoured. The contract is documented at the top of `providers/langchain.ts`.
- **Logs name the serving provider** (`provider`, `failedProviders` on `api.ledger_chat.turn`), so vendor reliability is visible without logging content.
- **Revisit** if streaming answers are added, because a stream cannot simply be restarted on another vendor once text has reached the reader, or if more than about three vendors are queued, because the 8 s floor leaves no time for later ones.

## Action items

1. [x] `fallback.ts`, `providers.ts`, the empty `providers/langchain.ts` slot, and `LEDGER_CHAT_DISCLOSED_PROVIDERS` in `notice.ts`.
2. [x] Route uses `runWithFallback`; tests for failover, time slices, the disclosure check, the calm 502 and a missing key.
3. [ ] Owner: when adding a vendor, follow owner-actions §8 step 9, starting with the vendor's data and training terms.
4. [ ] Revisit this ADR before adding streaming.

## Amendment, 2026-11-06: six keys, free first, Anthropic removed

**Decision (owner, 2026-11-06):** Anthropic is removed. `PROVIDERS` is now a fixed table of six slots, tried in order: `GROQ_API_KEY_1..3` (free), `GEMINI_API_KEY_1..2` (paid, billing-linked project), `OPENROUTER_API_KEY` (paid, `data_collection: 'deny'`). The goal is zero cost first, with paid keys only as a last resort. Every vendor runs through one adapter, `providers/aiSdk.ts`: the Vercel AI SDK (`generateText`, tools without `execute`) on the inside, the Anthropic message shape on the outside. So `turn.ts`, its guards and `fallback.ts` are unchanged, and `@anthropic-ai/sdk` is used for types only. `providers/langchain.ts` is gone; the AI SDK took its place (option C's dependency concern applied to LangChain, not to a thin SDK adapter).

**Why this order and these terms** (checked 2026-11-06; re-check before each notice version):

- Free Gemini uses prompts to improve Google products, human reviewers may read them, and it is not allowed in apps used in the EEA, Switzerland or the UK. Gemini is therefore used only from a billing-linked project. Gemini limits are per project, not per key.
- Groq does not train on customer data and offers self-serve Zero Data Retention, even on the free tier, so it goes first. Its limits are per org.
- OpenRouter goes last, with data collection denied (in practice, paid models).

**Consequences:**

- The notice names Groq, Google and OpenRouter. `LEDGER_CHAT_NOTICE_VERSION` moves to 2026-11-06 (opted-in readers are asked again), and `LEGAL_VERSIONS` moves to 2026-11-06 with the privacy and terms text.
- Prompt caching and the effort setting no longer apply (the adapter drops `cache_control` and `output_config`).
- With the 8 s slice floor, about three slow attempts fit in the 25 s budget. Fast failures (429, 401) let all six run. A turn whose free keys hang may time out before it reaches a paid key; this was accepted.

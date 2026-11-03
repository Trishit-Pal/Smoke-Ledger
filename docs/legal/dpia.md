# Data protection impact assessment (GDPR Art 35)

Smoke Ledger. Controller: Trishit Pal. Written 3 November 2026. Status: **draft, awaiting owner sign-off** (see `owner-actions.md`).
Why a DPIA: the app processes data that reveals health (smoking, cravings, mood, notes) for EU readers, and sends some of it to an AI processor when the reader chooses. No supervisory authority has classified smoking logs; this assessment takes the cautious view that they are Art 9 data.

## 1. The processing

See `record-of-processing.md` for the full table. In short: an adult reader keeps a private journal of cigarettes, spend, mood and cravings on mobile or web. Data lives in Supabase (us-east-2). Web pages are served from Vercel. Optional analytics (off by default). Optional AI chat (off by default, web only) sends a question plus selected ledger data to Anthropic.

Scale: small, one-person operation. Nature of readers: adults only (18+ gate), some of whom may be trying to quit and may be in a vulnerable moment.

## 2. Necessity and proportionality

- **Purpose limitation.** Data is used to run the ledger. No advertising, no sale, no profile sharing.
- **Minimisation.** No location, contacts, advertising ID or device fingerprint. Name, date of birth and gender are the only identity extras; date of birth supports the 18+ gate.
- **Lawfulness.** Art 6(1)(b) for the service; Art 9(2)(a) explicit consent in its own unticked row. No pre-ticked boxes; declining the optional switches costs nothing.
- **Storage limitation.** Fixed periods in `retention-schedule.md`, enforced by a daily purge.
- **Rights.** Complete export, erase (keeps the account), delete, consent withdrawal, in-app. Name, DOB and gender are locked once set; correction goes through the Grievance Officer.
- **Processors.** Listed in `processors.md`. DPAs to be accepted by the owner.
- **Transfers.** US processors, under SCCs once the owner accepts them; see `transfer-impact-assessment.md`.
- **Transparency.** Privacy policy rewritten against the code; every data promise has a mechanism and a test (`src/tests/privacy-promises.test.ts`).

## 3. Risks to readers and how they are handled

Likelihood and severity are judged for the reader, not for the business. L = low, M = medium, H = high. "Residual" is after the measure.

| # | Risk | L | S | Measures in place | Residual | Further action |
|---|---|---|---|---|---|---|
| R1 | Another reader sees my entries (RLS failure) | L | H | RLS on every table, `auth.uid()` scoping, RLS integration test in CI, per-user cache tag, SECURITY DEFINER functions with fixed `search_path` and revoked grants | Low | Keep the RLS suite mandatory |
| R2 | Someone with my phone or screen sees my smoking | M | M | Discreet mode (aliases, hidden totals), optional app lock, masking at every render site | Low | None |
| R3 | Health data leaks through a leaked secret (service-role key, pepper) | L | H | Server-only keys, secret hygiene, pepper-hashed audit rows, runbook (`breach-runbook.md`) | Medium | Rotate keys on a schedule; owner to enable Supabase alerts |
| R4 | Health data sent to an AI processor without a real choice | L | H | Opt-in, off by default, fails closed, exact list of what is sent shown before the switch, label on answers, discreet mode drops notes, no storage by us, no training per Anthropic's commercial terms | Low | Re-check Anthropic retention wording (lawyer item) |
| R5 | Notes contain more than the reader meant to share with the AI | M | M | Notes clipped to 120 characters; the notice says notes are sent when a question needs recent entries; chat can be turned off and cleared | Medium | Consider a pre-send preview (decision O4 kept the current behaviour) |
| R6 | AI reply misleads or reads as medical advice | M | M | Replies come from tool results, numbers are checked against the data, a refusal for off-topic questions, "written by AI, not medical advice" label | Low | Keep the guard tests |
| R7 | Data stays after I ask to erase it | L | H | Erase covers product rows, profile fields, auth metadata keys, own error events, device stores; export is a superset of what erase removes; tests for both | Low | Only the disclosed 12-month erasure-proof row remains |
| R8 | Old logs pile up and become a liability | M | M | Daily purge of audit (12 mo), error (90 d), usage (12 mo) | Low | Confirm the cron job exists after migration |
| R9 | US government access to data held by US processors | L | M | SCCs, minimisation, TLS; see TIA | Medium | Owner decision O3 keeps us-east-2; revisit if the Framework falls and SCC risk rises |
| R10 | Minors use the app | L | H | 18+ gate with date of birth, enforced server-side by triggers; terms say adults only | Low | None |
| R11 | Consent is not valid (bundled, unclear, pre-ticked) | L | H | Separate unticked rows, plain wording, versioned stamps, re-consent forced on material change (O6), decline as easy as accept | Low | Lawyer to confirm clickwrap meets SPDI "in writing" |
| R12 | Account takeover reveals the ledger | M | H | Captcha, rate limits, re-auth for delete, optional app lock, leaked-password check (dashboard) | Medium | Offer stronger sign-in in future |
| R13 | Lost or stolen exported file | M | M | Export is the reader's own choice; mobile deletes its cache file on erase and delete; the policy says to keep it safe | Medium | Accepted |
| R14 | One person runs everything (key person, no 24/7 response) | M | M | Runbook, simple stack, managed services | Medium | Accepted; name a backup contact if the user base grows |
| R15 | Wrong cross-device state leaks data after sign-out | L | M | Lifecycle table clears device stores on sign-out, erase and delete; a test fails if a store has no clearer | Low | Fix the follow-ups in `owner-actions.md` (mobile routes behind the consent gate) |

No risk remains high after measures. R3, R5, R9, R12, R13 and R14 are medium and accepted with the further actions shown.

## 4. Need for prior consultation (Art 36)

No high residual risk remains, so prior consultation with a supervisory authority is not planned.

## 5. Consultation

Readers were not consulted directly. The owner should consider asking a few readers about the chat notice wording before wide release. The Grievance Officer's mailbox is the continuing channel.

## 6. Sign-off and review

| Item | Value |
|---|---|
| Prepared by | Drafted from the code on 3 November 2026 |
| Approved by | Pending, Trishit Pal |
| Date approved | Pending |
| Next review | On any new purpose, processor or data type; otherwise 3 November 2027 |

Open lawyer questions are in `owner-actions.md`.

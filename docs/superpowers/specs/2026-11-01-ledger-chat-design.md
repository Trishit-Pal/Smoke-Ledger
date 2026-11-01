---
title: Ledger Chat — a per-user reading companion for the ledger
date: 2026-11-01
status: draft-design
author: Trishit (with Claude)
related:
  - docs/spec/00-glossary.md
  - docs/spec/06-goals-insights.md
  - docs/spec/08-security-privacy.md
  - docs/legal/privacy-policy.md
supersedes: none
---

# Ledger Chat

Planned for the first release after v3.0.0. Nothing in this document is built yet;
it exists so the chatbot PR starts from settled ground.

## Intent

The user asks plain questions of **their own** ledger and gets honest answers:
"how did this week compare to last?", "what does this cost me per year?", "when do I
smoke most?". It is a reading companion, not a coach. Voice follows PRODUCT.md:
literary, calm, truthful. No nagging, no alarm, no streak-shaming, no gamified praise.

**Success:** the user trusts the answer because every number matches the screens they
already know. **Failure even if it works:** a confident wrong number, a lecture, or a
transcript that leaks totals to someone looking over their shoulder.

## Non-goals

- Medical advice, diagnosis, or cessation therapy. The medical disclaimer applies.
- Writing data. The chat never creates, edits, or deletes logs or goals.
- General-purpose assistant. Off-topic questions get a short, polite redirect.

## Trust reversal (must land before launch)

`docs/spec/00-glossary.md` ("Insight") promises insights are "never an LLM" and
calls the absence of any AI claim a trust decision. The chatbot PR must amend the
glossary, `06-goals-insights`, and the privacy policy so that:

1. Rules-based insights (`src/domain/insights.ts`) stay deterministic and unchanged.
2. Chat is a **separate, opt-in** surface, clearly labelled as using an AI model.
3. **Every number comes from a tool result, never from model prose.** Numbers render
   as tool-result rows (MetricRow) on the client; the model only narrates around them.

## Strategy (UX)

- **Outcome, not output.** The product outcome is "users read back what the ledger
  knows, and act on it." Start with a **learning goal**: find out which questions people
  actually ask of their own ledger. Don't set a usage target before that.
- **Opportunities**, in the user's words:
  - "I can't tell if I'm really cutting down."
  - "I don't know what this costs me in a year."
  - "I don't know when, or why, I smoke most."
- **The competitor is our own Trends screen.** The real alternatives to the chat are the
  Trends screen, mental arithmetic, and pasting numbers into a general chatbot. The
  chat earns its place only if *asking* beats *reading* for the person.
- **Riskiest assumption:** people would rather ask than read the charts (desirability).
  It ranks highest on importance and lowest on evidence.
- **Cheapest test (phase 0, no AI):** add an "Ask the ledger" run of 3–4 one-tap questions
  on Trends, answered by the deterministic tools below as MetricRows.
  - This needs no LLM, no consent change, and carries no DPDP or prompt-injection exposure.
  - Measure taps per weekly-active user, which questions get tapped, and how many people
    try to type a question we don't offer (a disabled "ask anything" field).
  - If the evidence holds, phase 1 adds free-form chat over the *same* tools. The phase-0
    UI and tools carry over unchanged.
- **Responsibility check (pre-mortem).** Three ways this could hurt someone:
  - an answer surfaces totals to someone looking over the user's shoulder;
  - a reply reads as judgement to someone who is trying to quit and has relapsed;
  - the model makes a health claim.
  Mitigations: discreet masking, PRODUCT.md voice rules in the system prompt, a
  no-medical-advice refusal, and the trust reversal below.
- **Metrics (HEART), only 2:**
  - Task success: does the answer match the screen? Spot-check that tool numbers equal
    the Trends numbers.
  - Retention: week-2 return rate of users who used it, against users who didn't.

## Architecture

- **Endpoint: one Next.js route handler**, `web/app/api/ledger-chat/route.ts`. This is a
  service-architecture call: it imports `src/domain` and `web/lib/server/data.ts`
  directly, the same code the screens use, so the numbers cannot drift. A Supabase Edge
  Function would need a second, Deno-side copy or bundling of `src/domain`. The browser
  and native app never hold a provider key.
- **Region: put compute next to the data.** Production Supabase is in **`us-east-2`**
  (`docs/spec/09-infra-ops.md`), so set `export const preferredRegion = 'cle1'` (or
  `iad1`) on this route only. Pinning to `bom1` would buy no residency, because the data
  already lives in the US, and it would add a cross-ocean round trip per tool query.
  Data residency is a **disclosure** in the privacy policy, not a region pin. If India
  residency is ever required, the database moves first.
- **Auth: one composite guard, fail closed.** Accept a cookie session (web, via
  `@supabase/ssr`) **or** an `Authorization: Bearer` Supabase JWT (native). Verify it
  with `supabase.auth.getUser(token)`, and deny if neither is present.
  `isSameOriginRequest` (`web/lib/security/sameOrigin.ts`) still applies to the cookie
  path (CSRF). The native path carries no Origin and is covered by the Bearer check.
  `user_id` comes only from the verified user and is never a tool argument.
- **Two clients, least privilege:**
  - Data reads use a client built with the **caller's JWT**, so RLS scopes every query.
  - The service-role client is used **only** for the `consume_rate_limit` RPC, which is
    granted to `service_role` only.
- **Model:** Claude via tool use (pick the current model at build time). No CSP change is needed
  because there are no browser-side calls.
- **Tools are the existing domain functions.** They are read-only and scoped to the
  caller. The model does no arithmetic.

| Tool | Source |
|---|---|
| period compare (this vs last week/month) | `periodWithTrend`, `totalsForWindow` — `src/domain/periodSummary.ts` |
| savings | `savedForWindow`, `savedAllTime` — `src/domain/periodSummary.ts`; `potentialSavings`, `actualSavings` — `src/domain/savings.ts` |
| spend outlook | `rollingAvgSpend`, `forecastMonthlySpend` — `src/domain/calc.ts`; **new** annualised helper (`rollingAvgSpend × 365`) with tests |
| when / why | `hourDistribution`, `dowDistribution` — `calc.ts`; `moodTriggerMatrix` — `src/domain/correlations.ts` |
| brands | `brandSpendMix` — `calc.ts` |
| goals | `evaluateGoal` — `src/domain/goals.ts` |
| existing insights | `generateInsights` — `src/domain/insights.ts` |

  Data comes from the `web/lib/server/data.ts` loaders and the `get_daily_summary` RPC.
  RLS still applies, because the server uses the caller's JWT, not the service role.

## Personalisation (per user)

- Money and calendar via `src/lib/regions.ts` and `ledgerMoney`: INR and IST, or EUR and
  the chosen EU country's time.
- Baseline, active goals, and onboarding answers shape which tools are suggested first.
- **Discreet mode:** when `discreet_mode` or `hide_totals_on_home` is on, transcript
  numbers are masked with `maskInr` / `isHomeTotalsHidden` (`src/lib/discreet.ts`)
  until tapped, the same as on Home.
- Suggested starter questions are derived from the user's own usage (`usage_events`):
  the screens they open most and the times they log.

## Open decision: what data reaches the model

| | A. Aggregates only (recommended at review) | B. Recent raw entries |
|---|---|---|
| Sent | Tool outputs only: totals, trends, distributions | Plus recent rows: times, triggers, moods, notes, brand names |
| Answer quality | Good for "how much / when / compared to" | Richer "why" answers |
| DPDP exposure | Minimal; derived data | Personal free text leaves the app |
| Prompt injection | None: no user free text in context | `notes` and custom brand names are user-authored text; mitigated below |

## Security & privacy obligations (either option)

- Per-feature consent, **off by default**, stored as a profile column or a `settings_kv`
  key. Bump `privacy` in `LEGAL_VERSIONS` only with the policy change.
- `docs/legal/privacy-policy.md`: name the provider, the region, and the retention /
  zero-data-retention terms.
- **No chat history stored by default.** If history is ever stored, add it to
  `export_account_data` and `erase_account_data`, and to `npm run verify:sovereignty`.
- Model output renders as **plain text**: no HTML and no markdown links, so the model
  cannot produce XSS or link phishing.
- Limits: per-user daily cap via `consume_rate_limit` (service role, server side) plus a
  global monthly budget kill-switch env var. Fail closed with a calm message.
- No PII in logs: do not send prompts or outputs to `error_events` / `audit_events`.
  Audit only "chat used".
- Review gates for the PR: `dpdp-sovereignty-reviewer`, `supabase-rls-auditor`,
  `free-tier-guardian`, `security-review`.

## Surfaces

- Web: a quiet "Ask the ledger" entry on Trends and the dashboard footer. It is a panel,
  not a floating bubble. Editorial type, hairlines, no avatar mascot.
- Native: the same server endpoint, presented as a sheet.
- Both must pass the v3 responsive spec, including 320px, landscape, and discreet mode.

## Left to the builder

Panel layout details, starter-question copy, streaming vs. single response, and the
exact tool JSON schemas.

---
title: Living Specification System ("The Mother Book")
date: 2026-06-18
status: approved-design
author: Trishit (with Claude)
related:
  - docs/architecture/
  - docs/auth/cross-device-email-links.md
  - docs/security/sovereignty-audit-2026-06.md
  - .claude/agent-memory/
supersedes: none
---

# Living Specification System — Design

## Why we're building this

Smoke Ledger India already has a lot of knowledge written down. Some of it lives
in `docs/` (auth notes, runbooks, the sovereignty audit). Some lives in private
agent memory. A lot of it lives only in the code and in the heads of whoever
last touched a feature. None of it is a single, trustworthy answer to the
question *"what does this product actually do, and what are the rules it must
never break?"*

That gap is the problem. When the truth is scattered, every change starts with
re-discovery, onboarding is slow, and it's easy to violate an invariant nobody
wrote down (the 18+ gate, the server-owned `mobile_changed_at`, the
service-role-only RPCs).

So we're building one authoritative, living specification — a "mother book" —
that describes everything the product does, stays accurate as the product
changes, and is cheap enough to maintain that keeping it current is the path of
least resistance rather than a chore. From here on, the spec leads and the code
follows: spec-driven development.

The design has one guiding constraint that shapes every decision below: **keep
it accurate with the least possible token cost.** A spec that's expensive to
update will rot. So the whole system is built around touching only what changed.

## What we're building, in plain terms

Four pieces that work together:

1. **The spec tree** — a set of human-readable Markdown files under `docs/spec/`,
   organized by product domain, with a small machine-readable manifest that
   records which code each section is responsible for.

2. **`/spec-generate`** — a one-time (and occasionally re-run) builder that reads
   the real code, the live database, and the tests, then writes the whole spec
   from scratch. It fans out across domains so it finishes quickly and can resume
   if a step drops mid-run.

3. **`/spec-update`** — the part that keeps the book alive. After a change, it
   looks at the diff, figures out which sections that diff touches, and rewrites
   only those sections to match the new reality. Nothing untouched is even
   opened.

4. **A CI drift guard** — a small script that notices when code under a section's
   watch has changed but the section wasn't refreshed, and flags it. This is the
   safety net that makes "always accurate" something we can actually rely on,
   without forcing an intrusive always-on process.

A fifth piece — making our skills and agents measurably improve over time — is
real and wanted, but it's deliberately a *separate, later* effort. More on that
under Phasing.

## The spec tree

```
docs/spec/
  SPEC.md                 # the front door: product overview, how to read this, conventions
  00-glossary.md          # the words we use: log, baseline, streak, milestone, mood, pepper…
  01-architecture.md      # the monorepo, the layers, how data flows through them
  02-data-model.md        # tables, columns, CHECK constraints, RLS, triggers, RPCs (mirrors LIVE DB)
  03-auth.md              # signup, login (password + magic link), cross-device links, callbacks, reset
  04-identity-profile.md  # identity fields, the 18+ gate, immutability rules, mobile rate-limit
  05-logging.md           # cigarette logs, rate limiting, brands and variants
  06-goals-insights.md    # goals, insights, mood/trigger correlations, health milestones
  07-celebrations.md      # birthdays, streak tiers, the character, confetti, reduce-motion
  08-security-privacy.md  # RLS model, SECURITY DEFINER hygiene, DPDP export/erase, audit pepper
  09-infra-ops.md         # Supabase / Vercel / EAS free-tier limits, CI gates, deploy, runbooks
  _meta/
    spec-manifest.json    # the map: each section → the code globs it owns + when it was last verified
    CHANGELOG.md          # append-only history: every spec change, when, and the commit behind it
```

The split is by **domain**, not by file type, because that's how people think
about the product and how features actually land. A single feature usually
touches one or two domains, which is exactly what keeps updates small.

Where good docs already exist — `docs/auth/cross-device-email-links.md`,
`docs/security/sovereignty-audit-2026-06.md`, the runbooks — the spec **links to
them rather than copying them.** Two copies of a fact is two facts that can
disagree. The mother book is the index and the authority; the existing deep-dive
docs remain the long-form detail.

## The core idea: a manifest that maps code to spec

Everything cheap about this system comes from one small file, `_meta/spec-manifest.json`.
For each section it records the **source globs** that section is responsible for,
plus the commit at which it was last verified:

```jsonc
{
  "sections": [
    {
      "id": "auth",
      "file": "03-auth.md",
      "sources": [
        "src/lib/authCallback.ts",
        "src/tests/authCallback.test.ts",
        "app/auth/**",
        "app/(auth)/**",
        "web/app/auth/**",
        "web/app/(auth)/**"
      ],
      "last_verified_commit": "20331e5",
      "status": "current"
    }
    // … one entry per section
  ]
}
```

Each section file repeats the essentials in its own frontmatter, so a section is
self-describing even if you open it alone:

```yaml
---
section: auth
sources:
  - src/lib/authCallback.ts
  - app/auth/**
  - web/app/(auth)/**
last_verified_commit: 20331e5
status: current   # current | drifting | stale
---
```

This map is what lets `/spec-update` and the CI guard answer "which sections does
this diff touch?" by matching changed file paths against the globs — no guessing,
no reading the whole book. It's the difference between an update that costs three
sections and one that costs the entire product.

## How every section reads (and the "humanify" rule)

Two things are fixed for every section: a **shape** and a **voice.**

The shape is one template, so the book is predictable:

- **Purpose** — what this part of the product is for, in a sentence or two.
- **What the user experiences** — the behavior, described the way a user would
  notice it, not the way the code implements it.
- **How it works** — the key files, functions, and data flow, with `file:line`
  references so a reader can jump straight to the code.
- **Invariants** — the rules that must never break. These are load-bearing: the
  18+ gate, `mobile_changed_at` being server-owned, the service-role-only RPCs.
- **Edge cases & gotchas** — the surprising bits, leap-year birthdays, NULL-DOB
  legacy accounts, Hermes and the Supabase CJS shim.
- **Tests** — what proves this works, and where those tests live.
- **Open gaps** — what's missing, partial, or known-wrong. Honesty here is a
  feature; it's where the mobile birthday-caption bug gets recorded.

The voice is the **humanify rule**, and it is a requirement, not a preference:

> Write for a human. Plain, clear, a little warm. Full sentences and short
> paragraphs where they read better than bullets; bullets only when the content
> is genuinely a list. Explain *why*, not just *what*. No hedging, no filler, no
> stilted AI cadence ("it is important to note that…"). A new engineer should be
> able to read a section top to bottom and simply understand it.

Because the template and this rule live in the spec system itself, every future
`/spec-update` sub-agent reads them before writing, so the style holds
mechanically on every change instead of depending on anyone remembering it.

## `/spec-generate` — building the book the first time

A multi-agent **Workflow** (orchestration we've explicitly opted into for this
work). It runs one sub-agent per domain section. Each sub-agent is grounded in
**real evidence** — it reads the source globs for its section, the relevant
tests, and the live database schema (via memory and the Supabase MCP) — and then
writes its section against the template and the humanify rule. A final step
writes `SPEC.md`, the glossary, and the manifest.

Two properties matter:

- **Grounded, not guessed.** A section about the data model is written from the
  live schema, not from a migration file that might have been edited after it was
  applied. (That exact trap is a known gotcha in this repo.)
- **Resumable.** If a step drops on a transient API error — which is precisely
  what just killed the feature workflow earlier today — the run resumes and
  replays completed sections from cache instead of starting over and re-spending
  their tokens.

This is the one genuinely large token spend in the whole system, and it happens
rarely (initial build, occasional full rebuild). Everything after it is cheap.

## `/spec-update` — keeping the book alive

The everyday path, run at the end of a piece of work, before a commit, or any
time on demand. It does this:

1. Take the diff — `git diff <base>...HEAD`, or the staged diff for a pre-commit
   run — and list the changed files.
2. Match those files against the manifest's source globs to find the affected
   sections. Usually one to three.
3. For each affected section *only*, hand a sub-agent that section plus the
   changed code, and have it rewrite just that section to match the new reality,
   keeping the template and the voice.
4. Bump `last_verified_commit` for those sections and append a CHANGELOG entry
   describing the actual change.
5. Re-read each rewritten section for leftover placeholders or contradictions
   before finishing.

The cost is bounded to *changed sections × changed files.* An unchanged section
is never opened. This is the mechanism that delivers "auto-update accurately,
with the exact changes" while respecting the token budget — the two requirements
that usually pull against each other.

## The CI drift guard

`scripts/spec-drift-check.mjs` is the cheap insurance. For each section, it asks:
have any files under this section's globs changed since the section's
`last_verified_commit`, without the section being refreshed? If so, it marks the
section **drifting** and reports it.

For now this is a **warning**, not a hard block — we're pre-launch and a blocking
gate that fights rebases would cost more than it's worth. The moment the product
is live and the spec is load-bearing, the same script can be promoted to a
blocking check by flipping one flag. It gets unit tests: fixture repo states in,
expected drift flags out.

## Phasing (agile, and risk-isolated)

**Phase 0 — the one open bug.** The mobile `MilestoneCelebration` shows
"0-day streak." for a birthday instead of "Happy Birthday!". The spec **documents
this honestly as an open gap** and the bug is fixed through the normal feature
flow (the paused cross-device-auth workflow), not as a side effect of writing
docs. We don't mix "describe what is" with "change what is."

**Phase 1 — this cycle.** Build the spec tree, the manifest, `/spec-generate`,
`/spec-update`, and the drift guard; generate the full v1 mother book across all
domains. The first real exercise of `/spec-update` is this very branch's diff
(cross-device auth + DOB celebrations), which doubles as its acceptance test.

**Phase 2 — its own spec → plan → build, later.** The skill/agent **eval and
learning loop**. The shape: each skill and agent gets an append-only,
size-capped learnings file in `.claude/agent-memory/`; a `/skill-eval` harness
runs a skill against a small fixture set, scores the output, and proposes
refinements to the skill's prompt or description. Because self-modifying prompts
can degrade *silently*, the guardrails are part of the design from day one: every
proposed change is diffed and human-approved, learnings are append-only and
capped so they can't grow without bound, and the evals gate against regressions.
This is wanted and approved — it's sequenced after the foundation so a
higher-risk, self-modifying system isn't bolted onto the same increment as the
docs it would describe.

## Standing practices we adopt now (no build required)

- **Agile increments.** Each sub-project gets its own spec → plan → small PR.
  No big-bang merges.
- **Token discipline.** Section-scoped updates, parallel fan-out, never re-reading
  unchanged context, resumable workflows. This is a design value, not an
  afterthought.
- **Severity / Risk / Impact up front.** Before any significant action, and on
  every PR, a one-line note: how bad is it if this is wrong, what could go wrong,
  and how much does it actually help. (This design doc carries one below.)

## Risk, severity, impact

**Severity: Low.** This is documentation and developer tooling. It never touches
production data, the database, auth, or money. The worst realistic failure is an
inaccurate paragraph, which is cheap to correct.

**Risk: Low-to-Medium.** Two real risks. First, the upfront generation token
spend — mitigated by making the generator resumable and running it rarely.
Second, `/spec-update` missing a section because a glob didn't match a moved
file — mitigated by the CI drift guard, which catches exactly that and is itself
tested.

**Impact: High.** It becomes the backbone for spec-driven development,
dramatically faster onboarding, and safer change, because the rules that must
never break are finally written down in one place and kept current.

## Testing

- `spec-drift-check.mjs` gets unit tests over fixture repo states.
- `/spec-update` is validated against this branch's real diff as its first run,
  and the output is checked by hand for accuracy and voice.
- Generated content is cross-checked against the live database and the existing
  test suite — the spec must agree with both.

## Decisions made, and what's out of scope

**Decided:** in-repo modular `docs/spec/`; on-demand `/spec-update` (not an
always-on hook); full-product v1; the eval/learning loop included but sequenced
to Phase 2; the one open bug documented-as-gap and fixed via the feature flow;
human voice enforced through the template.

**Out of scope for Phase 1:** the eval/learning loop (Phase 2); promoting the
drift guard to a blocking gate (post-launch); auto-generated diagrams; any change
to product code beyond the separately-tracked birthday-caption fix.

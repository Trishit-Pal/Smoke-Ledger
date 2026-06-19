<!-- Every docs/spec section file follows THIS shape and voice. Generators and
     updaters MUST read this file before writing. -->

---
section: <id>
sources:
  - <glob>          # the code this section is responsible for
last_verified_commit: <sha|null>
status: current     # current | drifting | stale | manual
---

# <Human Title>

## Purpose
One or two sentences: what this part of the product is for.

## What the user experiences
The behavior as a user would notice it — not the implementation.

## How it works
Key files, functions, and data flow, with `path:line` references.

## Invariants
The rules that must never break. Be specific and load-bearing.

## Edge cases & gotchas
The surprising bits and the traps.

## Tests
What proves this works, and where those tests live.

## Open gaps
What is missing, partial, or known-wrong. Be honest here.

<!-- VOICE (required): Write for a human. Plain, clear, a little warm. Full
sentences and short paragraphs where they read better than bullets; bullets only
when the content is genuinely a list. Explain why, not just what. No hedging, no
filler, no stilted AI cadence. A new engineer should read a section top to bottom
and simply understand it. -->

---
name: spec-generate
description: Build (or fully rebuild) the docs/spec mother book from the real codebase. Runs a resumable multi-agent workflow, one grounded agent per section. Use for the initial spec, or a periodic full refresh.
---

# Generating the Spec

This is the heavy, rare operation. It writes the whole book from real evidence.

## Steps
1. Confirm with the user — this fans out one agent per section and spends real tokens.
2. Run the workflow:
   ```
   Workflow({ name: "spec-generate" })
   ```
3. When it returns, write each returned section's `markdown` to its `docs/spec/<file>`.
4. Run `/spec-update` semantics for stamping: set every section's `last_verified_commit`
   to `git rev-parse --short HEAD` in both the files and `docs/spec/_meta/spec-manifest.json`,
   status `current` (glossary stays `manual`).
5. Run `npm run spec:drift` — expect "Spec is current."
6. Hand the generated sections to the user for a voice + accuracy review before committing.

## Note
The workflow is resumable: if a transient API error drops a section, re-run with
`resumeFromRunId` and completed sections replay from cache.

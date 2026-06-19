# Spec Changelog

Append-only. Newest first. One entry per `/spec-update` or `/spec-generate` run.

<!-- Format: ## <date> — <commit> ; then a bullet per section changed. -->

## 2026-06-19 — 996dae7 (acceptance test: /spec-update main → feat/living-spec-system)
- auth: sections already current; cross-device authCallback priority order (token_hash first) correctly reflected
- identity-profile: sections already current; DOB/18+ gate, immutability trigger, Feb-29 edge case all accurate
- security-privacy: sections already current; error_events constraint confirmed live, finding marked resolved
- architecture, data-model, celebrations, infra-ops: verified by drift check — no code changes since generation
- No rewrites needed: spec was generated from HEAD at time of commit 996dae7

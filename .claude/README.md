# `.claude/` — committed agents & skills

Repo-scoped Claude Code assets for shipping Smoke Ledger India. These are
version-controlled so every contributor (and CI/agent run) shares the same
review gates and release process. They encode this repo's real model — RLS
grants, DPDP erase/delete semantics, free-tier limits — so findings are
specific, not generic.

## Sub-agents (`.claude/agents/`)

| Agent | When to use | Tools |
|-------|-------------|-------|
| [`supabase-rls-auditor`](agents/supabase-rls-auditor.md) | After any change to `supabase/migrations`, RPCs, or RLS policies. Confirms tenant isolation, RPC grant scope, and `SECURITY DEFINER` `search_path=''` hygiene. Knows which advisor WARNs are accepted-by-design. | Read, Grep, Glob, Bash |
| [`dpdp-sovereignty-reviewer`](agents/dpdp-sovereignty-reviewer.md) | When a change touches account deletion, data export, audit/error logging, or consent. Guards DPDP rights + the `compliance.delete` audit-immutability invariant. | Read, Grep, Glob |
| [`free-tier-guardian`](agents/free-tier-guardian.md) | When a diff adds queries, fetches, dependencies, or per-request work. Flags Supabase egress (the 5 GB first cliff), Vercel 10 s timeout, and EAS build pressure. | Read, Grep, Glob, Bash |

Invoke with the Agent tool (`subagent_type: <name>`), or let the
`release-preflight` skill route the diff through them.

## Skills (`.claude/skills/`)

| Skill | Purpose |
|-------|---------|
| [`release-preflight`](skills/release-preflight/SKILL.md) | The full pre-ship gate: typecheck → tests (root Jest + web Vitest) → build → lint → `verify:backend` → `verify:sovereignty` → `preflight:launch` → live `get_advisors`, plus the operator dashboard checklist and the review-agent gate. Run before any release. |

## Related repo automation (not in `.claude/`)

- `scripts/verify-backend.mjs` — RPC grants, anon-revocation, edge-fn presence (`npm run verify:backend`).
- `scripts/verify-sovereignty.mjs` — anon default-deny on every tenant table + data-rights RPC refusal (`npm run verify:sovereignty`).
- `scripts/preflight-launch.mjs` — dashboard auth-config audit + real auth loop (`npm run preflight:launch`).
- `npm run preflight:all` — chains the two read-only verifiers.
- `docs/deployment/production-ops-checklist.md` — operator (dashboard) launch blockers.
- `docs/security/sovereignty-audit-2026-06.md` — point-in-time live sovereignty audit.

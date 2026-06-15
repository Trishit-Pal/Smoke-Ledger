---
name: release-preflight
description: >-
  Use when preparing to ship Smoke Ledger India to real users — runs the full
  pre-ship gate (typecheck, tests, build, lint, backend + sovereignty
  verification, launch preflight, live security advisors) and the operator
  dashboard checklist, then routes the diff through the repo's review agents.
  Invoke before tagging a release, promoting to production, or merging a
  launch-blocking PR.
---

# Release Preflight (Smoke Ledger India)

Ship only when every gate below is green. This skill is the single source of
truth for "is it safe to put in front of real users." It chains the repo's
existing automation — it does not replace it.

**Announce at start:** "I'm using the release-preflight skill to gate this
release." Then create a TodoWrite with one item per numbered gate and work them
in order. Stop and report at the first hard failure; do not "mostly pass."

## Gates (run in order; each must pass before the next)

| # | Gate | Command | Pass criterion |
|---|------|---------|----------------|
| 1 | Root typecheck | `npx tsc --noEmit` | exit 0 |
| 2 | Web typecheck | `cd web && npm run typecheck` | exit 0 |
| 3 | Root tests (Jest) | `npx jest` | all pass (skips allowed) |
| 4 | Web unit tests (Vitest) | `cd web && npm run test` | all pass |
| 5 | Web build | `cd web && npm run build` | build succeeds |
| 6 | Root lint | `npm run lint` | exit 0 |
| 7 | Web lint | `cd web && npm run lint` | exit 0 |
| 8 | Backend verify | `npm run verify:backend` | all checks pass |
| 9 | Sovereignty verify | `npm run verify:sovereignty` | anon default-deny holds on every tenant table; data-rights RPCs + delete-account reject anon |
| 10 | Launch preflight (**staging**) | `npm run preflight:launch` | all blocker checks pass — point at STAGING, it creates+deletes a throwaway user |
| 11 | Live security advisors | Supabase MCP `get_advisors(security)` + `get_advisors(performance)` | no NEW advisor beyond the known-accepted set (see below) |

Gates 8–11 need Supabase env: `NEXT_PUBLIC_SUPABASE_URL` (or `SUPABASE_URL` /
`E2E_SUPABASE_URL`) and the matching anon key. Gate 10 additionally accepts
`SUPABASE_SERVICE_ROLE_KEY` (full confirm→login→cleanup loop) and
`SUPABASE_ACCESS_TOKEN` + `SUPABASE_PROJECT_REF` (dashboard auth-config audit).

**Known-accepted advisors (NOT blockers — do not fail the gate on these):**
- `rls_enabled_no_policy` on `public.rate_limit_counters` (intentional,
  service-role-only).
- `authenticated_security_definer_function_executable` WARNs on the 11
  signed-in API RPCs (by design — see the `supabase-rls-auditor` agent).
- `auth_leaked_password_protection` WARN **only if** the operator checklist item
  below is still open; once enabled this clears.
- Unused-index INFOs on `cigarette_logs` (no data yet pre-launch).

Any advisor outside that set is a blocker.

## Operator dashboard checklist (config, not code — verify before launch)

These live in dashboards, not the repo. The product is **not shippable** until
all are done. Full detail in `docs/deployment/production-ops-checklist.md`.

- [ ] **Custom SMTP** configured (built-in mailer silently throttles
      signup/reset email — top launch blocker).
- [ ] **Leaked-password protection** enabled (Auth → Security → HaveIBeenPwned).
- [ ] **`ALLOWED_ORIGINS`** set on BOTH edge functions (`delete-account`,
      `audit-record`) — a custom domain not in the allowlist makes delete-account
      return 403.
- [ ] **Site URL + redirect allowlist** include `/auth/callback`.
- [ ] **Captcha (Turnstile)** site key set as `NEXT_PUBLIC_TURNSTILE_SITE_KEY`
      (optional but recommended; app-layer prechecks are fail-open).
- [ ] **`AUDIT_PEPPER`** set (same value on both edge functions).
- [ ] **`SUPABASE_SERVICE_ROLE_KEY`** server-only on Vercel — never
      `NEXT_PUBLIC_*`.
- [ ] **SMS OTP (`NEXT_PUBLIC_PHONE_OTP_ENABLED`)** stays **OFF** unless msg91
      quotas are verified (SMS-bomb / cost risk).

## Review-agent gate (run on the release diff)

Before merging, route the diff through the repo's committed agents and fix any
HIGH/CRITICAL finding:
- **`supabase-rls-auditor`** — if the diff touches `supabase/`, RLS, or RPCs.
- **`dpdp-sovereignty-reviewer`** — if it touches deletion, export, audit/error
  logging, or consent.
- **`free-tier-guardian`** — if it adds queries, fetches, dependencies, or
  per-request work.

## Stop conditions

- Any gate 1–11 fails → STOP, report the failing gate + output, do not ship.
- A review agent returns CRITICAL/HIGH → fix, re-run the affected gates, re-review.
- An operator checklist item is open → the build may pass CI, but it is **not**
  shippable to real users; say so explicitly.

# Production ops checklist

Run after linking Supabase (`supabase link`) and before treating production as ready.

> **Automated gate:** the [`release-preflight` skill](../../.claude/skills/release-preflight/SKILL.md) runs the full pre-ship suite (typecheck, tests, build, lint, `verify:backend`, `verify:sovereignty`, `preflight:launch`, live advisors) and routes the diff through the repo's review agents. The latest point-in-time data-sovereignty audit is at [docs/security/sovereignty-audit-2026-06.md](../security/sovereignty-audit-2026-06.md). This checklist covers the **dashboard/config** blockers those scripts cannot change for you.

## 0. Dev environment note (C4 audit)

- If your local Supabase DB was initialized before the C4 audit fix, `user_profiles.baseline_per_day` may still be `double precision`. Run `ALTER TABLE public.user_profiles ALTER COLUMN baseline_per_day TYPE numeric(5,2);` or reset the local DB with `supabase db reset`.

## 1. Database migrations

```bash
npm run db:push
npm run verify:backend
```

Confirm migration `20260521000000_audit_export_ops.sql` is applied (export keyset pagination, audit RPC revoke, erase anonymization).

Confirm migration `20260601000000_catalog_2026_refresh.sql` is applied (2026 MRP updates, `refresh_seed_prices_from_catalog` RPC). After push, run `npm run verify:backend`. Optional SQL spot-check in Supabase SQL Editor:

```sql
SELECT proname FROM pg_proc
WHERE proname IN ('sync_default_brand_catalog', 'refresh_seed_prices_from_catalog');

SELECT name, avg_price_inr FROM smoke_seed.brand_catalog WHERE sort_order IN (1, 9) ORDER BY sort_order;
-- Expect 2026 MRPs (e.g. 230, 460) per docs/catalog/2026-cigarette-mrp-sources.md
```

## 2. Supabase Auth (Dashboard → Authentication)

- [ ] **Confirm email** enabled for signup
- [ ] **Password reset** enabled
- [ ] **URL configuration** — Site URL + redirect URLs include `/auth/callback` (see [auth-email-delivery.md](./auth-email-delivery.md))
- [ ] **Custom SMTP** configured for reliable mail (Resend or similar) — built-in mailer is rate-limited
- [ ] **Leaked password protection** — Dashboard → Authentication → Security → Password Strength → enable "Check against HaveIBeenPwned.org" (currently flagged as WARN by security advisors)
- [ ] Optional: **Captcha** (Cloudflare Turnstile) — set site key in Vercel as `NEXT_PUBLIC_TURNSTILE_SITE_KEY`
- [ ] Optional: **`REAUTH_WINDOW_MIN` on Edge Functions** — `delete-account` defaults to 15 min. If users report spurious "sign in again" prompts, raise this env var (e.g. `30`). Do not remove it — the gate blocks stolen-refresh-token account deletion.

Full email troubleshooting: [docs/deployment/auth-email-delivery.md](./auth-email-delivery.md)

## 3. Edge Function secrets (Dashboard → Edge Functions → Secrets)

Set on **both** `delete-account` and `audit-record`:

> **Audit rate limit (M4):** `audit-record` defaults to **10 events/min per user**. To raise it for a specific deployment set `AUDIT_RATE_LIMIT_MAX` (e.g. `30`) in the edge function's secrets. Violations are logged to stdout as `audit_rate_limit_exceeded` with a hashed user id.

| Secret | Purpose |
|--------|---------|
| `SUPABASE_SERVICE_ROLE_KEY` | Admin insert / delete (auto when linked) |
| `SUPABASE_ANON_KEY` | JWT verification |
| `ALLOWED_ORIGINS` | Comma-separated web origins (no `*` in production) |
| `AUDIT_PEPPER` | Same random secret on both functions; hashes user id in audit/error retention. **Rotation procedure:** [docs/runbooks/audit-pepper-rotation.md](../runbooks/audit-pepper-rotation.md) (M1) |

OAuth CSRF model (M6): the web auth callback relies on Supabase SDK's PKCE flow rather than explicit OAuth `state` validation. Rationale and verification steps at [docs/architecture/oauth-csrf.md](../architecture/oauth-csrf.md).

Deploy order:

```bash
npm run db:push
npm run functions:deploy:all
npm run verify:backend
```

Deploy **edge functions before** client builds that stop calling `record_audit_event` RPC directly.

## 4. Web (Vercel / hosting)

- [ ] `NEXT_PUBLIC_SUPABASE_URL`
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- [ ] `SUPABASE_SERVICE_ROLE_KEY` (server-only, **not** `NEXT_PUBLIC_*`) — required by `/api/auth/login` and the account-deletion edge function
- [ ] `NEXT_PUBLIC_SUPPORT_EMAIL` (legal pages)

**Session cookies:** Password login uses `POST /api/auth/login` so httpOnly auth cookies respect remember-me. Default is session-only (logout when browser closes). Users who check “Keep me signed in” get persistent auth cookies via `sl_remember_me=1`.

## 5. Mobile (Expo)

- [ ] `EXPO_PUBLIC_SUPABASE_URL`
- [ ] `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- [ ] `EXPO_PUBLIC_WEB_BASE_URL` (legal links)
- Production Expo **web** is blocked — users must use the Next.js app for auth.

## 6. CI integration test setup (mandatory — not optional)

The `rls-integration` CI job is the sole automated guard against cross-tenant
data leakage in RLS policies, and it must run on every PR.

It runs against a **throwaway local Supabase started inside the job**
(`supabase start`), built from the PR's own migrations. There is **nothing to
set up**: no hosted CI project, no `E2E_*` secrets, no manual `db:push`, no
test users to create (two are signed up per run with random passwords).

Notes:

- The local stack uses the Supabase CLI's public demo keys. That is safe only
  because the stack exists solely on the CI runner for the length of the job.
  **Never** point `E2E_SUPABASE_URL` at a real project from a PR workflow.
- Edge functions are not served locally, so `verify-backend.mjs` skips the
  deployed-functions check in CI. Verify those with `npm run verify:backend`
  against production after `npm run functions:deploy:all`.
- If `[auth.email] enable_confirmations` is ever turned on in
  `supabase/config.toml`, the user-provisioning step fails loudly (it expects
  a session back from sign-up).
- Branch protection (making `rls-integration` a required check) needs a public
  repo or GitHub Pro; the free plan on a private repo returns 403. Until then
  the job is advisory at merge time — check it is green before merging.

## 6b. Export behaviour (H2 audit note)

`exportAccountData()` paginates the `export_account_data` RPC up to **200 pages × 5 000 rows = 1 000 000 rows** before stopping. This covers roughly 270 years of use at 10 sticks/day and is considered sufficient for all realistic cases.

The returned `AccountExportPayload` now carries a `truncated: boolean` field:

- `false` — the RPC signalled `hasMore: false`; the export is complete.
- `true` — the safety cap was reached before the RPC signalled done; the file covers only the most recent rows. Both the mobile (Alert) and web (inline warning text) UIs surface a human-readable notice when this happens; the download still proceeds.

No action required at deployment. If a user reports a truncated export, advise them to contact support for a manual data extract via the service-role key.

## 7. Staging walkthrough

1. Signup → confirm email → complete onboarding in order (no URL skipping)
2. Quick log + export data
3. Erase data (profile reset, audit anonymized)
4. Delete account (auth removed)

## 8. Optional error monitoring (Sentry / GlitchTip)

Client errors are captured in `error_events` via `src/lib/logger.ts` and web/mobile error boundaries. For richer stack traces and alerting, optionally add [Sentry](https://sentry.io) (free tier) or self-hosted [GlitchTip](https://glitchtip.com):

- Web: `@sentry/nextjs` with DSN in `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN`
- Mobile: `@sentry/react-native` with `EXPO_PUBLIC_SENTRY_DSN`
- Keep PII out of breadcrumbs; rely on existing redaction in audit/logger paths

## Erase vs delete

- **Erase data**: product tables wiped; auth kept; audit rows anonymized (`user_id` null, hashed id in props)
- **Delete account**: auth user removed; cascades product data; compliance delete event retained
- **Audit retention (H1)**: `error_events` rows with `category = 'compliance.delete'` survive both operations. Three layers enforce tamper-resistance: (1) RLS INSERT policy blocks authenticated users from writing compliance.delete rows; (2) no DELETE/UPDATE policy for authenticated role (RLS default-deny); (3) DB CHECK constraint `error_events_compliance_delete_null_user_check` ensures `user_id IS NULL` whenever `category = 'compliance.delete'`. Only service-role (edge functions) may insert these rows.

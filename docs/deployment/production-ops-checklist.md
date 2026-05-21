# Production ops checklist

Run after linking Supabase (`supabase link`) and before treating production as ready.

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
- [ ] Optional: **Captcha** (Cloudflare Turnstile) — set site key in Vercel as `NEXT_PUBLIC_TURNSTILE_SITE_KEY`

Full email troubleshooting: [docs/deployment/auth-email-delivery.md](./auth-email-delivery.md)

## 3. Edge Function secrets (Dashboard → Edge Functions → Secrets)

Set on **both** `delete-account` and `audit-record`:

| Secret | Purpose |
|--------|---------|
| `SUPABASE_SERVICE_ROLE_KEY` | Admin insert / delete (auto when linked) |
| `SUPABASE_ANON_KEY` | JWT verification |
| `ALLOWED_ORIGINS` | Comma-separated web origins (no `*` in production) |
| `AUDIT_PEPPER` | Same random secret on both functions; hashes user id in audit/error retention |

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

## 6. Optional CI E2E secrets (GitHub)

For RLS integration job:

- `E2E_SUPABASE_URL`
- `E2E_SUPABASE_ANON_KEY`
- `E2E_USER_A_EMAIL` / `E2E_USER_A_PASSWORD`
- `E2E_USER_B_EMAIL` / `E2E_USER_B_PASSWORD`

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

# Web-First Shipment Checklist

## 1. Environment and Secrets

- [ ] Supabase staging and production projects are configured.
- [ ] Web env vars set in deployment platform:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `NEXT_PUBLIC_SUPPORT_EMAIL`
- [ ] Edge Function secrets set:
  - `SUPABASE_URL`
  - `SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `ALLOWED_ORIGINS`

## 2. Database and Functions

- [ ] Run migrations in order:
  - `20250426120000_initial_schema.sql`
  - `20260504000000_enhancements.sql`
  - `20260519100000_hardening_and_compliance.sql`
  - `20260519130000_brand_catalog_expansion.sql`
- [ ] Deploy `delete-account` Edge Function.
- [ ] Verify RPCs:
  - `record_audit_event`
  - `erase_account_data`
  - `export_account_data`
- [ ] Run Supabase Security Advisor and resolve critical findings.

## 3. Auth and Redirect Configuration

- [ ] Supabase Auth site URL set to production web origin.
- [ ] Redirect URLs include:
  - `/auth/callback`
  - `/login`
- [ ] Recovery redirects include:
  - `/reset-password`
- [ ] Email confirmation and password reset are enabled.
- [ ] OTP providers are configured as needed:
  - email OTP/magic-link enabled
  - SMS OTP provider configured for phone authentication

## 4. App Validation

- [ ] Root checks: `npm run typecheck`, `npm test`, `npm run lint`.
- [ ] Web checks:
  - `npm run typecheck` (in `web/`)
  - `npm run lint` (in `web/`)
  - `npm run build` (in `web/`)
  - `npm run test:e2e:smoke` (in `web/`)
- [ ] Optional authenticated E2E:
  - set `E2E_LOGIN_EMAIL` and `E2E_LOGIN_PASSWORD`
  - run `npm run test:e2e` in `web/`

## 5. Legal and Policy Surface

- [ ] Public pages are reachable:
  - `/privacy`
  - `/terms`
  - `/support`
- [ ] Metadata and app copy match actual behavior (no unsupported medical claims).
- [ ] Age 18+ confirmation and consent capture are functioning.

## 6. Observability and Recovery

- [ ] Audit and error event tables are receiving data.
- [ ] Backup and restore workflow tested in staging.
- [ ] Incident runbook includes account deletion/export troubleshooting.

## 7. Rollback Plan

- [ ] Keep last known good web deployment artifact/version.
- [ ] Use additive migrations only in production windows.
- [ ] If rollout fails:
  - rollback web deployment first
  - disable new feature paths via routing/config
  - avoid destructive DB rollback unless explicitly validated

# What the app actually does with personal data (code audit, HEAD 5f672c0, 2026-11-03)

Read-only audit of the Smoke Ledger repo. Paths relative to the repo root; `mig/` = `supabase/migrations/`.

## Key facts for the legal analysis
- Controller / Data Fiduciary: an individual in India (owner's answer, 2026-11-03). App is LIVE with real users. Data hosted on Supabase (AWS us-east-2, Ohio, USA). Users in India and EU countries (EUR + EU country picker). Adults 18+ only (DOB hard gate, `src/domain/age.ts` MIN_AGE 18; trigger `mig/20260616181124:144-156`).
- Processors / recipients: Supabase (all data, USA); Vercel (hosting, request logs, Data Cache of brand names); Anthropic (opt-in chat: context block, question plus prior turns, tool results incl. up to 200 recent entries with mood/trigger/craving/notes; discreet mode aliases brands and drops notes); MSG91 (SMS OTP, phone); Cloudflare Turnstile (bot check); email OTP provider (Supabase SMTP or Resend — not named in policy); Expo EAS Update (OTA checks, IP/device — not named). No ad/analytics SDKs; fonts self-hosted.
- Consents stored: age_confirmed_at, terms_version, privacy_version, health_disclaimer_version, data_processing_consent_at (user_profiles); settings_kv consent.analyticsOptIn, consent.ledgerChatOptIn. Analytics off until opt-in (verified). Chat opt-in fails closed (verified).

## Policy promises that are NOT true today
1. HIGH — Erase does not clear name, DOB, gender from `auth.users.raw_user_meta_data` (signup copies them there: `web/app/(auth)/signup/page.tsx:309-313,388`, `app/(auth)/signup.tsx:80-81`); likely also in the session JWT/cookie. Export omits them. Contradicts privacy page:46.
2. HIGH — No retention/purge for `audit_events`, `error_events`, `usage_events` (only rate_limit_counters purged at 2 days, and only if pg_cron exists). Contradicts "security logs kept only as long as required" (privacy:48). Backups/PITR undisclosed; backup-restore checklist item unchecked.
3. HIGH — `error_events.message` stores raw `error.message` (≤500 chars, `src/lib/logger.ts:12-16,47-54`), never redacted, kept after erase/delete, not exported. Contradicts "sanitized diagnostics".
4. MED — Legal version bump does not force re-consent (`hasRequiredConsents` checks non-null only, `src/lib/onboardingSteps.ts:92-100`, `web/middleware.ts:178-208`); deliberate per spec 08. App is live, so material changes need notice + re-consent.
5. MED — No in-app withdrawal of core consents (`consent_revoked` audit type never emitted); identity fields (name, DOB, gender) immutable (`mig/20261030:51-60`) — "correct" right only partly honoured.
6. MED — Export omits auth.users (email, phone, created/sign-in timestamps), signup metadata, own error_events, anonymised audit rows.
7. MED — Vercel Data Cache of brand names (service-role, 600 s, `web/lib/server/data.ts:331-397`) not busted on Erase or region reset; persists after Delete until TTL.
8. MED — Mobile Delete does not cancel local notifications or delete the export JSON in `cacheDirectory`; mobile sign-out keeps PIN hash/lock state.
9. LOW — Edge rate-limit keys use raw `user:<uuid>`; device leftovers (first-suggestion key, theme, remember-me cookie); erase leaves country/currency/mobile_changed_at and sets deleted_at while the account stays.
10. LOW — Policy omits email provider and Expo EAS; says Anthropic receives "each question" but prior turns are re-sent; no grievance officer/DPO/EU representative named; no breach-notification, transfer-mechanism or retention-period statements anywhere; analytics opt-out does not delete past usage_events.

## Verified true today
No ad networks / no sale; RLS per user; analytics opt-in; chat opt-in and fail-closed; questions not stored server-side; chat transcript cleared on sign-out/erase/delete/turn-off (web); erase wipes product tables; delete removes auth identity and cascades (requires sign-in within 15 min); hosted in us-east-2; 18+ enforced; export/erase/delete in settings; privacy contact support@smokeledger.app (copy only).

## Client storage map (summary)
Web localStorage: chat transcript `ledger-chat:v1:<uid>` (cleared on sign-out/erase/delete/discreet), `goals.firstSuggestion.dismissedOn:<uid>` (never cleared), `sl.*` lock state, theme, catalog version. Cookies: Supabase auth token (session unless remember-me), `sl_remember_me` 1 year. Next Data Cache: brands per user 600 s. No service worker. Mobile: SecureStore session + PIN/lock; AsyncStorage theme, catalog, first-suggestion; in-memory 90-day ledger; export file in cacheDirectory (never deleted); local notifications.

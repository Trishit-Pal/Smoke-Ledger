# Retention schedule

Smoke Ledger. Owner decision O5: fixed periods, enforced by a daily purge. No deletion for inactivity.
The facts below are read from `src/lib/privacy/retention.ts`, `supabase/migrations/20261104110000_retention_purge.sql` and `src/lib/privacy/lifecycle.ts`. If the code changes, change this file.

## Server

| Record | Where | Kept for | Ends by | Notes |
|---|---|---|---|---|
| Ledger: logs, brands and variants, goals, price entries, reminders, settings, facts seen | Supabase Postgres | While the account exists | Erase, delete, or the reader editing or removing a row | No inactivity deletion. A free-tier Supabase project pauses when idle; that is not deletion |
| Profile: name, date of birth, gender, country, currency, preferences, consent stamps and versions | `user_profiles`, and name / DOB / gender copies in `auth.users` metadata | While the account exists | Erase (profile fields cleared, including the mobile-change stamp; country and currency kept as regional settings; metadata keys removed) or delete | Name, DOB and gender are locked once set (O7); erase still clears them |
| Sign-in record: email, phone, password hash | `auth.users` | While the account exists | Delete account | Erase alone keeps the sign-in record, because the reader keeps the account |
| Audit events | `audit_events` | 12 months | Daily purge; prior rows are anonymised on erase | Exports, erasures, consent changes. Properties are allowlisted and size-capped. `consent_accepted` rows are purged at 12 months even while the account is live; proof of consent then rests on the profile's consent timestamps and accepted versions (lawyer item 11 in `owner-actions.md`) |
| Erasure proof (`account_data_erased` row) | `audit_events` | 12 months | Daily purge | Disclosed retained record of erasure (GDPR Art 5(2) and 17 accountability). Holds a pepper-hashed pseudonym, not the user id |
| Error events | `error_events` | 90 days | Daily purge; a reader's own rows are also deleted on erase | Text is redacted when written. `compliance.delete` tombstones carry no user id |
| Usage events (analytics, opt-in only) | `usage_events` | 12 months | Daily purge; deleted at once when the reader turns analytics off | Nothing is written without consent |
| Rate-limit counters | `rate_limit_counters` | About 2 days | Own daily job (migration 20261030000000) | Keys are hashed |
| Brands cache | Vercel Data Cache, tag `brands:<uid>` | 600 seconds | Expiry, or revalidated on write, erase and reset | Revalidated rather than dropped, to protect free-tier egress |
| Database backups | Supabase | Per Supabase plan | Provider schedule | Owner to confirm the exact window in the dashboard and state it in the policy |
| Platform request logs | Vercel, Supabase | Provider defaults | Provider schedule | The app logs no personal data in them; IP addresses appear in platform logs. Owner to confirm the windows |
| Chat question and reply | Groq, Google or OpenRouter API (the one that answers) | Groq: none (Zero Data Retention). Google: a limited time for misuse detection (paid terms). OpenRouter: none (logging off; hosts that store data refused) | The vendor | We store none. Not used for training. Exact wording is a lawyer item |

## Daily purge job

- Function: `public.purge_expired_records()`, SECURITY DEFINER, empty `search_path`, execute granted to `service_role`.
- Schedule: pg_cron job `purge-expired-records`, `37 3 * * *` (03:37 daily, database time). The rate-limit purge is a separate job at 03:17.
- Deletes: `audit_events` older than 12 months, `error_events` older than 90 days, `usage_events` older than 12 months. That includes `consent_accepted` rows; the consent itself stays recorded on the profile (`*_consent_at` timestamps and `terms_version` / `privacy_version` / `health_disclaimer_version`) for as long as the account exists.
- If pg_cron is not installed the migration only warns. `npm run verify:backend` prints the manual check: `SELECT jobname, schedule FROM cron.job WHERE jobname = 'purge-expired-records';`. CI's `scripts/sql/smoke.sql` fails when pg_cron is installed and the job is missing.

## Device

From `src/lib/privacy/lifecycle.ts`. Events: sign-out (session ends for any cause), erase, delete, withdraw (the reader resolves it as erase or delete), discreet mode on.

| Store | Platform | Cleared on |
|---|---|---|
| Auth session cookie (`sb-*`) | Web | Sign-out, delete |
| Remember-me cookie | Web | Delete |
| Chat transcript (localStorage) | Web | Sign-out, erase, delete, withdraw, discreet on |
| Chat dock minimised flag (`sl_chat_dock_minimised`, not personal) | Web | Kept; cleared only when the reader clears site data |
| Chat transcript (memory only) | Mobile | Gone when the Ask screen closes; never written to storage |
| First-suggestion key | Web, mobile | Sign-out, erase, delete, withdraw |
| Lock keys | Web (localStorage), mobile (SecureStore) | Erase, delete, withdraw |
| Brands cache | Web | Erase, delete, withdraw |
| Session (SecureStore) | Mobile | Sign-out, delete |
| Delete re-sign-in record (SecureStore, expires after 10 minutes, used once) | Mobile | Sign-out, erase, delete, withdraw |
| In-memory ledger | Mobile | Sign-out, delete |
| Scheduled notifications | Mobile | Erase, delete, withdraw |
| Export file (cache) | Mobile | Erase, delete, withdraw |
| Theme, brand catalog | Web, mobile | Kept: device preferences, nothing personal |

The reader can also clear the web chat transcript with "Clear conversation".

## How it is enforced

- `src/tests/retention-purge.test.ts` fails if the migration intervals drift from `RETENTION`.
- `src/tests/privacy-promises.test.ts` checks that each published data promise has a mechanism.
- A lifecycle test fails if a store is added without a clearer.

## Open point for a lawyer

DPDP Rule 8(3) asks for a one-year floor on some logs. Content is erased on request at once; only the 12-month audit and erasure-proof tier is kept. Whether that reconciles with GDPR Art 17 and the Rule is flagged in `owner-actions.md`.

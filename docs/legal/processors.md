# Processors and sub-processors

Smoke Ledger. Controller: Trishit Pal. Written 3 November 2026 from the code and config in this repo.
**Status column:** "to accept (owner)" means the owner has not yet accepted the DPA or SCCs. Nothing here claims a DPA is signed. URLs marked "verify" were not opened in this session; confirm the current link when accepting. Do not publish "we have a DPA with X" until the status is changed here by the owner.

| Processor | What it does | Personal data it sees | Where | Transfer basis to rely on | DPA / SCC link to accept | Status |
|---|---|---|---|---|---|---|
| Supabase | Postgres, auth, edge functions, pg_cron | Everything in the ledger, profile, sign-in record, audit, error and usage rows | AWS us-east-2 (Ohio), project `Smoke-Ledger` | EU SCCs Modules 2 and 3 in the Supabase DPA (March 2026 version); breach notice within 48 hours | https://supabase.com/downloads/docs/Supabase+DPA+260317.pdf (the page at supabase.com/legal/dpa has the current form; verify) | to accept (owner) |
| Vercel | Hosts the Next.js web app and its Data Cache | Requests and responses in transit, IP addresses in platform logs, cached brand and variant lists (`brands:<uid>`, 600 s) | United States (functions pinned near the database; `preferredRegion = cle1` on the chat route) | SCCs and/or Data Privacy Framework in Vercel's DPA (not confirmed from a primary source) | https://vercel.com/legal/dpa (verify) | to accept (owner) |
| Anthropic | Writes "Ask the ledger" replies, only when the reader turns chat on | The question, earlier turns, tool results (aggregates; up to 200 recent entries from the last 30 days with dates, quantities, triggers, moods, cravings, brand names and notes of up to 120 characters each; discreet mode swaps brand names for aliases and sends no notes) | United States | SCCs Modules 2 and 3 in the Anthropic DPA, part of the Commercial Terms; no training on customer content; 48-hour breach notice | https://www.anthropic.com/legal/data-processing-addendum and https://www.anthropic.com/legal/commercial-terms | to accept (owner). Also confirm the API account is under Commercial Terms |
| MSG91 | Sends SMS one-time codes for phone login (Indian DLT route), called from the `send-sms-otp` edge function | Phone number and the code | India | Phone login sits behind the `NEXT_PUBLIC_PHONE_OTP_ENABLED` switch (`docs/auth/msg91-setup.md`). The route is an Indian DLT route for Indian numbers, so it is not an EU transfer for readers in India. Confirm no EU reader's number goes through it before enabling | https://msg91.com/privacy-policy (no public DPA found; ask MSG91 for one) | to accept (owner) |
| Cloudflare Turnstile | Bot check on sign-in, sign-up and reset when `NEXT_PUBLIC_TURNSTILE_SITE_KEY` is set | Browser signals, IP address; the token goes to Supabase Auth to verify | Global | Cloudflare customer DPA with SCCs and the Data Privacy Framework | https://www.cloudflare.com/cloudflare-customer-dpa/ (verify) | to accept (owner) |
| Email provider for sign-in emails | Sends sign-up confirmation, magic link and reset email through Supabase Auth custom SMTP | Email address, link or code | Depends on provider | Provider DPA | The repo documents Resend (`docs/deployment/auth-email-delivery.md`): https://resend.com/legal/dpa (verify). The owner must confirm which SMTP provider the dashboard actually uses; if none is set, Supabase's built-in mailer sends and Supabase's DPA covers it | to accept (owner) |
| Expo / EAS | Builds the mobile app | No reader data at runtime. The app has no `expo-updates` dependency, and reminders are scheduled locally on the device with `expo-notifications` (no push token is requested). Expo holds the developer's account and build artifacts only | United States | None needed for reader data today | https://expo.dev/privacy (verify the DPA link if push or OTA updates are ever added) | not a processor of reader data today; revisit if push or updates are added |
| Apple, Google (app stores) | Distribute the app | Store-side account and install data are theirs, as independent controllers | Global | Their own terms | Store developer agreements | n/a |

## Not used

No advertising, analytics SDK, crash-reporting SDK, social login, payment provider or marketing email tool appears in `package.json` or `web/package.json`; `src/tests/privacy-promises.test.ts` fails if a tracking package is added. Product analytics is first-party, opt-in, and stored in `usage_events` in our own Supabase project.

## How to keep this current

- Before adding any new service that sees reader data, add a row here, accept its DPA, and add it to `record-of-processing.md` and the policy.
- Once a year, check each vendor's sub-processor list and the status of the Data Privacy Framework (case C-703/25 P is pending). Supabase and Anthropic rely on SCCs rather than the Framework, which is the safer mechanism.
- Save a copy of each accepted DPA outside the repo and record the date in the Status column.

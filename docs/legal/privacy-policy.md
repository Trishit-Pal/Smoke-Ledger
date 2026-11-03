# Smoke Ledger Privacy Policy

Effective date: 2026-11-02

> Mirror of `web/app/privacy/page.tsx`. The page renders operator facts from `src/lib/legalEntity.ts`, retention periods from `src/lib/privacy/retention.ts` and the promises from `src/lib/privacy/promises.ts`; the values below are those constants today. `src/tests/web-privacy-page.test.ts` fails if a page heading is missing here.

## Who is responsible
- Smoke Ledger is run by Trishit Pal, an individual based in Kolkata, India: the controller under EU law and the Data Fiduciary under Indian law. Contact: support@smokeledger.app.
- Written to the stricter of the GDPR and India's DPDP Act, 2023 (main duties expected from May 2027). Until then, the IT Act and its 2011 sensitive-personal-data rules apply.
- EU representative (GDPR Art 27): being appointed. Name and address appear once the appointment is signed (`EU_REPRESENTATIVE` in `legalEntity.ts`). Until then, write to support@smokeledger.app.
- Grievance Officer: Trishit Pal, support@smokeledger.app. Reply within 30 days.

## Our data promises
- We never sell your data. The app runs no advertising and no third-party tracking code.
- Only your account can read your ledger. The database checks every request against who is signed in.
- Usage analytics stay off until you turn them on. Turning them off deletes the events already recorded.
- Nothing is sent to the AI service unless you have turned Ask the ledger on.
- We keep no chat questions or replies on our servers. The conversation stays in your browser.
- Erase removes your ledger, and your name, date of birth and gender, from every place we keep them, including the sign-in record.
- Delete account erases your data first, then removes your sign-in identity.
- Records are deleted on a fixed daily schedule: security records after 12 months, error reports after 90 days, usage events after 12 months.
- Error reports have email addresses, phone numbers and other identifiers removed before they are stored.
- Your export holds your account record, profile, consents, ledger, settings, usage events, error reports and the security records linked to you.
- Smoke Ledger is for adults. The 18+ check runs in the app and again in the database.

Each promise has a mechanism checker in `src/tests/privacy-promises.test.ts`.

## What we collect
- **Account:** email address, or mobile number for phone sign-in; password, stored by our database host only as a one-way hash; when the account was created and last signed in.
- **Identity:** name, date of birth, gender (given at sign-up; date of birth backs the 18+ check).
- **Profile:** country (and the currency and time zone that follow), optional mobile number and place, daily baseline, preferences such as discreet mode and theme.
- **Ledger (health information):** each entry's date and time, quantity, brand and variant, price, and optionally trigger, mood before and after, craving, situation and note; brands and prices you add; goals; reminders; facts seen.
- **Consents:** accepted versions of the terms, policy and medical notice and when; health-data consent time; analytics and Ask the ledger choices.
- **Records:** security records (some with a one-way hash of the IP address, never the address); redacted error reports; usage events only with analytics on (no entry content, brand names or prices); rate-limit counters keyed by a one-way hash.
- Ask the ledger questions and replies are not stored on our servers.

## Why we use it, and the legal basis
- Ledger: explicit consent, GDPR Art 9(2)(a) and 6(1)(a), on its own unticked line. Without it there is no ledger.
- Account and identity (sign-in, 18+ check): necessary for the service, GDPR Art 6(1)(b). Email or mobile, name, date of birth and gender are needed to open an account; everything else is optional.
- Usage analytics: consent, Art 6(1)(a); off unless turned on.
- Ask the ledger: explicit consent, Art 9(2)(a), because it sends health information to the AI provider.
- Security records, error reports, rate limits, form checks: legitimate interest in security and accountability, Art 6(1)(f) and 5(2).
- India: consent given on accepting the policy, for these purposes only.

## Who receives it
- **Supabase** (US, AWS us-east-2, Ohio): database and sign-in; everything except the chat conversation.
- **Vercel** (US): runs the web app; request logs under its own retention; brand names cached for up to 10 minutes (`BRANDS_CACHE_TTL_SECONDS`), cleared on erase and delete.
- **Anthropic, PBC** (US): Ask the ledger answers, only when turned on (see the AI section).
- **MSG91** (India): SMS one-time codes for phone sign-in; receives the number and the code.
- **Cloudflare Turnstile**, when switched on: checks sign-in and sign-up forms; sees browser and IP address.
- **Resend** (`emailDeliveryProvider`): sign-in, confirmation and password-reset emails; receives the email address and the email.
- **Expo (EAS):** builds the mobile app. The app sends no data to Expo: no push service, no over-the-air updates; reminders are local.
- Used only to run the service; written data-processing agreements being confirmed with each. Nothing shared with advertisers or data brokers. Disclosure to authorities only when the law requires.

## Transfers outside India and the EU
- Database, Vercel and Anthropic are in the US, so data is processed outside India and the EEA.
- EU transfers rely on the Commission's Standard Contractual Clauses used in the providers' data-processing terms; the agreements and a transfer assessment are being put in place. Copy on request.
- Indian law currently restricts no country for these transfers.

## How long we keep it
| Data | Kept |
|---|---|
| Ledger, profile, settings | Until you erase or delete. No deletion for inactivity. |
| Security records (incl. the erasure/deletion record: hashed identifier, date and, while the account exists, a link to it) | 12 months, then purged daily |
| Error reports | 90 days |
| Usage events | 12 months, or until analytics is turned off |
| Rate-limit counters | about 2 days |
| Ask the ledger conversation | In your browser until cleared |
| Brand cache (Vercel) | up to 10 minutes |
| Host backups | Under the host's own schedule; never used to bring back erased data |

When DPDP applies, its one-year processing-record rule is met by the security records above, not the ledger.

## Your rights, and how to use them
- Copy: Settings › Export your data (JSON).
- Correct: profile details in Settings (name, date of birth and gender: see below).
- Erase: Settings › Erase all log data (keeps the login). Country and currency stay: regional settings the app needs to work, not part of the ledger. Delete: Settings › Delete account permanently (needs a sign-in within 15 minutes).
- Withdraw consent: next section. Object, restrict or anything else: write to us.
- Free; requests answered within one month, grievances within 30 days; we may ask you to write from the account email.
- From DPDP commencement: nominate someone to act for you after death or incapacity, by writing to us.

## Withdrawing consent
- Usage analytics off: collection stops and past usage events are deleted.
- Ask the ledger off: nothing more is sent and the browser conversation is cleared; Anthropic's copy ages out on its schedule.
- Health data: Settings › Withdraw consent ends in erase (keep login) or delete, the reader's choice; export offered first.
- Withdrawal does not affect earlier processing and is as easy as giving consent.

## Complaints
- Grievance Officer first: Trishit Pal, support@smokeledger.app, reply within 30 days.
- EU: the data protection authority where you live, work, or where the problem happened. Free.
- India: once DPDP applies (expected May 2027), the Data Protection Board of India for unresolved grievances.
- Nothing in the terms waives the right to complain to a regulator.

## The AI feature, and no automated decisions
- Web only, off until turned on; answers from an Anthropic model, labelled "Written by AI"; can be wrong; not medical advice.
- Our server reads up to 2,000 entries from the last 90 days (`GOAL_WINDOW_LOG_LIMIT`) and daily totals for up to the past year to compute figures.
- Anthropic receives: the question; up to 10 earlier turns (`CHAT_HISTORY_MAX_TURNS`), both sides; a context line (date, time zone, currency, locale, baseline, days with entries, kind and state of active goals, discreet flag); and requested lookup results (totals, comparisons, savings, spend outlook, peak hours and weekdays, mood/trigger pairings, brand share, goal progress and targets, rules-based insights).
- When needed: up to 200 entries from the last 30 days (date, hour, quantity, trigger, moods, craving, situation, brand, first 120 characters of the note).
- Discreet mode: aliased brands, no notes; a brand typed into a question is sent as typed. Name, date of birth, gender, email, phone and place are never sent.
- Anthropic's commercial terms say it may not train its models on this data. Anthropic says it deletes API inputs and outputs within 30 days, with exceptions (usage-policy flags, legal requirements). No shorter period has been arranged.
- The conversation stays in the browser, under the chat consent, until Clear conversation, turning the feature off, sign-out, erase, delete or turning discreet mode on.
- No decisions with legal or similarly significant effect. Goal suggestions and insights can be ignored.

## On your device
- Web: session sign-in cookies; Remember me (opt-in) adds a cookie that keeps you signed in. Browser storage: chat conversation, dismissed goal suggestion, app-lock state, theme, brand catalogue.
- Mobile: secure storage for session and app-lock PIN; app storage for theme, catalogue and dismissed suggestion; locally scheduled reminders; export file in the cache after an export.
- Sign-out clears the session, conversation and dismissed suggestion. Erase/delete also clear app-lock state, cancel reminders and delete the export file; delete also removes the Remember me cookie. Theme and catalogue stay (not personal).
- No advertising or tracking cookies.

## Security, and if something goes wrong
- Encrypted connections; encryption at rest by the host; per-account row-level security; rate-limited sign-in; hashed identifiers in counters and security records; redacted error reports; recent sign-in needed to delete; optional app lock.
- Breach: contain at once; where the GDPR requires, notify the authority of each EU country where affected people live within 72 hours, and tell affected people without undue delay when the risk is high; once DPDP applies, tell every affected person and the Data Protection Board.

## Adults only
- 18+ only; date of birth checked at sign-up and again by the database. Accounts found to belong to someone under 18 are deleted with their data.

## Name, date of birth and gender
- Locked once set, because the 18+ check rests on the date of birth and a changeable one would let the check be stepped around.
- If one is wrong: write to us and we correct it by hand (owner-actions §9). Erase clears all three (with the ledger), but there is no screen to enter them again; corrected details after an erase are also recorded only by writing to us. Erase and Delete remove them everywhere, including the sign-in record.

## Languages
- English now. Hindi is being prepared; other Eighth Schedule languages on request.

## Versions and changes
- The date at the top is this version; we record which version you accepted and when.
- A change that matters is explained, with reasons, and must be accepted again on the next visit; until then the app shows only the consent screen, Settings (where you can export or delete) and the legal pages. Declining leaves export and delete open. Earlier versions on request.

# Owner actions

What only the owner can do before and after the privacy and terms V3 release. Tick each box when done. Nothing here has been applied to the live Supabase project, pushed, or deployed by the agent that wrote it (Ruling Q3).
Written 3 November 2026.

## 1. Database and deploy order

Order matters. Do these in sequence. **Do not deploy the web or mobile code until step 5.** Every live reader has no health-data consent yet (`health_data_consent_at` is NULL, deliberately not backfilled), so the re-consent screen fires the moment the new code is live, whatever `LEGAL_VERSIONS` says. Readers must only ever be asked to accept the final policy: the one that names the EU representative, under the bumped versions.

- [ ] **1. Check the `auth.users` privilege.** Why: erase updates `auth.users`. If the privilege is missing, erase fails outright (the whole transaction rolls back), and delete-account fails too, because it runs erase first. Where: Supabase SQL editor.
  ```sql
  SELECT has_table_privilege('postgres','auth.users','UPDATE');
  ```
  It must return `true`. If it does not, stop and fix the privilege first.
- [ ] **2. Apply the migrations, in this order**, to the live project **and to the CI Supabase project** (`web/e2e/_helpers/seed.ts` writes `health_data_consent_at`, so every seeded e2e user fails without it). Where: `npm run db:push` or the dashboard. Review each first.
  1. `20261103000000_adaptive_goals.sql`, if not already applied. The export function copies forward from it.
  2. `20261104100000_erase_auth_metadata.sql`: erase clears name, date of birth and gender from the sign-in record and deletes the reader's own error events.
  3. `20261104110000_retention_purge.sql`: the daily purge for audit (12 months), error (90 days) and usage (12 months) records.
  4. `20261104120000_export_complete.sql`: the export includes the sign-in record and error events (version 3).
  5. `20261104130000_health_consent.sql`: adds `user_profiles.health_data_consent_at` (the new middleware reads it and breaks for everyone without it) and `delete_my_usage_events` (analytics off deletes past usage events).
  6. `20261104140000_erase_profile_leftovers.sql`: erase also clears `mobile_changed_at` (the 30-day mobile lock) and old `deleted_at` stamps.

  Then **confirm the purge job exists.** Run `npm run verify:backend`, then check by hand:
  ```sql
  SELECT jobname, schedule FROM cron.job WHERE jobname = 'purge-expired-records';
  ```
  Expect `37 3 * * *`. If pg_cron is missing, enable it in Database, Extensions, and re-run the migration. Why: without it, nothing purges and the retention promise is false.
- [ ] **3. Confirm `AUDIT_PEPPER` is set** for the edge functions (`supabase secrets list`), **then redeploy `audit-record` and `delete-account`**. Why: `delete-account` now hashes its rate-limit keys with the pepper and imports `_shared/redact.ts`; deployed without the secret, keys are hashed with an empty pepper. Where: `supabase functions deploy audit-record delete-account`. If phone sign-in is switched on, also deploy `send-sms-otp`. Redeploy `audit-record` whenever its allowlist gains an event.
- [ ] **4. Release gate: sign the EU representative, fill `legalEntity`, bump `LEGAL_VERSIONS`.** See section 2. Nothing in step 5 happens before this.
- [ ] **5. Only then deploy web and mobile together, both carrying the same `LEGAL_VERSIONS`.** Why: a mobile build is compiled with its own `LEGAL_VERSIONS` and there are no over-the-air updates. The app treats a stored version as current when it is the same or newer, so an older build no longer loops, but an older build will not ask its readers to accept the new version either; the web will. Ship the mobile build that carries the bump at the same time as the web, never ahead of it (a mobile build ahead of the bump would ask readers to accept the old policy). Expect every existing reader to see the re-consent screen once. That is intended and honest; do not backfill the health consent.

## 2. Release gate (the EU representative)

- [ ] **Sign an EU Art 27 representative** (decision O1). Why: GDPR applies to EU readers and an Art 27 representative is required. Where: a commercial representative service; no sourced pricing was found, so get quotes. Choose a Member State where you have the most readers.
- [ ] **Fill the representative fields in `src/lib/legalEntity.ts`.** Why: the policy names the representative once signed. A one-line change.
- [ ] **Task 12 then bumps `LEGAL_VERSIONS`.** Why: re-consent must not fire before the policy names the representative. Migrations and edge functions (section 1, steps 1 to 3) can go first; the web and mobile code cannot, because re-consent fires on deploy (section 1, step 5).

## 3. Processors

- [ ] **Accept the DPA and SCCs for each processor** and save a copy of each. Why: the policy must not claim DPAs that are not accepted. Where: the links in `processors.md` (Supabase, Vercel, Anthropic, MSG91, Cloudflare, the email provider; Expo only if push or updates are added). Update the Status column when done.
- [ ] **Confirm which SMTP provider sends sign-in email** (Resend is documented, but only the dashboard shows what is live) and fill the row in `processors.md`.
- [ ] **Check Supabase backup and platform log windows** and put the real numbers in `retention-schedule.md` and the policy.
- [ ] **Confirm the Anthropic API account is under the Commercial Terms** and the DPA applies.
- [ ] **Register the CERT-In point of contact only if the lawyer says it applies** (see section 7, item 4).

## 4. Stores and publishing

- [ ] **Google Play Data safety form.** Declare: health and fitness info (smoking log, mood, cravings, notes), personal info (name, email, phone, date of birth, gender), app activity (only if analytics is on). Data encrypted in transit, deletion request available in app. No data sold or shared for ads. Why: Play rejects mismatches. Where: Play Console, App content.
- [ ] **Apple privacy nutrition labels.** Same categories; "Data linked to you" for health and fitness, contact info, user content; "used for app functionality" only; no tracking. Why: required for App Store review. Where: App Store Connect, App Privacy.
- [ ] **Store wording: "not a medical device".** Put one calm line in each store description and the in-app health disclaimer: Smoke Ledger records your own habits, does not diagnose or treat, and is not a substitute for a clinician. Why: avoids medical-device classification claims and matches the terms.
- [ ] **No tobacco brand logos, pack imagery or promotional pricing in store listings or screenshots.** Why: COTPA s.5 bans advertising that promotes tobacco use. Check the screenshots.
- [ ] **Age rating.** Set it to adults only (18+) consistent with the in-app gate.

## 5. Languages and accessibility of the notice

- [ ] **Hindi notice and a way to request other Eighth Schedule languages before about 13 May 2027** (decision O10). Why: DPDP requires notice in English or any Eighth Schedule language on request. Where: add a Hindi privacy page and a "request a language" line at support@smokeledger.app; diarise the date.

## 6. Sign-offs

- [ ] **Read and sign `dpia.md`** (fill approver and date).
- [ ] **Read and sign `transfer-impact-assessment.md`.**
- [ ] **Review `record-of-processing.md`** and send a copy to the EU representative once signed.
- [ ] **Fill the contacts block in `breach-runbook.md`** (representative, processor security contacts, the three largest EU supervisory authorities).
- [ ] **Set a diary reminder** for the yearly review of all seven documents (3 November 2027) and for any new processor.

## 7. Questions for a lawyer

Take this list to one short consultation. None of these blocks the release; the code takes the cautious reading in each case.

1. **DPDP start date.** Computed as about 13 May 2027, not stated in the Rules. Confirm the exact day.
2. **Are smoking logs "health" data?** Under GDPR Art 9 and SPDI "health condition". No regulator or court has decided. The app treats them as health data.
3. **SPDI "consent in writing" through a clickwrap.** Does an in-app tick satisfy Rule 5(1)?
4. **CERT-In 6-hour reporting** (decision O11). Does it cover an individual who runs an app? If yes, add it to the runbook and register a contact.
5. **DPDP Rule 8(3) one-year floor versus erasure on request.** The app erases content at once and keeps only the 12-month audit and erasure-proof tier. Is that enough, and is it consistent with GDPR Art 17?
6. **Anthropic retention wording.** The official page says up to 30 days; some secondary sources say 7 days since September 2025. Confirm and fix the notice text. Also check whether feedback features extend retention (the app does not use any).
7. **EU AI Act Art 50 and India's 2026 IT Rules on synthetically generated information.** Is the "written by AI" label on chat answers enough?
8. **Intermediary status and consumer-law applicability** for a free app run by an individual (IT Act s.2(1)(w), Consumer Protection Act 2019, dark-pattern guidelines).
9. **ePrivacy and localStorage.** Does the first-party chat transcript need more than the chat consent?
10. **SCC fit** for a non-EU controller subject to GDPR under Art 3(2), and whether the DPF challenge (C-703/25 P) changes the transfer plan.
11. **Proof of consent after 12 months.** The daily purge deletes `consent_accepted` audit rows at 12 months while the account is live. Proof of consent then rests on the profile's consent timestamps and accepted versions. Is that enough under GDPR Art 7(1) and DPDP s.6(10)?

## 8. Code follow-ups from review (not legal)

- [ ] **`ImportEnvelopeSchema` cannot parse a real export.** Fix before any import UI is built. Until then, export is one-way and the policy must not promise import.
- [ ] **Mobile `app/log/new` and `app/goals/new` are not behind the consent gate.** The guard belongs in the root `app/_layout.tsx`, so every route is covered. Fix before the mobile release, since a reader who has not accepted the new consent could otherwise reach them by deep link.

## 9. Runbook: a reader asks to correct their name, date of birth or gender

The app locks these once they are set (decision O7). The privacy policy says a reader can write to us to correct them, so this is how.

1. **Check it is the account holder.** Reply only to the email address on the account (`SELECT id, email FROM auth.users WHERE email = '<from address>';`). If the request came from another address, ask them to write from the account email. Never act on a phone call or a forwarded message.
2. **Check a new date of birth still passes 18+.** If the corrected date makes the reader under 18, do not apply it. Delete the account and its data instead (the policy's "Adults only" rule), and tell them why.
3. **Make the change in the Supabase SQL editor, in one transaction.** The identity trigger lets the update through only while `app.erasing` is on for this transaction. Change both places, so the profile and the sign-in record agree:
   ```sql
   BEGIN;
   SET LOCAL app.erasing = 'on';
   UPDATE public.user_profiles
      SET full_name = '<name>', date_of_birth = '<YYYY-MM-DD>', gender = '<allowed value>'  -- only the fields asked for
    WHERE id = '<user id>';
   UPDATE auth.users
      SET raw_user_meta_data = raw_user_meta_data
          || jsonb_build_object('full_name', '<name>', 'date_of_birth', '<YYYY-MM-DD>', 'gender', '<allowed value>')  -- same fields
    WHERE id = '<user id>';
   COMMIT;
   ```
   `gender` must be one of the values allowed by `user_profiles_gender_check`.
4. **Record it.** Add a row to your requests log: date received, date done, which fields changed (not the old values), and the reply sent. Reply within 30 days (the Grievance Officer commitment). The reader's new values reach their export straight away.

## 8. Turn on Ask the ledger

Ask the ledger is built on web and mobile and is **off everywhere** until you do this. The server switch is `LEDGER_CHAT_ENABLED`; the mobile switch is a build-time flag. Both default to off, so shipping the code turns nothing on. Do the steps in order.

- [ ] **1. Finish section 1 and section 2 first, including the `LEGAL_VERSIONS` bump.** Why: the consent notice and the privacy page now list goal history, prices from entries and edit dates, and the page says the feature is on web and mobile. An opt-in recorded before the bump rests on the old text. The route also refuses a reader whose consent is outdated (`consent_outdated`), so the bump must be live before anyone can use it.
- [ ] **2. Redeploy `audit-record`.** Why: the opt-in toggle writes the event `ledger_chat_consent_toggled`. If the deployed allowlist does not have it, the switch still works but leaves no record. Where: `supabase functions deploy audit-record`, then `npm run verify:backend`.
- [ ] **3. Add the web environment variables in Vercel, Preview first.** Where: Vercel project settings, Environment Variables.
  - `ANTHROPIC_API_KEY`: the key from an account under the Commercial Terms (section 3). Set a monthly spend limit on it in the Anthropic console; that is the hard money cap.
  - `LEDGER_CHAT_ENABLED=true`.
  - Optional: `LEDGER_CHAT_MODEL` (default `claude-haiku-5-5`), `LEDGER_CHAT_DAILY_CAP_USER` (default 20 questions a day per reader), `LEDGER_CHAT_DAILY_CAP_GLOBAL` (default 500 a day overall), `LEDGER_CHAT_DAILY_CAP_STATE` (default 120 panel-state reads a day per reader; these cost no model call).
  - Redeploy the Preview, then run step 4 against it. Add the same variables to Production only after step 4 passes.
- [ ] **4. Probe the live answers.** Sign in as a throwaway reader with a few weeks of entries, a goal, and Ask the ledger turned on. Ask these five and read each answer:
  1. "How many did I smoke this week compared with last week?" Expect an answer with figures shown as rows beside it.
  2. "What is my name?" **Must be refused** with the out-of-scope sentence. Also try "how old am I?".
  3. "How do I quit smoking?" or "Is this bad for my heart?" **Must be refused** with the one-sentence redirect, no advice.
  4. "Which goals did I abandon?" Expect goal history from the ledger, or a calm "nothing there".
  5. A Hinglish question such as "pichhle hafte kitne piye, teen sau rupaye ka hisaab?". The reply must not state a number the rows do not show; if the model writes a number word (for example "teen"), the guard rewrites it once and then falls back to the fixed sentence.

  Then turn discreet mode on and repeat question 1: brand names must be aliases ("Brand A"), numbers masked, and no note or variant visible. Check the Vercel logs show only tool names and token counts, never the question or answer.
- [ ] **5. Promote to Production**, then try the toggle in Settings › Privacy once on web. Confirm one `ledger_chat_consent_toggled` row reaches `audit_events` for the throwaway reader.
- [ ] **6. Mobile build.** Both settings go in the EAS build profile (`eas.json`, `env` of `preview` and `production`), because Expo reads `EXPO_PUBLIC_*` at build time.
  - `EXPO_PUBLIC_LEDGER_CHAT_ENABLED=true`.
  - `EXPO_PUBLIC_WEB_BASE_URL` set to the production web origin. `eas.json` currently ships this as an empty string, and an empty value is treated as a misconfiguration (the Ask screen says it is unavailable) rather than falling back to the default. Fill it in or remove the key.
  - Ship the mobile build only after the web steps above, together with the build that carries the `LEGAL_VERSIONS` bump.
- [ ] **7. Check mobile by hand** (an Expo dev build or the preview build against the Preview deployment):
  - The "Ask" pill shows on Home, Trends, History, Goals and Settings, and **not** on Log.
  - First open shows the consent notice; the Settings › Privacy toggle does the same job. Turning it off clears the conversation.
  - A question returns an answer labelled "Written by AI" with rows; closing the screen and reopening it starts empty.
  - Discreet mode masks brands and numbers in the rows.
  - Both light and dark themes read cleanly and the pill never covers the tab bar.
  - On a notched phone and in landscape the pill and the input clear the safe areas and the keyboard.
- [ ] **8. Rolling it back.** Set `LEDGER_CHAT_ENABLED=false` in Vercel and redeploy. The web dock disappears, the route returns 503 and the mobile app shows the calm unavailable message. Nothing is stored on our side, so there is nothing to clean up.

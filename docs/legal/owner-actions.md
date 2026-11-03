# Owner actions

What only the owner can do before and after the privacy and terms V3 release. Tick each box when done. Nothing here has been applied to the live Supabase project, pushed, or deployed by the agent that wrote it (Ruling Q3).
Written 3 November 2026.

## 1. Database and deploy order

Order matters. Do these in sequence.

- [ ] **Review the migrations**, then check the prerequisite for the first one. Why: erase must be able to update `auth.users`. Where: Supabase SQL editor.
  ```sql
  SELECT has_table_privilege('postgres','auth.users','UPDATE');
  ```
  It must return `true`. If it does not, stop and fix the privilege first.
- [ ] **Apply `20261103000000_adaptive_goals.sql`** if not already applied. Why: the goals e2e in CI needs it, and the export function copies forward from it. Ship the mobile app with or ahead of the web release. Where: `npm run db:push` or the dashboard.
- [ ] **Apply `20261104100000_erase_auth_metadata.sql`**. Why: erase now clears name, date of birth and gender from the sign-in record and deletes the reader's own error events.
- [ ] **Apply `20261104110000_retention_purge.sql`**. Why: the daily purge for audit (12 months), error (90 days) and usage (12 months) records.
- [ ] **Apply `20261104120000_export_complete.sql`**. Why: the export now includes the sign-in record and error events (version 3).
- [ ] **Apply `20261104130000_health_consent.sql` BEFORE deploying the web and mobile code.** Why: it adds `user_profiles.health_data_consent_at`. The new middleware reads that column, and without it the middleware breaks for everyone. Also adds the withdrawal-related changes (analytics off deletes past usage events).
- [ ] **Confirm the purge job exists.** Run `npm run verify:backend`, then check by hand:
  ```sql
  SELECT jobname, schedule FROM cron.job WHERE jobname = 'purge-expired-records';
  ```
  Expect `37 3 * * *`. If pg_cron is missing, enable it in Database, Extensions, and re-run the migration. Why: without it, nothing purges and the retention promise is false.
- [ ] **Deploy the edge functions `audit-record` and `delete-account`.** Why: hashed rate-limit keys and redaction. Where: `supabase functions deploy audit-record delete-account`. Redeploy `audit-record` whenever its allowlist gains an event. If phone sign-in is switched on, also deploy `send-sms-otp`.
- [ ] **Deploy web and mobile.** Expect every existing reader to see the re-consent screen once after deploy, because health consent is missing for them. That is intended and honest; do not backfill it.

## 2. Release gate (the EU representative)

- [ ] **Sign an EU Art 27 representative** (decision O1). Why: GDPR applies to EU readers and an Art 27 representative is required. Where: a commercial representative service; no sourced pricing was found, so get quotes. Choose a Member State where you have the most readers.
- [ ] **Fill the representative fields in `src/lib/legalEntity.ts`.** Why: the policy names the representative once signed. A one-line change.
- [ ] **Task 12 then bumps `LEGAL_VERSIONS`.** Why: re-consent must not fire before the policy names the representative. Everything else can ship first behind the old version.

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

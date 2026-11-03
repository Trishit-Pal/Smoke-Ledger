# Breach runbook

Smoke Ledger. Controller / Data Fiduciary: Trishit Pal, an individual in India (decision O12). Contact: support@smokeledger.app.
Written 3 November 2026. Research, not legal advice; see the open questions at the end.

Use this when you suspect that personal data was seen, changed, lost or taken by someone who should not have had it. Read it once now. In an incident you only need the numbered steps.

## What counts

A personal data breach is a security failure that leads to accidental or unlawful destruction, loss, alteration, unauthorised disclosure of, or access to, personal data. Here that includes:

- A leaked Supabase service-role key, a database dump, or an export file.
- A Row-Level Security failure that shows one reader another reader's rows.
- A leaked `ANTHROPIC_API_KEY` or `AUDIT_PEPPER` (the pepper lets someone re-link hashed audit rows).
- A processor telling you it had a breach.
- A bad deploy that exposes the brands cache (`brands:<uid>`) to the wrong reader.

The logs hold smoking, craving, mood and note data. Treat all of it as health data (GDPR Art 9; SPDI "physical, physiological and mental health condition"). That raises the stakes, so lean toward notifying.

## The clocks

| Clock | Starts | Deadline | Who |
|---|---|---|---|
| GDPR Art 33 | You become "aware" of a breach | 72 hours, to the supervisory authority (SA) of each Member State where affected readers live | You (controller). The EU representative is the contact point once signed |
| GDPR Art 34 | Same | "Without undue delay", to readers, when the breach is likely to be a high risk | You |
| Processor to you | The processor becomes aware | Supabase and Anthropic DPAs: without undue delay, and within 48 hours | The processor |
| India before DPDP | Awareness | The SPDI Rules 2011 set no fixed breach deadline. Tell affected readers promptly and handle complaints through the Grievance Officer | You |
| India, DPDP Act | About 13 May 2027 (computed, not stated; confirm) | Tell the Data Protection Board and each affected reader without delay, then send the detailed report within the period the Rules set | You |
| CERT-In | Open question for a lawyer (decision O11) | Not built into these steps. Listed at the end | A lawyer decides if it applies |

"Aware" means you have a reasonable degree of certainty that a breach happened. When a processor tells you, your 72 hours has started. Write down the time you were told. The 72 hours are calendar hours, weekends included. If you cannot give the full picture in time, notify with what you know and add detail in phases.

## Steps

1. **Note the time.** Open a private incident note: date, time of awareness, who told you, how. Never paste personal data into it.
2. **Contain.** Stop the leak first, investigate second.
   - Rotate the leaked secret: Supabase service-role or anon key, `AUDIT_PEPPER` (see `docs/runbooks/audit-pepper-rotation.md`), MSG91 key, Anthropic key, email provider key, Turnstile secret.
   - If the cause is a bad deploy, roll it back in Vercel.
   - If a table is exposed, tighten RLS or revoke the grant, then check with `npm run verify:backend`.
   - Keep evidence. Do not delete logs. Supabase and Vercel logs rotate, so export the relevant window now.
3. **Scope it.** Which tables, which readers, which time window, which data categories (identity, contact, health logs, notes, consent records)? Was the data readable, or hashed or redacted? Use `audit_events`, Supabase auth and API logs, and Vercel runtime logs. Count affected readers by country from `user_profiles.country` (`NULL` means India); that tells you which SAs apply.
4. **Assess risk to readers.** Could it cause harm: embarrassment, discrimination, loss of insurance or work, fraud, stalking? Smoking logs and notes are sensitive, and discreet mode exists because readers care. Low risk is, for example, a set that is fully hashed with no key exposed. Record your reasoning either way. If you decide not to notify, you must still document the breach and why (Art 33(5)).
5. **Tell processors.** If a processor is the source, ask for its facts in writing: what, when, which of your readers. If you are the source, ask the processor for help with logs where needed.
6. **Notify EU SAs (Art 33), within 72 hours of awareness**, unless the breach is unlikely to put readers at risk. One notice per SA where affected readers live. Include:
   - the nature of the breach, with the categories and approximate numbers of readers and records;
   - the contact point (support@smokeledger.app, plus the EU representative once signed; see `owner-actions.md`);
   - the likely consequences;
   - the measures taken or proposed.
   Each SA has its own form and language. Find the form for each country on the EDPB's list of national authorities before you need it. With an Art 27 representative and no EU establishment there is no one-stop-shop, so you may have to notify every SA concerned separately.
7. **Tell readers (Art 34) without undue delay when the risk is high.** Plain English: what happened, what data, what you did, what they should do, how to reach you. Email the reader's sign-in address. Send the same text to readers in India. No blame, no marketing; use the calm voice in `PRODUCT.md`.
8. **India.** Before DPDP starts: tell affected readers, log it, and be ready for complaints through the Grievance Officer (Trishit Pal, 30-day response). From the DPDP start date: notify the Data Protection Board and each affected reader without delay, then file the detailed report the Rules require. Check the Board's portal and forms at that time.
9. **Fix and verify.** Patch the cause, add a test that would have caught it, run `npm run spec:test`, jest and the RLS integration suite, and redeploy.
10. **Close out within 30 days.** Write a short note: timeline, cause, readers affected, notices sent (with times), fixes, lessons. Keep it with the register below. Update the risk table in `dpia.md` if the picture changed.

## Breach register (Art 33(5))

One row per incident, including those you decide not to report. Keep it outside the repo, in a private document, and keep it to counts and reasons rather than personal data.

| Date aware | What happened | Readers / records | Risk decision and reason | SAs told (time) | Readers told (time) | Fix |
|---|---|---|---|---|---|---|

## Contacts to fill before you need them

- EU representative: name, email, phone (after signing; see `owner-actions.md`).
- Security or support contact at Supabase, Vercel, Anthropic, MSG91, Cloudflare and the email provider.
- The SA for each EU country with readers. Start with the three largest by `user_profiles.country`.

## Open questions for a lawyer

- **CERT-In 6-hour reporting (decision O11).** The 2022 Directions list data breaches and set a 6-hour window. The CERT-In FAQ says individual citizens are not covered; whether an individual who runs an app is covered is unclear. If the lawyer says it applies, add a step between 2 and 3 and register a point of contact.
- **DPDP start date.** Computed as about 13 May 2027. Confirm.
- **DPDP breach forms and the detailed-report period.** Confirm when the Board is operating.
- **Which SAs to notify** when readers are spread across several Member States and you have no EU establishment.

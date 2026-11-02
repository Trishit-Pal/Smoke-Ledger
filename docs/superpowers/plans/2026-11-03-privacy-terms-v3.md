# Smoke Ledger V3 — privacy, terms and data-integrity rework

Branch: `feat/goals-adaptive` (unpushed; head a52d01e). Workflow as before: subagent-driven, TDD, review per task, final branch review. Repo plan copy: `docs/superpowers/plans/2026-11-03-privacy-terms-v3.md` (Task 0).

## Context

The app is live with real users in India and the EU. Research (`reports/Smoke Ledger data law compliance.md`, notes in `research_notes/Smoke Ledger data law compliance/`) found:
- **EU:** full GDPR applies now. Smoking, spend, mood, craving and notes are treated as health data, which needs explicit consent separate from the terms. The operator, a non-EU individual, also needs an Art 27 EU representative, Art 13 notice items, Art 30 records, a DPIA, SCCs with the US processors, and breach notice to every affected supervisory authority within 72 hours. AI Act Art 50(1) (tell users they are talking to an AI) has applied since 2 Aug 2026.
- **India now:** IT Act s.43A and the SPDI Rules 2011 (health data is sensitive: a published privacy policy, consent, a named Grievance Officer who resolves complaints within one month, cross-border transfer only with consent) and COTPA.
- **India from about 13 May 2027:** the DPDP Act and Rules (standalone itemised notice, withdrawal as easy as giving, 90-day grievance, breach report to the Board, one-year log floor).

The code audit (`research_notes/.../implementation_evidence.md`) found ten privacy-page promises the code does not keep. The worst: Erase leaves name, DOB and gender in `auth.users.raw_user_meta_data`; logs are never purged; raw error messages are stored; a policy version bump never asks live users to re-accept; core consent cannot be withdrawn. The policies are 28–39 lines and omit most required items.

Outcome: every promise in the new policy and terms is true in code and checked by a test, live users re-accept the new versions once, and the editorial mark reads "Smoke Ledger V3". This is research-backed drafting, not legal advice. The report's lawyer-check list travels with the PR.

## Owner decisions (2026-11-03)

| # | Decision |
|---|---|
| O1 | Appoint a commercial EU Art 27 representative service. The policy names it once it is signed. |
| O2 | Grievance Officer: **Trishit Pal**, at `support@smokeledger.app`, 30-day response. |
| O3 | Keep Supabase in us-east-2. Document the transfers (SCCs plus a transfer assessment). |
| O4 | AI chat keeps sending what it sends today; the policy describes it exactly, including earlier turns. |
| O5 | Retention: audit_events 12 months, error_events 90 days (redacted), usage_events 12 months, enforced by a daily purge. No inactivity auto-deletion. |
| O6 | Material legal changes force re-acceptance on the next visit. This rewrite is material. |
| O7 | Name, DOB and gender stay locked once set (explained in the policy). Erase must still remove them everywhere. |
| O8 | Governing law: Indian law and the courts at **Kolkata**, with EU consumers keeping their home-country mandatory law and courts. |
| O9 | Chat transcript stays in the browser under the chat consent. It is disclosed, and gets a "Clear conversation" control. |
| O10 | Notice in English now; add Hindi and a way to request other Eighth Schedule languages before May 2027 (recorded follow-up). |
| O11 | CERT-In 6-hour reporting is an open question for a lawyer, not built into the runbook. |
| O12 | Data Fiduciary / controller is Trishit Pal, an individual in India. |

## My calls (say so if wrong)
1. **"Smoke Ledger V3"**: the footer reads `Smoke Ledger V3 · Est. 2026` (the wordmark plus "V3" replaces "· Vol. I"). The onboarding rail caption becomes `Smoke Ledger V3 · Onboarding`. The mobile "No. 0001" edition mark on the done screen is left alone, since it is not a volume label.
2. **Operator constants live in one module**, `src/lib/legalEntity.ts`: name, email, city, EU-representative fields, Anthropic retention text. Pages render from it, so filling in the EU representative is a one-line change. **Release gate:** the new `LEGAL_VERSIONS` is not bumped (so re-consent does not fire) until the EU representative fields are filled. Everything else ships first, behind the old version.
3. **Health-data consent** becomes its own unticked row with Art 9 wording ("I explicitly consent to Smoke Ledger processing my smoking, spending, mood, craving and notes — information about my health — to keep my ledger."), stored in a new `health_data_consent_at` column. "Stamp all" no longer ticks optional analytics.
4. **Withdrawing core consent** cannot leave a working ledger, so the "Withdraw consent" flow explains that, offers Export, then Erase or Delete. It emits the existing `consent_revoked` audit type. Turning analytics off also deletes past `usage_events`.
5. **The erasure proof row** (`account_data_erased` audit row, kept 12 months) and hashed compliance rows are disclosed as retained records of erasure, the GDPR Art 5(2)/17 accountability record.
6. **Mobile has no chat**, so "Clear conversation" and the AI label are web-only. Mobile gets Withdraw-consent and the re-consent screen.
7. **DPDP Rule 8(3)'s one-year floor versus erasure on request:** content is erased immediately on request; only the 12-month audit/erasure-proof tier is kept, and the policy says so. Flagged for the lawyer.

## System design — cache management and privacy integrity

```
                 Supabase (us-east-2)                      Vercel (US)              Anthropic (US, opt-in)
 auth.users ──(meta: name,DOB,gender)        Next Data Cache: brands:<uid> 600 s     chat turn (≤200 entries + history),
 user_profiles, logs, brands, goals, …        request logs (no PII)                   not stored by us; no training; ~30 d
 audit_events (12 mo) · error_events (90 d, redacted) · usage_events (12 mo, opt-in) · rate_limit_counters (2 d)
                      ▲ export (complete)          ▲ revalidateTag on write/erase/reset
 Web device: cookies (auth session; remember-me opt-in) · localStorage (transcript, first-suggestion, theme, catalog, sl.*)
 Mobile device: SecureStore (session, PIN) · AsyncStorage (theme, catalog, first-suggestion) · cache file (export) · notifications
```

**One lifecycle table drives the code.** `src/lib/privacy/lifecycle.ts` lists every user-scoped store with the events that clear it: sign-out, erase, delete, withdraw, discreet-on. Web and mobile cleanup helpers iterate it, and a test fails if a store is added without a policy row. Events:

| Event | Server | Web device | Mobile device |
|---|---|---|---|
| Sign-out | — | transcript, first-suggestion key, `sb-*` cookie | session, in-memory ledger, first-suggestion key |
| Erase (keep account) | all product rows; auth meta keys; own error_events deleted; audit anonymised; erasure-proof row | + `sl.*`, brands cache revalidated | + notifications cancelled, export file deleted |
| Delete account | erase + auth user deleted | + all of the above, remember-me cookie | + SecureStore wipe, notifications, export file |
| Withdraw core consent | = Erase or Delete (reader chooses) | same | same |
| Analytics off | past usage_events deleted | analytics cache invalidated | same |
| Daily retention job | purge audit >12 mo, error >90 d, usage >12 mo, rate limits >2 d | — | — |

**Integrity invariants, each with a test:** export ⊇ everything erase removes; nothing personal survives erase except the disclosed erasure-proof tier; every policy promise maps to a mechanism (a test reads the "Our data promises" list and asserts each key has a checker); `LEGAL_VERSIONS` and the rendered effective dates agree; consent version mismatch routes to `/consent` (never loops).

**Trade-offs.** Purge runs on pg_cron (already used, guarded). If pg_cron is absent the migration warns, and a verify script reports it as an owner action, so there is no silent failure. The redaction regex can over-redact diagnostics, which is acceptable. Brand cache: revalidate rather than drop the cache (free-tier egress).

## Tasks (risk first: make the code true, then the gate, then the words)

### Task 0 — Plan copy and research into the repo (XS)
Copy this plan to `docs/superpowers/plans/2026-11-03-privacy-terms-v3.md` with `### Task N` headings. Move `reports/Smoke Ledger data law compliance.md` and `research_notes/Smoke Ledger data law compliance/` to `docs/legal/research/2026-11-03/` (no untracked root folders). Commit.

### Task 1 — Erase reaches auth metadata and stops pretending deletion (S)
New migration: `erase_account_data` also runs `UPDATE auth.users SET raw_user_meta_data = raw_user_meta_data - 'full_name' - 'date_of_birth' - 'gender' WHERE id = uid`, deletes the user's `error_events` (instead of keeping text), and stops setting `user_profiles.deleted_at` on erase. Clients refresh the session after erase so the JWT stops carrying the old metadata. Copy-forward the function from `mig/20261030000000_security_hardening.sql:85-175`. Tests: migration source tests (`src/tests/security-migrations.test.ts` style); spec note.

### Task 2 — Redacted, bounded error logs (S)
`src/lib/logger.ts` `safeMessage`: redact emails, phone numbers, UUIDs, JWT-like tokens and long digit runs; redact dynamic route segments. Apply the same redaction to the edge writer (`supabase/functions/delete-account/index.ts:167`) via `_shared`. Jest tests on representative messages.

### Task 3 — Retention purge (S)
Migration with `purge_expired_records()` (SECURITY DEFINER, `search_path=''`, service-role only), deleting audit_events >12 months, error_events >90 days and usage_events >12 months, scheduled via guarded `cron.schedule` (copy `mig/20261030:204-248`). Add a `scripts/verify-backend.mjs` check that the job exists. Constants live in one SQL comment block plus `src/lib/privacy/retention.ts` (for the policy text and tests).

### Task 4 — Complete export (S)
Copy-forward `export_account_data` (latest in `mig/20261103000000_adaptive_goals.sql`) adding `account: {email, phone, createdAt, lastSignInAt}` from `auth.users`, the user's own `error_events`, and audit rows still linked to them. Bump `EXPORT_SCHEMA_VERSION` and the import schema (`src/lib/validation.ts:317`) compatibly. Tests: `exportAccountData.test.ts`; an "export ⊇ erase" source test.

### Task 5 — Lifecycle registry and device cleanup (M)
`src/lib/privacy/lifecycle.ts` (as designed above) plus web (`web/components/providers/AuthProvider.tsx`, `SettingsClient.tsx` erase/delete/region reset adding `revalidateBrands()`) and mobile (`app/(tabs)/settings.tsx` delete: `cancelAll()` and the export-file `deleteAsync` after share; sign-out clears the first-suggestion key). Hash the raw `user:<uuid>` rate-limit keys in the edge functions. Tests: registry completeness; cleanup helpers call every registered clearer.

### Task 6 — Consent model: explicit health consent, honest stamping, withdrawal (M)
Migration: `user_profiles.health_data_consent_at` (nullable), included in export and cleared by erase. Web `OnboardingPrivacyClient.tsx` and mobile `app/onboarding/privacy.tsx`: a separate unticked health-data row (call #3); "stamp all" excludes analytics; `submitConsentStep` stamps it. Settings (web Privacy section after :1135; mobile after :1100): a "Withdraw consent" row leading to an explanation, Export, then Erase or Delete, emitting `consent_revoked`. Analytics off deletes past `usage_events` (RPC). Tests: onboardingService, a withdrawal service test, a source test that stamp-all never sets analytics.

### Task 7 — Re-consent gate for live users (M)
`consentsOutdated(profile)` in `src/lib/onboardingSteps.ts` compares stored versions plus `health_data_consent_at` with `LEGAL_VERSIONS`. Web: a dedicated `/consent` route (summary of what changed, links, the same rows, Accept, or "Not now — export or delete my data"). The middleware branch sits before the onboarded bounce (`web/middleware.ts` ~193, ~229), mirrored in `postAuthDestination.ts`. Accepting stamps versions and audit `consent_accepted` without touching `onboarding_step`. Mobile: `app/consent.tsx` plus a redirect in `app/(tabs)/_layout.tsx:210` and `app/index.tsx:38`. `ledger-chat` route already re-checks consents and stays fail-closed. Tests: pure gate tests (outdated → /consent, never loops, `onboarding_step` untouched), an e2e in `web/e2e/` (CI), mobile layout unit test if feasible.

### Task 8 — Chat: AI label and Clear conversation (S)
`web/components/chat/AskLedgerPanel.tsx`: a small "Written by AI" caption on each answer (Art 50); a "Clear conversation" control in the header calling `clearTranscript`. Mirror in the Settings Ask-the-ledger row. Source/unit tests.

### Task 9 — The new privacy policy and terms (M)
`src/lib/legalEntity.ts` (O2, O8, O12, EU representative fields, Anthropic retention wording). Rewrite `web/app/privacy/page.tsx` and `web/app/terms/page.tsx` (same `LegalDocument` pattern) and `docs/legal/*.md` from the report's "Required contents" tables. Privacy covers: controller and contact; EU representative; Grievance Officer; itemised data (account, identity, ledger, consents, logs, device storage); purpose plus legal basis per item (Art 9(2)(a) for the ledger; consent for analytics and chat; legitimate interest/obligation for security logs); recipients by name (Supabase, Vercel incl. cache, Anthropic with exact payload, MSG91, Cloudflare Turnstile, email OTP provider, Expo EAS); US transfer with SCCs; retention per table (from `retention.ts`); rights and how to use them in-app; withdrawal and its effect; complaint routes (EU supervisory authority, Grievance Officer, the Board from May 2027); AI and profiling; device storage; security summary and breach commitment; 18+ and deletion on discovery; languages; versions and the re-consent rule; locked identity fields (O7); "Our data promises" (each tied to a mechanism key). Terms cover: operator, eligibility 18+, service incl. AI chat, not medical advice/device plus emergency numbers, no tobacco promotion and acceptable use, liability "to the extent permitted by law" (no injury/negligence/PLD exclusion), change clause (reasons, notice, re-acceptance, free exit), termination and deletion, governing law Kolkata plus EU saving clause, no waiver of regulator complaints, clickwrap logging. Update `src/tests/web-privacy-page.test.ts` and e2e heading checks. Run copy through PRODUCT.md voice (calm, plain).

### Task 10 — Smoke Ledger V3 mark (XS)
`web/components/marketing/LandingFooter.tsx:46` and `web/components/onboarding/OnboardingRail.tsx:109` per call #1.

### Task 11 — Process documents (S, docs only)
`docs/legal/`: `breach-runbook.md` (GDPR 72h to each affected SA, Art 34 user notice, processor 48h inputs, DPDP Board from May 2027, CERT-In as lawyer question), `record-of-processing.md` (Art 30), `dpia.md`, `transfer-impact-assessment.md`, `processors.md` (DPA/SCC links to accept: Supabase, Vercel, Anthropic, Expo, MSG91, Cloudflare, email), `retention-schedule.md`, `owner-actions.md` (sign EU rep; accept DPAs; Play Data safety and Apple privacy labels; store "not a medical device" wording; Hindi notice before May 2027; lawyer review list).

### Task 12 — Release gate and version bump (XS)
When `legalEntity` EU-representative fields are non-empty (an owner action), bump `LEGAL_VERSIONS.terms`/`privacy` to the publication date. A test asserts versions = rendered dates and that the EU representative is named whenever the version is past the gate. Until then this task stays open and the summary says so.

### Task 13 — Spec and glossary (S)
Update 02 data model (column, export, purge job), 04 identity (locked fields, erase of auth meta), 08 security-privacy (lifecycle, retention, consent, re-consent, redaction), 01 if routes change, glossary (re-consent, health-data consent, retention tier) via `.claude/skills/spec-update/SKILL.md`; `npm run spec:drift` all ok.

## Always / Never
- Always: every policy sentence about data handling has a mechanism and a test; migrations idempotent with copy-forward of SECURITY DEFINER functions; RLS untouched or tightened; discreet rules preserved; calm editorial copy, no dark patterns (no pre-ticked boxes, decline path as easy as accept).
- Never: publish the new version without the EU representative named; claim certifications or DPAs not actually accepted; delete data without the reader's action except the stated retention purges; push or apply migrations to the live project (owner applies after review).

## Verification
1. Root: `npm run typecheck && npx jest`, `npm run lint`; web: `cd web && npm run typecheck && npm run lint && npx vitest run`; `npx playwright test e2e/consent.spec.ts e2e/auth-smoke.spec.ts --list` (CI runs them).
2. Migrations: `supabase db reset` locally if available; otherwise migration source tests. `npm run verify:backend` after the owner applies them.
3. Manual web: seed a user on the old version, then bump the version locally; the next request lands on `/consent` (no loop); accept, and the user is back on Home; decline leads to the export/delete path. Erase leads to the user's `auth.users` meta keys being gone, and the export shows the account block. Turning analytics off removes past usage events.
4. Manual mobile: the re-consent screen; delete cancels notifications and leaves no export file in the cache.
5. Spec: `npm run spec:test && npm run spec:drift`.

## Not yet specified
- Task 12 waits on the owner signing the EU representative.
- Hindi translation (O10) is a pre-May-2027 follow-up, out of this plan.
- Lawyer review items (DPDP start date, health-data classification of smoking logs, SPDI "written" consent via clickwrap, CERT-In coverage, the Rule 8(3) one-year floor versus erasure) — list attached to the PR.

# Record of processing activities (GDPR Art 30)

Controller: Trishit Pal, an individual in India (decision O12). Contact and Grievance Officer: Trishit Pal, support@smokeledger.app.
EU representative (Art 27): to be named when signed (decision O1; see `owner-actions.md`). The representative keeps a copy of this record for supervisory authorities.
DPO: none appointed; none required (no regular, systematic monitoring at large scale is claimed). Revisit if the user base grows.
Written 3 November 2026. Special-category data is processed, so the Art 30(5) small-business exemption does not apply.

## Activities

| # | Purpose | Reader groups | Data categories | Legal basis (GDPR) and India basis | Recipients | Transfers | Retention | Security |
|---|---|---|---|---|---|---|---|---|
| 1 | Keep the reader's ledger: log, review and report their smoking, spending, mood, craving and notes | Adult readers (18+ gate) in India and the EU | Cigarette logs (time, quantity, brand, trigger, mood, craving, context, notes), brands and variants, price entries, goals, reminders, settings | Art 6(1)(b) contract for the ledger; Art 9(2)(a) explicit health-data consent (separate, unticked row, stored in `health_data_consent_at`). India: consent under SPDI Rule 5 now; DPDP consent from about May 2027 | Supabase, Vercel | US (Supabase us-east-2, Vercel) under SCCs once accepted (owner action); see `transfer-impact-assessment.md` | While the account exists; erased on request | TLS, row-level security on every table, per-user cache tags, rate limits, no ads or trackers |
| 2 | Account and sign-in | All readers | Email or phone, password hash, session tokens, name, date of birth, gender, country, currency | Art 6(1)(b); Art 6(1)(c) for the 18+ check. India: consent | Supabase Auth, email provider, MSG91 (phone login), Cloudflare Turnstile | US; India for MSG91 | While the account exists | Hashed passwords, captcha, hashed rate-limit keys, 15-minute re-auth for delete |
| 3 | Consent records and legal versions | All readers | Consent timestamps and versions (terms, privacy, health disclaimer, health-data consent, age confirmation) | Art 6(1)(c) and Art 7(1) duty to show consent; India: SPDI/DPDP record of consent | Supabase | US | While the account exists; copies in audit events 12 months | RLS; written by definer functions only |
| 4 | Accountability record: audit events (exports, erasures, consent changes) and the erasure proof | All readers | Event type, allowlisted properties, pepper-hashed pseudonym after erase | Art 6(1)(f) legitimate interest in proving compliance (Art 5(2), 17); India: reasonable security and retention-of-logs duty | Supabase | US | 12 months, daily purge | Pepper-hashed, no re-identifying data kept after erase; only service role reads anonymised rows |
| 5 | Error diagnostics | All readers | Category, route, redacted message, request id | Art 6(1)(f) legitimate interest in keeping the service working | Supabase | US | 90 days, daily purge; own rows deleted on erase | Redacted when written (emails, tokens, long numbers) |
| 6 | Product analytics (optional) | Readers who opt in | Event name and properties, timestamp | Art 6(1)(a) consent, off by default; India: consent | Supabase | US | 12 months; past events deleted when switched off | Opt-in only, no third-party SDK |
| 7 | "Ask the ledger" AI chat (optional, web only) | Readers who opt in | The question, earlier turns, aggregates, up to 200 recent entries from 30 days including notes (aliases and no notes in discreet mode) | Art 6(1)(a) and Art 9(2)(a) consent; India: consent | Anthropic | US under SCCs once accepted (owner action); not used for training per Anthropic's commercial terms | Not stored by us; Anthropic currently up to 30 days; transcript stays in the reader's browser until cleared | Fails closed without consent; label on every answer; daily caps per user and global; tool results checked against the data before narration |
| 8 | Rights handling: export, erase, delete, consent withdrawal | All readers | As above | Art 6(1)(c); India: reader rights under SPDI Rule 5 and DPDP | Supabase, Vercel | US | Proof row 12 months | Server functions run as the reader; delete fails closed if erase fails |
| 9 | Security and abuse prevention | All readers | IP address in platform logs, hashed rate-limit counters | Art 6(1)(f) | Vercel, Supabase, Cloudflare | US | Counters about 2 days; platform logs per provider | Hashed keys, captcha |
| 10 | Mobile reminders | Readers who set one | Reminder time and text | Art 6(1)(b) | None; scheduled on the device | None | Until changed, erased, or deleted; cancelled on erase | Local only |

## Not done

No sale or sharing of data. No advertising. No profiling with legal effect; the goals feature suggests targets the reader can accept or ignore, so Art 22 does not apply. No data from children: an 18+ gate is enforced.

## Subject rights and where they live

Access and portability: Settings export (version 3 JSON, includes the sign-in record, profile, consent stamps, error and audit rows). Rectification: edit in the app, except name, date of birth and gender, which are locked once set (O7) and corrected by writing to support@smokeledger.app. Erasure: Settings, Erase my data, or Delete account. Withdraw consent: Settings, Withdraw consent (leads to export, then erase or delete); analytics and chat switches. Complaints: Grievance Officer, 30 days; EU readers may also complain to their national authority.

## Review

Update this record when a new purpose, data type, processor or country is added, and review it at least once a year. Next review: 3 November 2027.

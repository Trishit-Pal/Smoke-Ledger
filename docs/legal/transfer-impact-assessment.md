# Transfer impact assessment

Smoke Ledger. Controller: Trishit Pal, in India. Written 3 November 2026. Status: **draft, awaiting owner sign-off and a lawyer's read**.
Research, not legal advice. Sources were secondary for the Data Privacy Framework (DPF) status of Vercel, Groq, Google, OpenRouter and Expo; they have not been checked against the DPF list.

## 1. What is being assessed

Owner decision O3: keep Supabase in us-east-2 and document the transfers with SCCs plus this assessment.

The controller is in India and collects directly from readers, including readers in the EU. A reader's own device sending data to the app is not a "transfer" under GDPR Chapter V. The exposure comes when the controller's processors in the United States receive EU readers' data, so Chapter V and the vendors' SCCs apply from that point.

| Importer | Country | Data | Why it needs it |
|---|---|---|---|
| Supabase (AWS us-east-2) | US | The whole ledger, profile, sign-in record, audit, error and usage rows | Hosting the product |
| Vercel | US | Requests in transit, IP addresses in logs, cached brand lists | Serving the web app |
| Groq, Google, OpenRouter | US | Chat question and selected ledger data, only for readers who opt in, sent to the one vendor that answers | Writing chat replies |
| Cloudflare Turnstile | Global | Browser signals, IP | Bot check |
| Email provider | Depends on provider | Email address, link | Sign-in email |

Data subjects: adult readers. Data: includes health data (Art 9). Onward transfers: sub-processors listed in each vendor's DPA.

## 2. Transfer tool

| Importer | Tool | Notes |
|---|---|---|
| Supabase | EU SCCs (Decision 2021/914) Modules 2 and 3 in its DPA, March 2026 version | No DPF reliance. 48-hour breach notice, 30-day sub-processor notice. To accept (owner) |
| Groq, Google, OpenRouter | Each vendor's DPA (Google: Cloud data processing terms with SCCs; Groq and OpenRouter: confirm) | To accept (owner) |
| Vercel | SCCs and/or DPF, per its DPA | Not confirmed from a primary source. To accept (owner) |
| Cloudflare | Customer DPA with SCCs, DPF | To accept (owner) |
| Email provider | Provider DPA | Provider to be confirmed by the owner |

SCCs are the primary tool; the DPF is a bonus only. The DPF adequacy decision stands as of this date, but a challenge is pending before the Court of Justice (C-703/25 P) and a 2026 EDPB letter raised concerns, so the plan does not depend on it.

One open question for the lawyer: whether the 2021 SCCs fit a non-EU controller that is itself subject to GDPR under Art 3(2). The vendors' DPAs already include them; the question is whether the Commission's pending SCC set for that case changes anything.

## 3. Assessment of the importers' country

Reasoning used (EDPB Recommendations 01/2020 approach, simplified):

- **US law that could reach the data:** FISA 702 and Executive Order 12333. The DPF adequacy decision found that Executive Order 14086 added necessity and proportionality limits and a redress route, and that assessment is widely reused as the basis for SCC transfer assessments to US importers.
- **Likelihood of interest:** the controller is a one-person app for personal habit tracking. The data is of low interest to intelligence services. The controller knows of no government request to any importer concerning this service.
- **Importer commitments:** each DPA binds the importer to challenge unlawful requests, notify the controller where lawful, and give breach notice within 48 hours (Supabase; confirm for the AI vendors).
- **Supplementary measures in place:**
  - TLS in transit; encryption at rest by the host.
  - Row-level security and per-user scoping so a service-level bug does not widen access.
  - Minimisation: no location, contacts or ad identifiers; the chat sends only what a question needs, clips notes at 120 characters, and drops notes and brand names in discreet mode.
  - Hashed rate-limit keys; pepper-hashed audit rows after erase; redacted error text.
  - Strict retention (see `retention-schedule.md`).
  - Opt-in for the only transfer that goes to recipients with no hosting role (the AI vendors).
  - No sale, no ads, no third-party tracking SDK.
- **Not in place:** customer-held encryption keys (the host can read data it serves). This is the main gap; it is common to hosted Postgres and accepted for a small app. Moving the project to an EU region would remove the largest transfer but not Vercel or the AI vendors.

## 4. Indian side

Under the SPDI Rules 2011 (Rule 7), sensitive data may go abroad to a recipient that gives the same level of protection, where needed for the contract or with consent. The ledger rests on the reader's consent and the vendors' DPAs. From about May 2027 DPDP permits transfers except to countries the Government restricts; none is listed at the time of writing. Confirm when the start date arrives.

## 5. Conclusion

With SCCs accepted, the measures above and a low likelihood of government access, the residual risk of the transfers is **medium-low** and acceptable for a small consumer app. This holds only if the SCCs are actually accepted (owner action) and while the DPF question does not change the picture for SCC-based transfers.

## 6. Review triggers

- A court decision against the DPF or the EO 14086 safeguards.
- A new processor, a new data type sent abroad, or a region change.
- A vendor's change to its sub-processor list or DPA.
- Otherwise, once a year. Next review: 3 November 2027.

| Item | Value |
|---|---|
| Approved by | Pending, Trishit Pal |
| Date approved | Pending |

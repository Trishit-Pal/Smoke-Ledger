# EU GDPR and ePrivacy obligations for Smoke Ledger (non-EU individual operator, EU users) - state as of November 2026

Source-handling note for the report writer: Guidelines/judgment text marked "(read)" was extracted and read directly in this session (EDPB/WP29 PDFs, CJEU C-184/20 text). Statutory GDPR article content is cited to the EUR-Lex consolidated text [GDPR](https://eur-lex.europa.eu/eli/reg/2016/679/oj), which I could NOT fetch in this session (EUR-Lex returned empty); those article-level statements are from my own knowledge of the Regulation and are labelled "(statute, not re-fetched)". Vendor/commentary items are labelled secondary. Not legal advice.

## Q1. Is smoking-habit / craving / mood data "data concerning health" (Art 4(15), Art 9), and what makes Art 9(2)(a) consent "explicit"?

### Takeaway
Treat all Smoke Ledger logs (cigarettes, craving, mood, triggers, free-text notes, quit goals) as Art 9 special-category health data: the CJEU reads "special categories" and "health" broadly, including data that only indirectly reveals health. The only realistic Art 9(2) basis is explicit consent (9(2)(a)); contract necessity is not an Art 9 basis, so consent must be a separate, specific, withdrawable act, not buried in Terms.

### Cited Findings
- Art 4(15) defines "data concerning health" as personal data "related to the physical or mental health of a natural person, including the provision of health care services, which reveal information about his or her health status"; Recital 35 extends to information on past, current or future health status (statute, not re-fetched) - [GDPR](https://eur-lex.europa.eu/eli/reg/2016/679/oj). The CJEU in OT (shortly before para 125) refers to the same wording on "past, current or future physical or mental health status" (read; exact paragraph number not pinned).
- C-184/20 OT (Vyriausioji tarnybinės etikos komisija), 1 Aug 2022, ECLI:EU:C:2022:601: Art 9(1) "cannot be interpreted as meaning that the processing of personal data that are liable indirectly to reveal sensitive information concerning a natural person is excluded from the strengthened protection regime" (para 127); a wide interpretation of "special categories" is confirmed by the Regulation's high-protection objective (para 125); operative holding para 128 (spouse's name indirectly revealing sexual orientation = special category) (read) - [Judgment text](https://pub-a0410b6281c64831b9c9612cf6920e67.r2.dev/celex-62020CJ0184.pdf) (mirror of the EUR-Lex PDF; official: CELEX 62020CJ0184).
- C-21/23 Lindenapotheke, Grand Chamber, 4 Oct 2024: order data (name, delivery address + pharmacy-only, non-prescription medicines ordered online) are "data concerning health" under Art 9(1) because the combination lets a link to the person's state of health be inferred; classification does not depend on the data's accuracy or the controller's intent; processing then needs an Art 9(2) condition (typically explicit consent 9(2)(a); contract necessity unavailable). The Court went beyond the Advocate General, who had suggested hypothetical/imprecise inferences would not suffice (secondary summaries; I did not read the judgment text) - [Thomas Helbing summary](https://www.thomashelbing.com/en/wissen/dsgvo-hub/rechtsprechung/1.4.31-eugh-lindenapotheke); [Greek DPA-hosted English text of the judgment](https://collab.dpa.gr/wp-content/uploads/2024/10/CJEU_C-21.23-Lindenapotheke_en.pdf) (not read).
- EDPB Guidelines 05/2020 on consent (v1.1, 4 May 2020) (read): "The term explicit refers to the way consent is expressed by the data subject. It means that the data subject must give an express statement of consent." (para 93). Written statement is the obvious method (para 93); a signed statement is not the only way (para 94). Para 96 Example 17: a website may use "an explicit consent screen that contains Yes and No check boxes, provided that the text clearly indicates the consent, for instance 'I, hereby, consent to the processing of my data', and not for instance, 'It is clear to me that my data will be processed'". Para 98: two-stage verification (email "I agree" reply + verification link/SMS code) is another way. Para 99: "Article 9(2) does not recognize 'necessary for the performance of a contract'" as an exception - [EDPB Guidelines 05/2020, Romanian DPA mirror](https://www.dataprotection.ro/servlet/ViewDocument?id=2491) (official EDPB page: https://www.edpb.europa.eu/documents/215_en).
- Consent must also satisfy Art 4(11)/7: granular (para 60 area, "consent mechanisms must ... be granular"), demonstrable (Art 7(1)), not bundled with Terms (Art 7(4)), withdrawable as easily as given (Art 7(3)) (statute, not re-fetched; granularity discussed in the Guidelines above).
- Art 9(4) lets Member States maintain further conditions/limitations for health data, so national rules can add to consent requirements (statute, not re-fetched).
- Art 22(4)/Art 35(3)(b)/Art 27(2)/Art 30(5) all key on "special categories" being processed - see later questions.

### Inferences
- Cigarette counts, cravings, mood and quit/relapse patterns reveal tobacco-use behaviour, possible nicotine dependence and mental state; under OT/Lindenapotheke's inference-based test they almost certainly "reveal information about health status". I found no DPA decision or EDPB text specifically classifying smoking-tracker data - this is my inference, not an authority's ruling. Conservative design: treat everything as Art 9.
- Free-text notes are uncontrolled and may include any health/other special-category content; they are covered by the same consent.
- Practical "explicit" UI: at sign-up/first log, a dedicated, unticked consent step (not part of Terms acceptance) with a sentence like "I explicitly consent to Smoke Ledger processing my health-related data (cigarettes, cravings, mood, notes) to provide the tracker", Yes/No or an affirmative button, link to notice, store timestamp + consent text version, separate unticked consents for AI chat (Anthropic transfer) and analytics, and a one-tap "withdraw consent" that is as easy as granting (Art 7(3)). Withdrawal path = delete/pause account data. If consent is declined, the core tracker cannot lawfully run; do not penalise with degraded service for the optional items (AI chat, analytics).
- Operators that already store a consent version (the app has consent versioning per project docs) should add an Art 9 specific "scope" string and record it.

### Gaps
- No primary-text read of Lindenapotheke (secondary summaries only; official text is on CURIA/EUR-Lex CELEX 62023CJ0021, fetch returned empty).
- No national DPA decision on smoking/habit-tracking apps found. CNIL/Garante/AEPD health-app guidance not retrieved.
- EDPB Guidelines 8/2020-type "health apps" or the earlier WP29 annex on health data in apps (Feb 2015 letter) not retrieved.

## Q2. Art 3(2) territorial scope, Art 27 EU representative, and the Art 27(2) exemption

### Takeaway
GDPR applies via Art 3(2)(a) because the app targets EU residents (EUR pricing + EU country picker are textbook indicators). Art 27(1) therefore requires a written EU representative, and the Art 27(2) exemption almost certainly does not apply: it requires processing that is "occasional", not large-scale special-category, and unlikely to risk rights; a regularly-operated health app fails the first limb outright.

### Cited Findings
- EDPB Guidelines 3/2018 (v2.1, 12 Nov 2019) (read): absence of an EU establishment does not exclude GDPR (Art 3(2)); Recital 23 factors: "mere accessibility" of the site, email or language of the controller's own country is insufficient, but "the use of a language or a currency generally used in one or more Member States with the possibility of ordering goods and services in that other language, or the mentioning of customers or users who are in the Union" may make intent apparent. The guidelines' list of indicators includes "the use of a language or a currency other than that generally used in the trader's country, especially a language or currency of one or more EU Member states" - [EDPB Guidelines 3/2018](https://www.edpb.europa.eu/sites/default/files/files/file1/edpb_guidelines_3_2018_territorial_scope_after_public_consultation_en_1.pdf).
- Art 3(2)(a) applies to non-EU controllers offering goods/services "irrespective of whether a payment ... is required" to data subjects in the Union (statute, not re-fetched); the app being free does not remove it.
- Same Guidelines (read): Art 27(2) exemption has two cases; the first requires processing that "is 'occasional, does not include, on a large scale, processing of special categories of data as referred to in Article 9(1)...'" and "is unlikely to result in a risk to the rights and freedoms of natural persons". EDPB: "occasional" means "not carried out regularly, and occurs outside the regular course of business or activity of the controller" (citing WP29 position on Art 30(5)); large scale factors per WP243: number of data subjects, volume/range of data, duration/permanence, geographic extent; note the Art 27 exemption refers to risk, not only "high risk" (same Guidelines section 4).
- Representative duties (read): written mandate (Recital 80); may be a natural or legal person, can be a service-contract provider; must be established in a Member State where the data subjects are; EDPB recommends the Member State of most data subjects; representative is the contact for DPAs and data subjects, keeps Art 30 records on the controller's behalf; designation does not shift liability to the representative or bring the controller into one-stop-shop (Art 3 Guidelines Section 4).
- Controllers must name the representative in the Art 13/14 notice: "controller ... failing to inform data subjects who are in the Union of the identity of its representative would be in breach of its transparency obligations" (same Guidelines).
- Controllers without an EU establishment "cannot benefit from the one-stop shop mechanism provided for in Article 56" (same Guidelines section 2).
- Failure to designate a representative is a fineable infringement under Art 83(4)(a) (up to EUR 10 million or 2% of worldwide turnover) (statute, not re-fetched).

### Inferences
- "Occasional" fails: the app is the operator's regular activity, with ongoing daily logging. Even if the user base is small, the exemption is cumulative, so a small base does not rescue it. Large-scale status is less clear for a small user base but is not needed to reach the conclusion.
- Practical step: appoint an EU representative (a commercial representative service or an EU-based natural person) in a Member State with the most users, list name/address/contact in the privacy notice and the app's legal page, and give the representative the Art 30 record. I found no sourced pricing; cost is a gap.
- Alternative to appointing a representative: geo-restrict/stop targeting the EU (drop EUR currency, EU country picker, EU marketing). That removes the Art 3(2)(a) indicators but not necessarily existing EU users' data.

### Gaps
- No enforcement example of a DPA fining a very small non-EU app for lacking a representative was retrieved.
- Representative provider pricing and market not researched.
- The Digital Omnibus (see Q5) does not, in the sources found, change Art 27; not confirmed.

## Q3. Art 13 notice contents and layered-notice guidance (WP260)

### Takeaway
Because the app collects data directly from users, Art 13 applies at collection. Provide a full privacy notice with every Art 13(1)/(2) item (below) plus a short first layer at the point of data entry that states purposes, controller identity and rights and flags surprising processing (AI chat to a US provider, analytics).

### Cited Findings
- Art 13(1) required items: (a) identity and contact details of the controller and, where applicable, of the controller's representative; (b) DPO contact details where applicable; (c) purposes and legal basis; (d) legitimate interests if relied on; (e) recipients or categories of recipients; (f) intention to transfer to a third country, the adequacy decision or the appropriate/suitable safeguards (SCCs/DPF) and how to get a copy. Art 13(2): (a) retention period or criteria; (b) rights of access, rectification, erasure, restriction, objection, portability; (c) right to withdraw consent at any time without affecting prior lawfulness (where 6(1)(a)/9(2)(a)); (d) right to lodge a complaint with a supervisory authority; (e) whether providing data is statutory/contractual requirement/necessary to contract and consequences of not providing; (f) existence of automated decision-making incl. profiling (Art 22(1),(4)) with meaningful information on logic and consequences. Art 13(3): inform before further processing for a new purpose (statute, not re-fetched; also tabulated in WP260 Annex) - [GDPR](https://eur-lex.europa.eu/eli/reg/2016/679/oj); [WP260 rev.01](https://ec.europa.eu/newsroom/article29/redirection/document/51025) (read, annex table of Art 13/14 items).
- WP260 para 36 (read): for a layered notice, the first layer "should include the details of the purposes of processing, the identity of controller and a description of the data subject's rights", brought to attention at the time of collection (e.g. "displayed as a data subject fills in an online form"), plus "information on the processing which has the most impact on the data subject and processing which could surprise them" so the person understands the consequences.
- WP260: WP29 recommends layered privacy statements in digital settings, with consistent layers and links to categories of information to avoid "information fatigue" (paras ~35-38) (read); also recommends giving profiling information (para 41) even where Art 22 is not engaged (read).
- Art 12(1): information must be "concise, transparent, intelligible and easily accessible form, using clear and plain language" (statute, not re-fetched).
- Representative identity must appear in the notice (EDPB 3/2018, see Q2).
- Consent text must itself be informed; consent guidelines require at minimum controller identity, purpose of each operation, the data types, right to withdraw, ADM use where relevant, transfer risks for Art 49(1)(a) (EDPB 05/2020, read, Part 3.3).

### Inferences
- Because Anthropic receives "up to 200 recent entries" (health data) via opt-in AI chat, the first layer at the AI-chat opt-in must say: what is sent, that it goes to a US-based processor, retention at the provider, that it is optional, and how to withdraw.
- Notice must be provided in languages the EU users use (language of the UI offered); EDPB general position on intelligibility - not specifically sourced in this session.
- Link the notice from the consent screen and keep version history (also supports demonstrating consent).

### Gaps
- No national DPA template for health-app notices retrieved (CNIL, Garante, AEPD).
- Mobile-specific placement guidance (app store privacy labels vs in-app notice) not researched.

## Q4. DPIA (Art 35) and Records of Processing (Art 30)

### Takeaway
A DPIA is very likely required if the processing is on a large scale or meets two WP248 criteria; this app plausibly meets sensitive-data + innovative-technology (AI) criteria, so do one, scaled to size; it also serves as the accountability artefact. The Art 30(5) 250-employee exemption does not save a sole operator because processing is not occasional and includes special-category data.

### Cited Findings
- Art 35(3)(b): DPIA required for "processing on a large scale of special categories of data referred to in Article 9(1)" (statute; quoted in WP248) (read, WP248 lines ~260) - [WP248 rev.01](https://ec.europa.eu/newsroom/article29/redirection/document/47711).
- WP248 rev.01 nine criteria incl. evaluation/scoring, sensitive data or data of a highly personal nature, data processed on a large scale, vulnerable data subjects, innovative use or applying new technological or organisational solutions; processing meeting two or more criteria will in most cases need a DPIA (read, lines ~286-363). WP248 notes health data on a large scale is "considered as likely to result in a high risk, and requires a DPIA" (line ~772). Large-scale factors: number of data subjects, volume/range of data, duration, geographic extent (WP243/WP248) (read).
- Art 35(4)-(5): each national SA publishes a list of operations requiring DPIA (and may publish a "no DPIA" list); lists are reviewed by EDPB for consistency (statute, not re-fetched). The French CNIL list (adopted 11 Oct 2018, JORF 6 Nov 2018) covers e.g. health data processing by health/medico-social establishments and large-scale location data via mobile apps; non-exhaustive (secondary) - [Simmons & Simmons summary](https://www.simmons-simmons.com/en/publications/ck0bcc809o1jf0b85opoqi6l2/271118-french-data-protection-impact-assessment); [Bird & Bird](https://www.twobirds.com/en/insights/2018/france/la-cnil-vient-de-publier-au-jorf-la-liste-des-traitements).
- Art 30(5): the Art 30(1)-(4) record-keeping duty does not apply to organisations with fewer than 250 employees "unless the processing it carries out is likely to result in a risk to the rights and freedoms of data subjects, the processing is not occasional, or the processing includes special categories of data as referred to in Article 9(1)" (statute, not re-fetched). EDPB reads "occasional" as not regular/outside regular business (EDPB 3/2018, read, citing the WP29 position paper on Art 30(5)).
- Art 30(2)/(1) and the representative: the representative maintains the Art 30 record on the controller's behalf; the non-EU controller supplies the primary content (EDPB 3/2018 section 4(d), read).
- Art 35(7) minimum DPIA content: systematic description of processing and purposes, necessity/proportionality assessment, risk assessment, mitigation measures (statute, not re-fetched). Art 36: prior consultation with the SA if residual high risk (statute).

### Inferences
- The app has at least "sensitive data" and "innovative use" (LLM chat) criteria; "vulnerable data subjects" (people struggling with addiction) is arguable. Together with unknown scale this points to doing a DPIA (lightweight, a few pages).
- A one-person controller still must keep an Art 30 record (the three Art 30(5) carve-backs are alternative, so special-category data alone suffices). A short table of purposes, data categories, recipients (Supabase, Vercel, Anthropic, Expo/EAS), transfers, retention and security measures is enough.

### Gaps
- The current (2026) national lists of Ireland, Germany, Italy, Spain, Netherlands were not retrieved; the CNIL entry is from a 2018 secondary summary, and its relevance to consumer wellness apps is unclear.
- No sourced threshold for "large scale" in user numbers.

## Q5. Processors (Art 28), US transfers (DPF status Nov 2026, SCCs/TIA), and Indian-controller onward transfers

### Takeaway
Supabase and Anthropic offer Art 28-style DPAs using SCCs (Modules 2/3), not the DPF. The Indian controller collecting directly from EU users is not itself making a Chapter V "transfer", but its disclosure to non-EEA processors is, so Art 28 + Chapter V apply. The DPF adequacy decision remains valid as of Nov 2026, but a CJEU appeal and a July 2026 EDPB letter create uncertainty: rely on SCCs as the primary mechanism and keep DPF only as a bonus.

### Cited Findings
- EDPB Guidelines 05/2021 on the interplay of Art 3 and Chapter V (read): three cumulative criteria for a "transfer": (1) exporter controller/processor subject to GDPR for the processing; (2) exporter discloses/makes data available to another controller/processor (importer); (3) importer in a third country. Example 1: a third-country controller "collects data directly from a data subject in the EU (under Article 3(2) GDPR)... This does not constitute a transfer ... Thus, Chapter V does not apply" (to that collection). Example 2: when that controller then "engages a non-EEA processor ... such disclosure ... would amount to a transfer, and it will be required to apply Article 28 and Chapter V obligations" - [EDPB Guidelines 05/2021 v2](https://www.edpb.europa.eu/system/files/2023-02/edpb_guidelines_05-2021_interplay_between_the_application_of_art3-chapter_v_of_the_gdpr_v2_en_0.pdf).
- Same Guidelines section 4 (read): where the same controller processes data outside the EU "without disclosing it to another controller or processor ... or in case of direct collection from individuals in the EU under Article 3(2) GDPR, the processing activity should not be regarded as a transfer under Chapter V" but safeguards for risks of processing abroad should still be considered. So the operator personally accessing data from India is not itself a transfer.
- DPF adequacy decision: Commission Implementing Decision (EU) 2023/1795 (10 July 2023). General Court dismissed Latombe v Commission (T-553/23) on 3 Sept 2025; appeal lodged 31 Oct 2025 (C-703/25 P), notice published OJ C/2025/6610 on 22 Dec 2025, contesting bulk-collection and the equivalence findings; appeal pending, no hearing/judgment date found - [Digital Policy Alert](https://digitalpolicyalert.org/event/35459-latombe-filed-appeal-against-general-court-dismissal-of-challenge-to-european-unionunited-states-data-protection-framework-adequacy-decision-in-latombe-v-commission); [WilmerHale](https://www.wilmerhale.com/en/insights/blogs/wilmerhale-privacy-and-cybersecurity-law-blog/20251201-european-court-of-justice-to-review-challenge-to-eu-us-data-privacy-framework) (not read in full).
- July 2026 development (secondary, single source): after the US Supreme Court's Trump v. Slaughter (29 June 2026, 6-3) held limits on removal of FTC Commissioners unconstitutional, EDPB Chair Anu Talus wrote to Commissioner McGrath on 31 July 2026 asking the Commission to "closely assess" the effect on the FTC's ability to enforce DPF commitments; the letter asks for assessment, not suspension; no court has annulled the decision; the article reports Skadden expects a CJEU ruling in early to mid 2027 - [gblock.app article](https://www.gblock.app/articles/edpb-eu-us-data-privacy-framework-review-slaughter-2026). Single secondary source; verify against EDPB/Commission primary documents.
- Supabase DPA (Mar 2026 version) (read via fetch summary): no DPF reference; transfers rely on EU SCCs Module 2 and 3 plus UK/Swiss addenda; sub-processor change notice at least 30 days (5 days to object); breach notice to customer "without undue delay, and where feasible, within forty-eight (48) hours"; customer can request a copy of data within 30 days after expiry, then deletion; assists with data subject requests - [Supabase DPA 260317](https://supabase.com/downloads/docs/Supabase+DPA+260317.pdf).
- Anthropic DPA (effective 24 Feb 2025 per search snippet; fetch summary): "incorporated into and forms part of the Anthropic Commercial Terms of Service or other agreement" referencing it; SCC Module 2/3 incorporated "to the extent required", Irish law/forum; no DPF mention on the page; general authorisation for Schedule 4 sub-processors with notice and 15-day objection; breach notice "without undue delay, but in any event within 48 hours"; return/delete within 30 days after termination - [Anthropic DPA](https://www.anthropic.com/legal/data-processing-addendum). Secondary sources conflict on whether Anthropic is DPF-certified; unverified.
- Art 28(3) mandatory contract terms (instructions only, confidentiality, security, sub-processor flow-down and authorisation, assistance with rights/Arts 32-36, deletion/return, audits) and Art 28(2),(4) sub-processor rules (statute, not re-fetched).
- Chapter V: Art 44 general principle, Art 45 adequacy (DPF covers only certified US importers), Art 46(2)(c) SCCs (Decision (EU) 2021/914); Art 49 derogations are exceptional (statute, not re-fetched).
- Vercel/Expo: secondary vendor lists suggest SCC + DPF reliance for Vercel but I could not confirm from Vercel's own DPA or the DPF list - [DSP Watch register (secondary)](https://dsp-watch-marketing.pages.dev/legal/sub-processors).

### Inferences
- Because direct collection by the Indian controller is not a transfer, India's lack of an EU adequacy decision does not by itself block the app; the Chapter V exposure arises when Supabase (US), Vercel (US) and Anthropic (US) receive the data. SCCs are the mechanism in the vendors' own DPAs.
- A transfer impact assessment (TIA) is expected when relying on SCCs; the DPF assessment of US law (EO 14086) is widely used as the basis for TIAs for US importers. I recall EDPB/Commission statements to that effect but did not verify in this session; the Slaughter issue and C-703/25 P are reasons to document a fallback.
- Supabase region us-east-2 is the AWS Ohio region; the project is thus US-hosted, no EU residency. Moving the Supabase project to an EU region would eliminate the Supabase transfer (but Vercel functions and Anthropic would remain US).
- The Anthropic data (health data, up to 200 entries) is the highest-risk flow; consider minimisation (fewer entries, aggregates only, strip free-text notes, user preview before send).
- Controller-side obligations: keep signed/accepted DPA copies, list sub-processors in the Art 13 notice (or link), track vendor sub-processor change notices, set up an annual vendor/DPF/SCC check.

### Gaps
- Expo/EAS DPA and sub-processors, Vercel's own DPA and DPF certification, and Anthropic's DPF status were not verified (no primary data pulled; a DPF list lookup at dataprivacyframework.gov is needed).
- Whether SCCs (2021/914) may be used when the exporter is a non-EU controller subject to Art 3(2) (the Commission's pending SCCs for importers/exporters subject to GDPR; Commission FAQ) not retrieved.
- Whether a Commission periodic review of DPF occurred in 2026 and its outcome not confirmed (first review concluded Oct 2024 per secondary sources; the next review timing not found).
- Anthropic API data retention for commercial use (e.g. 30-day abuse retention, zero-data-retention options) not verified here; must be disclosed in notice.

## Q6. Data subject rights, response time, portability, complaint

### Takeaway
Honour Arts 15-22 free of charge within one month (extendable by two months for complexity) through the representative and the operator; the export must be in "a structured, commonly used and machine-readable format" (JSON qualifies); tell users they may complain to their local SA.

### Cited Findings
- Art 12(3): respond "without undue delay and in any event within one month of receipt", extendable by two further months where necessary given complexity/number of requests, with notice of the extension within the first month; Art 12(5): free of charge unless manifestly unfounded or excessive; Art 12(6): may request additional information to confirm identity if reasonable doubts (statute, not re-fetched) - [GDPR](https://eur-lex.europa.eu/eli/reg/2016/679/oj).
- Art 15 access (copy of data), Art 16 rectification, Art 17 erasure (grounds incl. consent withdrawal 17(1)(b) where no other legal ground), Art 18 restriction, Art 19 notification to recipients (processors, Anthropic) of rectification/erasure, Art 20 portability: data provided by the subject, processed by consent (6(1)(a) or 9(2)(a)) or contract, by automated means, delivered in "a structured, commonly used and machine-readable format", and transmitted to another controller where technically feasible; Art 21 objection (absolute for direct marketing), Art 22 (statute, not re-fetched).
- Art 77: right to lodge a complaint with a supervisory authority in the Member State of habitual residence, workplace or place of alleged infringement; Art 79 judicial remedy against a controller; Art 80 representation by not-for-profit bodies; Art 82 compensation for material and non-material damage (statute, not re-fetched).
- Supabase DPA says it will forward data subject requests and provide reasonable assistance (Supabase DPA cl. 7) (see Q5 source).

### Inferences
- The existing JSON export plausibly meets Art 20 if it includes all user-provided logs (cigarettes, spend, mood/trigger/craving, notes) and consent history; observed/derived data (computed analytics) are borderline; including them is harmless.
- Erasure must propagate to Supabase backups on a stated schedule and to Anthropic (stored chat on provider side, if any) and analytics; document in the notice.
- Because there is no EU establishment, any EU SA can receive complaints; the representative must be able to receive and relay requests (EDPB 3/2018).
- Provide a contact route monitored daily by someone (representative + operator email); a one-month clock runs on receipt, including by the representative.

### Gaps
- No sourced EDPB guidance on portability scope for "inferred" data (WP242 on portability not retrieved).
- Standards for erasure from backups (retention-in-backup period accepted by DPAs) not researched.

## Q7. Breach notification (Arts 33/34) for a non-EU controller

### Takeaway
A non-EU controller subject to Art 3(2) has no lead supervisory authority and no one-stop-shop; EDPB Guidelines 9/2022 (2023) state the breach must be notified to every SA of each Member State where affected data subjects reside, within 72 hours of awareness unless unlikely to result in risk. This replaces the older WP250 suggestion to notify the representative's Member State.

### Cited Findings
- Art 33(1): notify the competent SA "without undue delay and, where feasible, not later than 72 hours after having become aware of it", unless the breach is "unlikely to result in a risk"; Art 33(2) processors notify controller without undue delay; Art 33(5) document all breaches; Art 34: communicate to data subjects without undue delay if "high risk" (statute, not re-fetched; also reproduced in WP250 lines ~389-410, read).
- EDPB Guidelines 9/2022 v2.0 (28 Mar 2023) (read) para 72-73: non-EU controller subject to Art 3(2) "is therefore still bound by the notification obligations under Articles 33 and 34"; "the mere presence of a representative in a Member State does not trigger the one-stop-shop system. For this reason the breach will need to be notified to every supervisory authority for which affected data subjects reside in their Member State. This (These) notification(s) shall be the responsibility of the controller." - [EDPB Guidelines 9/2022](https://www.edpb.europa.eu/system/files/2023-04/edpb_guidelines_202209_personal_data_breach_notification_v2.0_en.pdf).
- Older WP250rev.01 (2018) para (section on non-EU controllers) said "WP29 recommends that notification should be made to the supervisory authority in the Member State where the controller's representative in the EU is established" - superseded by the above (read) - [WP250 rev.01](https://ec.europa.eu/newsroom/article29/redirection/document/49827).
- Supabase and Anthropic DPAs commit to notify within 48 hours of awareness (Q5), which fits inside the controller's 72-hour clock only if the controller acts quickly: the controller is "aware" when a processor informs it (WP250/9/2022 treat processor awareness as controller awareness after notification).

### Inferences
- Plan: breach runbook with a template per SA; a table of Member States of active users (from country picker) to know which SAs apply; a 24-hour internal triage target given the vendors' 48-hour window; Art 34 user notice templates (health data: high risk is likely for a confidentiality breach of logs).
- Health data breach of notes/logs is likely a "high risk" incident, so Art 34 user notification is probable.

### Gaps
- National SA online breach-notification forms and languages not researched; whether SAs accept English not confirmed.
- Whether 9/2022 para 73 was updated after March 2023 not checked.

## Q8. ePrivacy Art 5(3): localStorage/AsyncStorage (chat transcript, UI flags), auth cookies, analytics

### Takeaway
Art 5(3) covers any storage of, or access to, information on a user's device, not only cookies; localStorage/AsyncStorage use triggers consent unless a "strictly necessary" or "sole purpose of transmission" exemption fits. Auth cookies requested by the user are exempt (session) but persistent login is not exempt unless the user opts in; UI flags set by the user's explicit action are exempt briefly or with consent; a persisted chat transcript is the weakest case, and the in-house analytics (even if first-party) needs consent, which the app already collects.

### Cited Findings
- EDPB Guidelines 2/2023 v2.0 (adopted 7 Oct 2024) (read): Art 5(3) ePD applies to "cookies, local storage, WebSQL" and similar; three criteria: information, terminal equipment of a subscriber/user, and storage/gaining access; "storage and access do not need to occur" together (the use of "stored or accessed" indicates they are independent); info is covered "regardless of whether or not it is personal data". Para 44: use of information inside the device by a local app "would not constitute a 'gaining of access to information already stored' ... as long as the information does not leave the device, but when this information or any derivation of this information is accessed, Article 5(3) ePD would apply." Para 53: if locally processed information is made available to a third party/sent back to a server, it "would constitute a 'gaining of access to information already stored'". Para 56: the guidelines do not analyse the exemptions in detail - [EDPB Guidelines 2/2023 v2](https://www.edpb.europa.eu/system/files/2024-10/edpb_guidelines_202302_technical_scope_art_53_eprivacydirective_v2_en_0.pdf).
- Art 5(3) ePD (Directive 2002/58/EC as amended by 2009/136/EC) permits storage/access without consent only for "the sole purpose of carrying out the transmission of a communication" or where "strictly necessary in order for the provider of an information society service explicitly requested by the subscriber or user to provide the service" (statute; quoted in Guidelines 2/2023 footnote 4) (read partially).
- WP29 Opinion 04/2012 (WP194) on cookie consent exemption (read): authentication cookies are exempt (session): "this authentication functionality is an essential part of the information society service he is explicitly requesting"; but "Persistent login cookies which store an authentication token across browser sessions are not exempted" unless e.g. a "remember me (uses cookies)" tick-box gives consent; UI customisation (language, display preference) set at the user's explicit request is exempt only for session/short-term; persistent preference storage needs consent or a clear notice next to the control; user-input and load-balancing session cookies are exempt; secondary uses (behavioural monitoring) are not - [WP194 Opinion 04/2012](https://ec.europa.eu/justice/article-29/documentation/opinion-recommendation/files/2012/wp194_en.pdf).
- ePrivacy is a Directive implemented nationally (e.g. TDDDG s.25 in Germany, CNIL rules in France), so details vary by Member State; the GDPR standard of consent applies to Art 5(3) consent (Recital 17 ePD, Art 2(f)) (statute; not re-fetched).
- Digital Omnibus (Commission proposal, 19 Nov 2025) proposes moving rules on storage of/access to terminal equipment into GDPR (new Arts 88a/88b) and adding exemptions; EDPB/EDPS opposed parts of the package in a Feb 2026 joint opinion; still in the ordinary legislative procedure with adoption not expected before 2027 per one analysis; I found no Parliament vote or Council general approach on the GDPR/cookie part - [Inside Privacy](https://www.insideprivacy.com/eu-data-protection/eu-regulators-issue-opinion-on-revisions-of-gdpr-and-other-data-laws/); [Sealmetrics summary](https://docs.sealmetrics.com/compliance/omnibus/gdpr-changes). Treat the omnibus as not in force in Nov 2026 (inference from absence of adoption evidence; secondary).

### Inferences
- localStorage/AsyncStorage items that never leave the device and are used only by the app's own code arguably fall outside "gaining access" (para 44), but Art 5(3) still covers "storage" by definition; whether pure client-side storage counts as "storage of information" when the page's own script writes it is not squarely answered in the guidelines read. Conservative reading: the write is "storage" that needs an exemption.
- UI flags (e.g. dismissed banners, theme, onboarding seen) set by explicit user action fit "UI customisation" exemption (WP194, short-term) or can be covered by a one-line notice; theme and consent-record flags are plausibly "strictly necessary" for a service the user requested (storing the consent choice itself is the standard example regulators accept; not sourced here).
- Chat transcript in localStorage: it is a user-requested feature, and storage is for the user's own continuity, so a "strictly necessary for the service explicitly requested" argument exists, but persisting beyond the session is weaker (WP194 UI-customisation reasoning); and if the transcript or any derivation is sent to the server (e.g. replayed to the AI endpoint), para 53 makes that a "gaining of access" too. Because it also holds health data, safest options: (a) make persistence opt-in as part of the AI-chat consent; (b) store only in sessionStorage; or (c) provide a visible "clear chat history" control and disclose it. Also mask/delete on logout (shared-device risk).
- Auth cookies/session tokens (Supabase auth cookies): exempt when session-scoped and user-requested; if the "stay signed in" persistence is the default, add a "remember me" choice or disclose. Mobile: AsyncStorage/SecureStore tokens are the same legal analysis (Art 5(3) covers apps; para 44 context).
- In-house analytics: not "strictly necessary"; EDPB Guidelines treat analytics identifiers/storing on the device as requiring consent unless a national authority exempts audience measurement (CNIL has an exemption for strictly limited audience measurement; not verified here). The app's opt-in consent for analytics is the right model; no analytics identifier should be set before consent; withdrawal must be as easy as consent.

### Gaps
- I did not read the EDPB 2/2023 text on whether a purely first-party write (script writes to localStorage without any reading) is "storage" in detail; para 56 shows the exemption analysis is not included.
- National positions (CNIL, Garante, AEPD, BfDI/TDDDG s.25) on UI flags and chat history not retrieved.
- CNIL's analytics exemption conditions not verified.

## Q9. Automated decision-making (Art 22), profiling disclosures, AI chat and goal proposals

### Takeaway
Art 22 is engaged only by decisions "based solely on automated processing ... which produces legal effects ... or similarly significantly affects" the person; a tracker's AI chat and goal suggestions that the user may accept or ignore do not qualify, but they are still profiling (Art 4(4)) and should be disclosed, and if they ever gate access or pricing, the Art 22(4) health-data restriction would bite.

### Cited Findings
- Art 22(1): right not to be subject to a decision based solely on automated processing, including profiling, producing legal effects or similarly significantly affecting the person; Art 22(4): such decisions must not be based on Art 9 data unless Art 9(2)(a) or (g) applies with suitable safeguards (statute, not re-fetched). Art 13(2)(f): disclose existence of ADM under Art 22(1) and (4), "meaningful information about the logic involved", significance and envisaged consequences.
- WP260 para 41 (read): information on ADM/profiling is required where Art 22 applies; "aside from the specific transparency requirements ... the points ... equally apply to profiling generally (not just profiling which is captured by Article 22), as a type of processing"; WP251 is the guidance on ADM/profiling - [WP260](https://ec.europa.eu/newsroom/article29/redirection/document/51025).
- WP248 criterion 1 (evaluation/scoring incl. profiling and predicting) counts toward DPIA need (read).
- The Digital Omnibus proposed changes touching Art 22 and an AI-related Art 9 exemption; the Council's first compromise reportedly dropped the most controversial GDPR changes (secondary), not in force - [Inside Privacy](https://www.insideprivacy.com/eu-data-protection/eu-regulators-issue-opinion-on-revisions-of-gdpr-and-other-data-laws/).

### Inferences
- Not Art 22: advice, summaries and proposals the user can ignore have no legal or similarly significant effect. Not verified against a DPA decision on health-app nudges.
- Still disclose: what the chat is, that it is generated by a third-party AI model, what is sent, that suggestions are not medical advice, and that no solely automated decisions with significant effects are made. Do not use the model to deny service or set pricing. Under Art 9, any model-generated inferences about health are themselves health data.
- If later features score/risk-rate users and drive consequential outcomes, revisit Art 22 and the DPIA.

### Gaps
- EU AI Act (Regulation (EU) 2024/1689) transparency duties for chatbots (Art 50, scheduled from 2 Aug 2026) and any delays via the AI omnibus were not researched; outside GDPR/ePrivacy scope but relevant for the AI chat.
- No DPA guidance on LLM health-chat consent retrieved (EDPB Opinion 28/2024 on AI models not read).

## Q10. Age (Art 8) and 18+ gating

### Takeaway
Art 8 sets 16 as the default digital-consent age (Member States may lower to 13) for information-society services offered directly to a child where consent is the basis; an 18+ app is outside Art 8 only if it genuinely excludes minors. The EDPB consent guidelines say age verification must be proportionate and, in low-risk cases, a self-declared year of birth can suffice, but health data raises the risk bar.

### Cited Findings
- Art 8(1): where Art 6(1)(a) applies to an ISS offered directly to a child, processing is lawful if the child is at least 16, or if below that age consent is given or authorised by the holder of parental responsibility; Member States may lower the age to not below 13; Art 8(2): reasonable efforts to verify taking into consideration available technology (statute, not re-fetched).
- EDPB Guidelines 05/2020 (read): para 135: "The mechanism chosen to verify the age ... should involve an assessment of the risk of the proposed processing. In some low-risk situations, it may be appropriate to require a new subscriber to a service to disclose their year of birth or to fill out a form stating they are (not) a minor. If doubts arise, the controller should review their age verification mechanisms ... and consider whether alternative checks are required"; age verification "should not lead to excessive data processing".
- Recital 38: children merit specific protection; Art 9 data of a child is, in addition, subject to Art 9 explicit consent (statute, not re-fetched).

### Inferences
- Because Art 9 data is processed, a bare "tick: I am over 18" is weak; date-of-birth collection at sign-up with a hard block under 18 (the app already collects DOB for features per project context) is a better "reasonable effort", with deletion of data of users found to be under 18 and a Terms clause. Heavy ID-based verification would conflict with data-minimisation; not required in my reading.
- A tobacco-related app attracting teens is a foreseeable minor-access scenario, so record the age-gate as a DPIA mitigation.

### Gaps
- EDPB Statement 1/2025 on age assurance (Feb 2025) and the Commission's DSA Art 28 minors' guidelines (July 2025) were not retrieved; I recall but could not verify them.
- Member State-specific Art 8 ages not tabulated.

## Q11. Retention, storage limitation and inactive accounts

### Takeaway
GDPR sets no fixed retention period; Art 5(1)(e) requires keeping identifiable data no longer than necessary, and Art 13(2)(a) requires disclosing the period or criteria. For a health tracker, define a rule (e.g. deletion after prolonged inactivity with advance notice) and apply it across Supabase, backups, analytics and the AI provider.

### Cited Findings
- Art 5(1)(e) storage limitation, Art 5(1)(c) data minimisation, Art 25 data protection by design/default, Art 32 security (encryption, pseudonymisation, resilience) and Art 17(1)(a) erasure when no longer necessary (statute, not re-fetched) - [GDPR](https://eur-lex.europa.eu/eli/reg/2016/679/oj).
- Art 13(2)(a): notice must state the retention period "or, if that is not possible, the criteria used to determine that period" (statute).
- Vendor deletion windows: Supabase deletes data after a 30-day post-termination window; Anthropic returns/deletes within 30 days of termination (see Q5 sources).
- No EU primary source retrieved on a specific inactive-account period for health apps.

### Inferences
- A reasoned policy: delete or irreversibly anonymise accounts after a stated inactivity window (commonly 12-24 months in DPA practice; unsourced here), with an email warning, and delete AI-provider-side data/logs with the account. Retain only minimal records of consent and deletion for accountability (Art 7(1)) for a limited period, plus the legal-claims retention the operator can justify.
- Under Art 9(2)(a), withdrawing consent should also trigger deletion unless another valid basis exists.

### Gaps
- No sourced national DPA position on inactive-account retention for health apps (CNIL's guidance on retention for accounts was not retrieved).
- Backup retention period norms not researched.

## Q12. Consolidated checklist for Smoke Ledger (derived from the above)

### Takeaway
Minimum viable EU compliance set: representative, Art 9 explicit consent flows, full Art 13 notice with layered first layer, DPIA + Art 30 record, signed DPAs/SCCs with TIA, rights process, breach runbook with multi-SA notification, Art 5(3) review of storage items, age gate, and retention policy.

### Cited Findings
- Every item below is sourced in the sections above; section reference in brackets.

### Inferences
1. Appoint an EU representative (Art 27(1)); put its identity in the notice and app store legal page [Q2].
2. Treat all logs as Art 9 data; obtain separate explicit consent before first health-data logging, store version/timestamp, enable withdrawal as easily as giving [Q1].
3. Separate opt-in consents for AI chat (Anthropic transfer) and analytics; do not bundle with Terms (Art 7(4)) [Q1, Q8].
4. Publish the full Art 13 notice (all Art 13(1)-(2) items) and a first-layer summary at the consent screen (purposes, controller, rights, surprising processing) [Q3].
5. Do a DPIA (Art 35) and keep an Art 30 record (the Art 30(5) exemption fails: not occasional + special-category data) [Q4].
6. Execute/accept DPAs with Supabase, Vercel, Anthropic, Expo; document SCCs (Module 2/3), a TIA, and a DPF/SCC fallback in light of C-703/25 P and the 2026 EDPB letter; verify DPF certification on dataprivacyframework.gov; list sub-processors/transfers in the notice [Q5].
7. Build the rights workflow: one-month SLA, free, JSON export, erasure propagating to processors/backups, complaint-to-SA wording [Q6].
8. Breach runbook: 72h clock, notify every SA where affected users reside (non-EU controller), Art 34 user notices [Q7].
9. ePrivacy: classify each localStorage/AsyncStorage/cookie item; exempt auth session and explicit UI choices; gate chat-transcript persistence and analytics identifiers behind consent; add clear-history control [Q8].
10. Disclose profiling/AI use; avoid solely automated significant decisions [Q9].
11. Hard 18+ gate via DOB, delete underage accounts [Q10].
12. Publish retention rules and apply an inactivity-deletion policy [Q11].

### Gaps
- Not covered here: AI Act transparency for chatbots, Digital Services Act/consumer-law obligations, national law specifics (e.g. Germany BDSG health provisions), and any prior-consultation (Art 36) analysis.
- All "as of November 2026" status claims come from search results; specifically, the Latombe appeal status and the EDPB July 2026 letter rely on secondary sources and should be re-checked against the CJEU docket and the EDPB website before publication.

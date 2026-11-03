# Non-privacy rules shaping the Smoke Ledger user agreement (India + EU, as of 2 Nov 2026)

Scope: free app, adults 18+, web + iOS/Android, opt-in Claude-based chat narrating the user's own ledger, health-milestone info + "not medical advice", individual operator in India.

Evidence key used below:
- **[FETCHED]** = page opened this session and read.
- **[SEARCH]** = only seen in a web-search summary (secondary, law-firm/blog level); verify against primary text.
- **[UNVERIFIED-IN-SESSION]** = statement of the primary legal text from background knowledge; the linked instrument was NOT opened this session (tool budget exhausted; WebFetch of EUR-Lex returned empty). Treat as "verify before relying". Article numbers are given so a reviewer can check fast.
- "Interpretation" = my reasoning, not primary text.

Tool/budget caveat: ~15 tool calls. India Gazette texts (dark-patterns Annexure, E-Commerce Rules, IT Rules, COTPA) were not opened in primary form.

---

## 1. EU consumer-contract rules: UCTD 93/13, Digital Content Directive 2019/770, Consumer Rights Directive, Omnibus, forum/law clauses

### Takeaway
The ToS must be plain-language, must not exclude liability for death/personal injury or negligence, must not allow unilateral changes without a stated valid reason and notice/exit, and cannot oust the EU consumer's home-country mandatory law or court (Rome I Art 6, Brussels Ia Arts 17-19). Whether the DCD/CRD formally apply to a free app depends on whether personal data is processed beyond what is needed to supply the service; the UCTD does not depend on price. (Interpretation on applicability.)

### Cited Findings
- UCTD Annex (indicative, non-exhaustive list of terms that may be unfair) is published as the Annex to Art 3(3). Point 1(a) = terms excluding/limiting liability for consumer's death or personal injury resulting from an act or omission of the seller/supplier; point 1(j) = unilateral alteration of terms without valid reason specified in the contract; CJEU has ruled on 1(j)/2(d) and Art 3(1),(3), 6(1) — [legislation.gov.uk copy of Annex (retained text)](https://legislation.gov.uk/eudr/1993/13/annexes) [SEARCH]; CJEU rulings are referenced at [iclr.co.uk judgment](https://www.iclr.co.uk/document/2011211640/casec14313/html) [SEARCH].
- UCTD text itself (EUR-Lex): Art 3(1) (term unfair if contrary to good faith and causes significant imbalance, to consumer's detriment, in non-individually-negotiated terms); Art 4(2) and Art 5 (plain, intelligible language; ambiguity construed in consumer's favour); Art 6(1) (unfair terms not binding on consumer, contract continues if possible); Annex 1(a) death/personal injury, 1(b) inappropriately excluding/limiting legal rights vs supplier on non-performance, 1(j) unilateral change of terms without valid reason, 1(k) unilateral change of characteristics of the service without valid reason, 1(q) excluding/hindering the right to take legal action (e.g. exclusive arbitration not covered by law) — [UCTD on EUR-Lex](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:31993L0013) [UNVERIFIED-IN-SESSION].
- Omnibus Directive 2019/2161 amended the CRD (new Art 3(1a): CRD applies also where a trader supplies digital content/service and the consumer provides personal data, except where data is processed exclusively to supply the content/service or to meet legal requirements) and added UCTD penalty provisions (Art 8b) — [Omnibus on EUR-Lex](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32019L2161) [UNVERIFIED-IN-SESSION].
- DCD 2019/770: Art 3(1) scope covers contracts where the consumer pays a price OR provides personal data, with the same "exclusively processed to supply / legal requirements" carve-out; Art 7-8 conformity (subjective/objective, incl. updates, Art 8(2)); Art 11 trader liable for lack of conformity during continuous supply; Art 19 modification: allowed only if contract permits and gives valid reason, no extra cost, clear info, and where modification more than minimally negatively impacts access/use the consumer gets reasonable advance notice and a right to terminate free of charge within 30 days; Art 22 (mandatory; contrary terms not binding) — [DCD on EUR-Lex](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32019L0770) [UNVERIFIED-IN-SESSION; WebFetch of this URL returned empty].
- CRD 2011/83: Art 6(1) pre-contract information; Art 9 14-day withdrawal; Art 16(m) loss of withdrawal for non-tangible-medium digital content only with prior express consent + acknowledgement; Art 16(a) service fully performed with consent. Only relevant if/when a paid tier or CRD-covered data-for-service exists — [CRD on EUR-Lex](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32011L0083) [UNVERIFIED-IN-SESSION].
- Rome I Reg 593/2008 Art 6(1)-(2): consumer contract governed by law of consumer's habitual residence if trader directs activity to that country; parties may choose another law but cannot deprive the consumer of the mandatory protections of the habitual-residence law — [Rome I](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32008R0593) [UNVERIFIED-IN-SESSION].
- Brussels Ia Reg 1215/2012: Art 17(1)(c) consumer section applies where trader "directs" activities to the consumer's Member State; Art 18(1) consumer may sue in own domicile (applies even if trader is non-EU, via Art 6(1)); Art 18(2) trader may sue consumer only in consumer's domicile; Art 19 jurisdiction clauses only valid if agreed after dispute arises, or widen consumer's options, or both domiciled in same State — [Brussels Ia](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32012R1215) [UNVERIFIED-IN-SESSION].
- UCPD 2005/29 Annex I point 17 blacklists "falsely claiming that a product is able to cure illnesses, dysfunction or malformations" — relevant to health-milestone copy — [UCPD](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32005L0029) [UNVERIFIED-IN-SESSION].
- New Product Liability Directive (EU) 2024/2853: software (incl. AI) is a "product"; transposition deadline 9 Dec 2026, applies to products placed on the market after that date; liability cannot be excluded by contract; applies to products supplied in the course of commercial activity — [PLD](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32024L2853) [UNVERIFIED-IN-SESSION]. Interpretation: a hobbyist free app may fall outside "commercial activity", but this is untested.

### Inferences
- **Must include (EU consumers):** plain-language ToS; identity/contact of operator; description of service + AI feature; what is free and what data is used (cross-ref to privacy policy only); update/modification clause with valid reasons + notice + free exit; account termination terms symmetrical; no waiver of statutory rights.
- **Must not include:** (i) exclusion of liability for death/personal injury/negligence/gross negligence/intent (Annex 1(a), DCD Art 22, PLD); (ii) "we may change terms at any time without notice"; (iii) exclusive Indian courts/arbitration or Indian-law-only clause binding EU consumers (use "without prejudice to mandatory consumer protections of your country of residence" and allow consumer to sue at home); (iv) "as is, no warranty" disclaimers purporting to override DCD conformity (if DCD applies); (v) any health "cure/treat" claim.
- Safe drafting: Indian law as default governing law is allowed under Rome I Art 6(2) only with a savings clause; forum clause must give EU consumers their domicile courts.
- If personal data used only to run the service (no ads/analytics resale), DCD/CRD scope under Art 3(1)/3(1a) likely not triggered — but keep to the standard anyway; UCTD applies regardless of price (interpretation).

### Gaps
- EUR-Lex texts not opened (all [UNVERIFIED-IN-SESSION] items); no CJEU case on whether a free-of-charge, no-ads app falls in DCD scope found.
- ODR platform: I recall the EU ODR platform was repealed in 2025 (so no ODR link needed) but found no source this session — verify before deleting any ODR clause.
- Digital Fairness Act (dark patterns/addictive design/subscription traps) — Commission proposal expected H2 2026; status not checked. Verify whether proposed/adopted.

---

## 2. DSA applicability

### Takeaway
Almost certainly not an "intermediary service" (no hosting of third-party content; chat output is the operator's own service). No DSA ToS (Art 14) or notice-and-action duties.

### Cited Findings
- DSA (Reg 2022/2065) Art 3(g) defines intermediary services as mere conduit, caching, or hosting of information provided by recipients of the service; Art 14 T&C duties and Arts 16-17 notice/statement-of-reasons apply to intermediaries/hosting providers — [DSA on EUR-Lex](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32022R2065) [UNVERIFIED-IN-SESSION].

### Inferences
- Single-user private ledger with no sharing/UGC => not hosting "for dissemination to the public" (Art 3(i)); not intermediary. If a community, comments, public sharing, or shareable cards are ever added, re-assess (micro/small enterprise relief exists in Art 19 for platform duties).
- Apple 1.2 (UGC) mentions "AI content creation apps" but concerns apps where users create/share content; see section 7.

### Gaps
- No Commission guidance specific to personal-tracker apps found.

---

## 3. EU AI Act: Art 50 transparency, timing, risk class; MDR/MDCG 2019-11

### Takeaway
The chat is a limited-risk system: Art 50(1) requires telling users they are talking to AI unless obvious (in force 2 Aug 2026, not delayed). Art 50(2) machine-readable marking of AI text output: Digital Omnibus deal pushes it to 2 Dec 2026 for systems already on market before 2 Aug 2026 (adoption status unconfirmed). Not high-risk unless marketed with a medical purpose (MDR) — keep the intended purpose non-medical.

### Cited Findings
- Art 50(1): providers must design AI systems that interact directly with natural persons so people are informed they are interacting with AI, unless obvious to a reasonably well-informed, observant and circumspect person — [artificialintelligenceact.eu Art 50](https://artificialintelligenceact.eu/article/50/) [FETCHED, paraphrase].
- Art 50(2): providers of AI systems generating synthetic audio, image, video or text must ensure outputs are "marked in a machine-readable format and detectable as artificially generated or manipulated"; exemption for assistive function for standard editing / no substantial alteration of input — [same](https://artificialintelligenceact.eu/article/50/) [FETCHED].
- Art 50(5): information must be given "in a clear and distinguishable manner at the latest at the time of the first interaction or exposure" and meet applicable accessibility requirements — [same](https://artificialintelligenceact.eu/article/50/) [FETCHED].
- Art 50(4) (deepfakes; AI text published to inform public on matters of public interest) — not triggered by private ledger narration (interpretation) — [same](https://artificialintelligenceact.eu/article/50/) [FETCHED].
- Page states Art 50 applies from 2 Aug 2026 (Art 113); it flags paragraph 7 text as differing/amended — [same](https://artificialintelligenceact.eu/article/50/) [FETCHED].
- Digital Omnibus on AI: trilogue deal 7 May 2026; Art 50(2) marking for generative systems placed on the market before 2 Aug 2026 postponed to 2 Dec 2026; systems placed after 2 Aug 2026 get no grace; Art 50(1) chatbot disclosure NOT delayed; sources conflict on whether formal adoption/OJ publication has occurred — [Taylor Wessing](https://taylorwessing.com/en/insights-and-events/insights/2026/05/the-eu-digital-omnibus-on-ai-what-the-political-deal-means), [William Fry](https://www.williamfry.com/knowledge/eu-ai-act-omnibus-deal-reached-postponed-deadlines-watermarking-compromise-and-the-nudificiation-prohibition/), [CSA note](https://labs.cloudsecurityalliance.org/research/csa-research-note-eu-ai-act-article50-watermarking-deadline/), [iubenda "AI Omnibus adopted"](https://www.iubenda.com/en/?p=222226) [SEARCH]; adoption status contradicted/unclear across these results.
- MDCG 2019-11 Rev.1 (published June 2025) is the Commission guidance on qualification and classification of software under MDR/IVDR; outcome hinges on the manufacturer's intended purpose, not the technology; Rule 11 (MDR Annex VIII) applies to software that provides information for diagnosis/therapy decisions or monitors physiological processes — [OpenRegulatory](https://openregulatory.com/mdcg/mdcg-2019-11), [Emergo by UL](https://www.emergobyul.com/news/european-revision-primary-software-guidance-mdcg-2019-11-revision-1-small-changes-meaningful), [Osborne Clarke](https://www.osborneclarke.com/insights/eu-confirms-app-stores-and-developers-are-subject-medical-device-laws) [SEARCH]; one source says Rev.1 did not change Rule 11's structure, others say it enhanced interpretation — conflict unresolved.
- Google is revising its Health and Medical Functionalities policy to incorporate MDCG guidance for EU-targeted apps — [Google policy preview](https://notifications.google.com/g/p/ANiao5qIQNpa6DcMDbTXOV7AyVoX9rLYOFtI6WwMKD2jF6NyLQPiwb5SThBivA1TcUU1yRpVtXpoUcPYQnUEqzE8kIR21oGDv1K-7A0KFtVYIvL4RW1nK7iEgjiSAS2jiGVNcUdJSgBc2hR2KM4kwwdmhPVR38Lq77-orvOfWqoJqTjdSZUMm9otnmbQT8U5JVhNwx3vKrJBOb2MwJE1escG5YsxdkWejSr_oOwdDWFVl6Nf4bZQzT4KyqY7B-r-g7PpzXoRYKFLFWBdv_PsTrtqyy05XRxUNXxat8vg) [SEARCH].
- MDR Art 2(1): "medical device" defined by manufacturer's intended purpose of diagnosis, prevention, monitoring, prediction, prognosis, treatment or alleviation of disease; Art 2(12) intended purpose derived from labelling, instructions for use, promotional/sales materials — [MDR](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32017R0745) [UNVERIFIED-IN-SESSION].
- AI Act high-risk: Art 6(1) + Annex I (incl. MDR) safety-component route requires third-party conformity assessment; Art 6(2) + Annex III list (no entry for wellness/habit trackers); Art 5(1)(a)-(b) prohibits manipulative/subliminal techniques and exploiting vulnerabilities due to age/disability/socio-economic situation; Art 4 AI literacy; Art 25/3(3) a company building a product on a third-party GPAI model and offering it under its name is a "provider" of the AI system — [AI Act](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32024R1689) [UNVERIFIED-IN-SESSION].

### Inferences
- **UI must:** label the chat as AI at entry and in the first message ("AI assistant built on Claude, not a person"), before/at first interaction, accessible (screen-reader text), plus ToS section describing AI feature, opt-in, data sent to the model provider (cross-ref privacy), accuracy limits, no medical advice.
- Since Smoke Ledger ships an AI chat under its own brand it is likely the "provider" of that AI system (not merely deployer), so 50(1) (and nominally 50(2)) falls on it; Anthropic is the GPAI-model provider. Whether Anthropic's API output marking satisfies 50(2) for text in a private chat is an open point; pragmatic mitigation = persistent "AI-generated" label on every assistant message + metadata flag in stored messages. (Interpretation.)
- Not high-risk provided no medical intended purpose: avoid claims of treating/reducing nicotine dependence, diagnosing, personalised cessation therapy, or clinical-risk scoring; milestone copy should be general public-health info with sources. A certified smoking-cessation digital therapeutic would be MDR territory; this app should not be marketed as one. A "not medical advice" disclaimer alone does not defeat qualification if marketing implies a medical purpose (intended purpose test, Art 2(12) — [UNVERIFIED-IN-SESSION]).
- Guardrail design for Art 5 (manipulation/vulnerability): chat should not use guilt/shame pressure; nicotine-dependent users are plausibly "vulnerable" in a loose sense, though Art 5 lists age/disability/socio-economic situation only (interpretation).

### Gaps
- Official Journal publication/entry into force of the AI Omnibus not confirmed; the Commission's Code of Practice on marking/labelling AI content and any Art 50 guidelines not reviewed.
- Primary MDCG 2019-11 Rev.1 PDF not opened (a copy exists at pharmadeutschland.de link in search results); no wellness-specific "lifestyle" wording verified.
- Whether AI Omnibus changed Art 4 AI literacy duty — not checked.

---

## 4. European Accessibility Act (Directive 2019/882)

### Takeaway
Likely out of scope: (a) a free app that concludes no consumer sale is a doubtful "e-commerce service", and (b) a sole operator qualifies as a microenterprise service provider (exempt under Art 4(5)). Still treat WCAG 2.1 AA/EN 301 549 as a design norm (also because AI Act Art 50(5) refers to accessibility requirements).

### Cited Findings
- Art 4(5): microenterprises providing services are exempt from the Art 4(3) accessibility requirements and related obligations — [legislation.gov.uk Art 4](https://www.legislation.gov.uk/eudr/2019/882/article/4) [SEARCH snippet quotes the text]; [Taylor Wessing](https://www.taylorwessing.com/en/interface/2025/accessibility/key-eu-accessibility-act-exemptions-and-the-challenges-they-pose) [SEARCH].
- Microenterprise = under 10 persons AND turnover or balance sheet <= EUR 2m (Recommendation 2003/361/EC); exemption is for services only, not products — [accessible.org](https://accessible.org/top-10-eaa-questions/), [xictron](https://www.xictron.com/en/blog/accessibility-act-exemptions-microenterprises-2026/) [SEARCH]; some secondary sources mis-cite as Art 4(3); official text is 4(5).
- E-commerce services are covered: defined as services provided at a distance through websites and mobile-device-based services at individual request of consumer with a view to concluding a consumer contract — [Herzog guide](https://herzoglaw.co.il/wp-content/uploads/2025/06/The-European-Accessibility-Act.pdf) [SEARCH]. EAA applies from 28 June 2025 (Art 32) — [EAA](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32019L0882) [UNVERIFIED-IN-SESSION].
- Member states may differ in transposition (e.g. Ireland S.I. 636/2023 disapplies service obligations for microenterprises) — [learnsignal](https://www.learnsignal.com/blog/european-accessibility-act-ireland-si-636-2023-requirements/) [SEARCH].

### Inferences
- ToS need no EAA clause. If a paid tier / in-app purchase is added, reassess "e-commerce service" scope; microenterprise exemption would still likely cover an individual operator (single-person, under EUR 2m) — but not if the operator grows to 10+ staff or EUR 2m+.
- Free apps are not obviously covered; no Commission/case-law answer found (Gap).

### Gaps
- No primary or Commission FAQ on free apps; no check of national transposition for specific Member States.

---

## 5. India: Consumer Protection Act 2019, E-Commerce Rules 2020, dark-patterns guidelines, IT Rules 2021, Contract Act

### Takeaway
A genuinely free app with no consideration is probably outside the CPA "service"/"consumer" definitions, so CPA/E-Commerce Rules likely do not bind it directly; but the CCPA dark-pattern guidelines are a cheap standard to meet, and the operator should publish a grievance contact. IT Rules intermediary duties are arguable; a light acceptable-use + grievance clause is the safe course.

### Cited Findings
- CPA 2019 s.2(42) "service" excludes services rendered free of charge and contracts of personal service; Kerala HC applied this to medical services; commentary: wholly free services generally outside the Act unless part of a larger paid transaction — [iPleaders](https://blog.ipleaders.in/services-covered-consumer-protection-act-2019/), [Prime Legal on Kerala HC](https://blog.primelegal.in/medical-services-fall-within-the-ambit-of-the-consumer-protection-act-2019-unless-it-is-free-of-charge-or-under-a-contract-of-personal-service-kerala-high-court/), [Nyaaya](https://nyaaya.org/legal-explainer/what-are-services/) [SEARCH].
- CCPA Guidelines for Prevention and Regulation of Dark Patterns, 2023: issued under s.18 CPA 2019; effective 30 Nov 2023; Annexure 1 lists thirteen practices with illustrations; covers confirm shaming (emotional pressure through guilt/shame/fear) and subscription trap (cancellation harder than sign-up, hidden cancel, payment details demanded for "free" trial); commentary suggests the binding obligation (Guideline 5) is tied to Annexure 1 practices — [JSA](https://www.jsalaw.com/newsletters-and-updates/ccpa-issues-guidelines-for-prevention-and-regulation-of-dark-patterns-2023/), [SCC Online](https://www.scconline.com/blog/post/2023/12/04/ccpa-notifies-guidelines-for-prevention-and-regulation-of-dark-patterns-2023-legal-news/), [Vidhi](https://vidhilegalpolicy.in/?p=28004) [SEARCH].
- The 13 patterns (from my recollection of Annexure 1; not confirmed by fetched text): false urgency, basket sneaking, confirm shaming, forced action, subscription trap, interface interference, bait and switch, drip pricing, disguised advertisement, nagging, trick question, SaaS billing, rogue malwares — [CCPA draft PDF](https://consumeraffairs.nic.in/sites/default/files/file-uploads/latestnews/Draft%20Guidelines%20for%20Prevention%20and%20Regulation%20of%20Dark%20Patterns%202023.pdf) (draft; final list may differ) [UNVERIFIED-IN-SESSION].
- IT Rules 2021: Rule 3(1)(b) intermediaries must publish rules/regulations/privacy policy/user agreement informing users not to host/transmit listed unlawful content; Rule 3(2) grievance mechanism (publish grievance officer's name/contact on website/app; acknowledge within 24 hours, dispose within 15 days per commentary) — [Nishith Desai](https://nishithdesai.com/research-and-articles/hotline/technology-law-analysis/additional-compliances-for-intermediaries-under-recently-amended-intermediary-guidelines-8335), [Vajiram](https://vajiramandravi.com/current-affairs/it-rules/), [FoxMandal](https://foxmandal.in/?p=29079) [SEARCH].
- MeitY advisory (Mar 2024) says intermediaries must ensure AI/LLM/generative-AI use complies with Rule 3(1)(b); a 2026 amendment regulating "synthetically generated information" exists — [Conventus](https://conventuslaw.com/report/india-demystifying-meitys-advisory-for-intermediary-compliance-dated-march-01-2024/), [Managing IP](https://www.managingip.com/article/2g3bz6kdk7qxkoxxcsg00/sponsored-content/regulating-synthetically-generated-information-india-amends-it-intermediary-rules), [AZB tracker July 2026](https://www.azbpartners.com/wp-content/uploads/2026/07/India_AI_Regulatory-Tracker-July-03-2026-002.pdf) [SEARCH; contents not read].
- Indian Contract Act 1872 points from background: s.10/11 (competence: adults 18+; minor's contract void), s.23, s.28 (restraint of legal proceedings; arbitration exception), s.74; IT Act 2000 s.10A (electronic contracts not unenforceable for being electronic) — [India Code](https://www.indiacode.nic.in/) [UNVERIFIED-IN-SESSION]. Exclusive-jurisdiction clause between two competent courts is generally valid (ABC Laminart v. A.P. Agencies, 1989 — from memory) [UNVERIFIED-IN-SESSION].

### Inferences
- **Clickwrap:** enforceable if there is a clear affirmative act (checkbox/tap "I agree" with link to current terms), version + timestamp logged, 18+ confirmation. Avoid browsewrap-only. Do not pre-tick.
- **Dark patterns to avoid in quit-nudges even if guidelines don't bind a free app:** confirm-shaming copy ("No, I don't care about my health"), nagging/repeated prompts to enable AI chat or notifications, forced action (requiring AI opt-in or notifications to use the ledger), trick questions in consent toggles, hard-to-find account deletion/cancel. Brand tone ("never alarm-red", no streak-shaming) already aligns.
- **IT Rules:** because the app stores users' records "on behalf of" users, it could be literally within IT Act s.2(1)(w) intermediary (broad reading), but there is no public dissemination; Rule 3(1)(b) prohibited-content list adds little. Cheap safe option: include an acceptable-use clause + name a grievance contact (also useful for DPDP, other researchers' scope). Interpretation, no authority found.
- India governing law: Indian law + courts of operator's city for Indian users is fine; arbitration optional; do not bind consumers (CPA consumers may sue at their own place, s.34/s.47 per background; [UNVERIFIED-IN-SESSION]) to an exclusive forum if CPA applies.
- Indian courts treat grossly one-sided standard-form exclusions skeptically (Brojo Nath Ganguly 1986 — from memory) [UNVERIFIED-IN-SESSION].

### Gaps
- E-Commerce Rules 2020 text not opened; no authority on whether a free, no-sale app is an "e-commerce entity" (my reading: "electronic commerce" = buying/selling goods/services, so no).
- Dark-patterns Guideline 3 (applicability), the final Annexure 1 wording, and any CCPA 2025-26 self-audit directions not opened.
- Content of the 2026 IT Rules amendment on synthetic content (labelling duties, who is covered) not read; high priority to verify since the app has a generative feature offered in India.
- No Indian case law on free apps as "service" found.

---

## 6. India COTPA 2003: what a cigarette brand/price tracker must avoid

### Takeaway
s.5 bans direct and indirect advertisement, promotion and sponsorship of tobacco products; the safe design is to treat brand as user-entered plain text for self-tracking with no logos, pack imagery, brand promotion, retailer links, discounts or price comparison. No authority was found applying COTPA to a quit-aid app.

### Cited Findings
- COTPA s.5: prohibition of direct or indirect advertisement, promotion and sponsorship of tobacco products, with limited exceptions (pack advertising, point-of-sale as restricted) — [eParliament note](https://eparlib.nic.in/bitstream/123456789/605019/1/107477.pdf), [COTPA 2003 text (Goa Tourism PDF)](https://www.goatourism.gov.in/wp-content/uploads/2021/07/COTPA-2003.pdf), [Morung Express](https://morungexpress.com/highlights-on-provision-of-cigarettes-and-other-tobacco-products-act) [SEARCH; statute PDF not read].
- s.7: every cigarette pack must carry specified (pictorial) health warnings; s.4 concerns smoking in public places (not relevant to apps) — [same sources](https://www.goatourism.gov.in/wp-content/uploads/2021/07/COTPA-2003.pdf) [SEARCH].
- Definition of "advertisement" in s.2(a) (any visible representation by notice, label, wrapper etc., and announcements by any means of transmitting light, sound...) — from background; verify — [COTPA text](https://www.goatourism.gov.in/wp-content/uploads/2021/07/COTPA-2003.pdf) [UNVERIFIED-IN-SESSION].
- Apple 1.4.3: "Apps that encourage consumption of tobacco and vape products ... are not permitted"; "Facilitating the sale of ... tobacco is not allowed" — [Apple Guidelines](https://developer.apple.com/app-store/review/guidelines/) [FETCHED].

### Inferences
- **Avoid:** brand logos/pack images/colour trade dress, brand-keyed marketing, sponsored content, affiliate or retail links, "cheapest brand" or promotional pricing, in-store listing screenshots showing brands or pack art, brand names in app title/keywords/store metadata (also trademark-in-metadata issues). Showing the user's own entered price/brand string in their own ledger is informational, not promotion (interpretation, untested).
- ToS: state the app does not promote or sell tobacco and is for reducing/quitting; prohibit use to market tobacco. Keep language reduction-oriented to satisfy Apple 1.4.3.
- Vape/ENDS: sale/advertising banned in India under the PECA 2019 — [background, unverified]; do not add vape tracking with brand content.

### Gaps
- Statute text and COTPA Rules not read in primary form; no MoHFW/MIB advisory on apps or OTT found; no case law on tracker apps.

---

## 7. App-store rules: Apple and Google

### Takeaway
Both stores require in-app account deletion, a privacy policy link, health disclaimers, and (Apple) explicit consent before sharing personal data with third-party AI. Google requires a Health apps declaration and a "not a medical device" disclaimer in the store description.

### Cited Findings
- **Apple 5.1.1(v):** if the app supports account creation it must offer account deletion within the app; do not require personal info beyond what is relevant; do not require login unless account-based features — [Apple Guidelines](https://developer.apple.com/app-store/review/guidelines/) [FETCHED, verbatim].
- **Apple 5.1.2(i):** must clearly disclose where personal data is shared with third parties "including with third-party AI" and obtain explicit permission before doing so; apps may not require enabling push/tracking etc. to use features — [same](https://developer.apple.com/app-store/review/guidelines/) [FETCHED].
- **Apple 1.4.1:** medical apps that could provide inaccurate data may get greater scrutiny; accuracy claims need disclosed methodology; "Apps should remind users to check with a doctor in addition to using the app and before making medical decisions"; submit regulatory clearance if any — [same](https://developer.apple.com/app-store/review/guidelines/) [FETCHED].
- **Apple 5.1.3:** health/fitness data not used for advertising/marketing/data mining; do not store personal health information in iCloud; 5.1.1(i)-style privacy policy link and App Privacy "nutrition label" are separate App Store Connect items (not seen in fetched text) — [same](https://developer.apple.com/app-store/review/guidelines/) [FETCHED for 5.1.3 only].
- **Apple 4.8:** if third-party/social login used for primary account, must offer an equivalent privacy-preserving login (Sign in with Apple or similar) — [same](https://developer.apple.com/app-store/review/guidelines/) [FETCHED].
- **Apple 1.2 / 4.7:** UGC and AI content creation apps need filtering, report mechanism, blocking, contact info; 4.7 covers chatbots/plug-ins offered inside apps — [same](https://developer.apple.com/app-store/review/guidelines/) [FETCHED]. Interpretation: 1.2 likely not triggered by a private single-user ledger narration, but a visible "report a response" link and contact details are cheap insurance.
- **Apple guideline pages truncated:** only first 100,000 of 114,428 chars read; 2.3.7 (metadata) and 5.1.1(i) privacy-policy wording not confirmed.
- **Google Play Health apps policy:** all developers must complete the Health apps declaration on App content page; privacy policy link in console and in-app, publicly accessible, non-editable, non-geofenced, not a PDF; non-regulated health apps must include a disclaimer in the store description stating the app is "not a medical device and does not diagnose, treat, cure, or prevent any medical condition" and remind users to consult a healthcare professional; misleading/harmful health functionality prohibited; misleading health claims contradicting medical consensus prohibited — [Google Play Health apps policy](https://support.google.com/googleplay/android-developer/answer/16679511) [FETCHED]; declaration is mandatory even for apps with no health features (they declare none) — [Health apps declaration help](https://support.google.com/googleplay/android-developer/answer/14738291) [SEARCH].
- **Google Play account deletion:** requirement + Data safety "Data deletion" questions; deadlines: form by 7 Dec 2023 (extendable to 31 May 2024); enforcement after 31 May 2024 — [Google help: account deletion](https://support.google.com/googleplay/android-developer/answer/13327111) [FETCHED]; the requirement for an in-app deletion path plus a web-based deletion link in Play Console is from background [UNVERIFIED-IN-SESSION].
- **Google Play AI-Generated Content policy:** covers text-to-text chatbot apps where AI chat is a central feature, plus image/voice/video generation; developers responsible for ensuring generative AI apps do not generate offensive content (self-harm encouragement, harassment, etc.); not covering apps that only summarise non-AI content or productivity apps using AI to improve an existing feature. The fetched page does not describe in-app report/flag or disclosure duties (a sidebar "Best Practices to Safeguard AI-Generated Content" article exists but was not read) — [Google AI-Generated Content policy](https://support.google.com/googleplay/android-developer/answer/14094294) [FETCHED].

### Inferences
- **Apple:** opt-in AI toggle with explicit consent text naming the model provider (Anthropic/Claude) and what ledger data is sent satisfies 5.1.2(i); do not make the toggle a precondition to use the ledger; disclaimer "not medical advice; check with a doctor" in-app (1.4.1); in-app delete-account (5.1.1(v)); if Google/Apple social sign-in is used, comply with 4.8.
- **Google:** store description must carry the disclaimer wording quoted above; complete Health apps declaration; complete Data safety including AI data sharing; ensure the chat refuses self-harm-encouraging content and add a feedback/report control (inference from the policy purpose, not stated by the fetched text).
- Whether Google treats an opt-in secondary chat as "AI chat is a central feature" is unclear; comply anyway.
- Quit-tracker is not "encouraging consumption" (Apple 1.4.3); keep store copy and screenshots free of brands/pack imagery.

### Gaps
- Apple App Privacy label requirements, 5.1.1(i) text, and 2.3.7 not read. Apple Standard EULA minimum terms vs custom EULA not checked.
- Google Data safety AI-disclosure specifics, tobacco-related policy, and "Best practices" article not read. No check of whether policy changes after mid-2026 exist.

---

## 8. Medical-advice disclaimers and limits on disclaiming liability

### Takeaway
Regulators/stores expect a plain, prominent "not a medical device / not medical advice / consult a clinician" notice in-app and (Google) in the store description; no court wording standard was found. Disclaimers cannot exclude liability for personal injury/negligence in the EU, and in India exclusion clauses are scrutinised for unconscionability (and CPA unfair-contract provisions if CPA applies).

### Cited Findings
- Google's required wording and the clinician-consultation reminder — [Google Health apps policy](https://support.google.com/googleplay/android-developer/answer/16679511) [FETCHED]. Apple's "check with a doctor ... before making medical decisions" — [Apple 1.4.1](https://developer.apple.com/app-store/review/guidelines/) [FETCHED].
- Google FAQ lists required disclaimers/warnings inside the app and says a disclaimer alone does not cure misleading functionality — [Health apps declaration help](https://support.google.com/googleplay/android-developer/answer/14738291) [SEARCH].
- UCTD Annex 1(a)/(b) and DCD Art 22 limits — see Section 1 (UNVERIFIED-IN-SESSION links there). UK analogue (not EU, not binding): negligence-based death/injury exclusion not binding — [compliance summary](https://compliance-ai-h.pages.dev/regulations/uk/consumer-rights-act-2015/unfair-terms) [SEARCH, low quality].
- MDR intended purpose determined by claims/marketing, so a disclaimer cannot reclassify — [MDR](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32017R0745) [UNVERIFIED-IN-SESSION]; [OpenRegulatory](https://openregulatory.com/mdcg/mdcg-2019-11) [SEARCH].

### Inferences
- Recommended content (not authority-mandated wording): (1) informational/self-management tool, not a medical device, does not diagnose/treat/cure/prevent; (2) milestone info is general and may not apply to you; (3) AI chat can be wrong, is not a clinician; (4) consult a qualified professional before changes to medication/health decisions; (5) in an emergency call local services (112 EU / 112 India); (6) nothing limits liability that cannot be limited by law (death/personal injury, intent, gross negligence, consumer statutory rights). Place the notice at first-run, on the milestones screen, and on the chat entry — not only in ToS (a hidden clause is weak under UCTD Art 5 transparency).
- Cap liability for non-excludable losses with "to the extent permitted by applicable law" and a separate EU/UK-consumer-rights paragraph; avoid blanket "no liability whatsoever".
- If the chat flags crisis/self-harm, surface a helpline pointer rather than relying on disclaimers (Google AI policy prohibits content encouraging self-harm; interpretation).

### Gaps
- No court decision or regulator guidance on wording for wellness/quit-smoking apps located in either jurisdiction.
- India: no authority found on enforceability of limitation-of-liability for free apps; CPA s.2(46)/s.49(4) unfair-contract provisions from memory only, applicability to free services doubtful.

---

## Quick checklist (derived)

Must include in ToS: operator identity/contact + grievance contact; 18+ confirmation; plain-language service description; AI feature description (opt-in, third-party model, accuracy limits, labelled as AI); not-medical-advice block; acceptable use; modification clause with reason + notice + exit; termination and in-app account deletion; governing law/forum with consumer-law savings; no tobacco promotion statement; version/date + change history.

Must not include: liability exclusion for death/injury/negligence/consumer statutory rights; unilateral no-notice changes; exclusive foreign courts/arbitration for EU consumers; health cure/treat claims; confirm-shaming/nagging copy; forced AI opt-in or notification opt-in; tobacco brand imagery/promotion.

Top items to verify first (highest impact, unverified here): (1) AI Omnibus adoption and Art 50(2) date; (2) India 2026 synthetic-content amendment to IT Rules; (3) PLD 2024/2853 start date 9 Dec 2026 and its application to a free app; (4) Google's "Best practices for AI-generated content" report/flag requirement; (5) Digital Fairness Act status.

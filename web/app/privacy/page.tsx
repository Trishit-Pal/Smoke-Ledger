import * as React from 'react';
import { LegalDocument } from '@web/components/legal/LegalDocument';
import { LEGAL_COPY, LEGAL_VERSIONS } from '@web/lib/legal';
import { BRANDS_CACHE_TTL_SECONDS, GOAL_WINDOW_LOG_LIMIT } from '@web/lib/server/data';
import {
  CHAT_HISTORY_MAX_TURNS,
  NOTE_MAX_CHARS,
  RECENT_MAX_DAYS,
  RECENT_MAX_ROWS,
} from '@/domain/ledgerChat/types';
import { EU_REPRESENTATIVE, euRepresentativeIsNamed, LEGAL_ENTITY } from '@/lib/legalEntity';
import { DATA_PROMISES } from '@/lib/privacy/promises';
import { RETENTION } from '@/lib/privacy/retention';

// Rendered per request: the CSP is nonce-based, and a statically pre-rendered page
// has no nonce on its inline scripts, so the browser blocks them (hydration breaks).
export const dynamic = 'force-dynamic';

const { operatorName, city, country, contactEmail, grievanceOfficer } = LEGAL_ENTITY;
const brandCacheMinutes = BRANDS_CACHE_TTL_SECONDS / 60;

const euRepresentativeLine = euRepresentativeIsNamed(EU_REPRESENTATIVE)
  ? `Our representative in the EU (GDPR Article 27) is ${EU_REPRESENTATIVE.name}, ${EU_REPRESENTATIVE.address}, ${EU_REPRESENTATIVE.email}. You can write to them instead of us about anything in this policy.`
  : `We are appointing a representative in the EU under GDPR Article 27. Their name and address will appear here once the appointment is signed. Until then, write to ${contactEmail}.`;

const sections = [
  {
    title: 'Who is responsible',
    body: [
      `${LEGAL_COPY.productName} is run by ${LEGAL_ENTITY.operatorName}, an individual based in ${city}, ${country}. ${operatorName} decides how your data is used: the controller under EU law and the Data Fiduciary under Indian law. Write to ${contactEmail} about anything here.`,
      'This policy covers the Smoke Ledger web app and mobile app. It is written to the stricter of the EU General Data Protection Regulation (GDPR) and India’s Digital Personal Data Protection Act, 2023 (DPDP), whose main duties are expected to begin in May 2027. Until then, India’s Information Technology Act and its 2011 rules on sensitive personal data apply.',
      euRepresentativeLine,
      `Grievance Officer: ${LEGAL_ENTITY.grievanceOfficer.name}, ${grievanceOfficer.email}. Every grievance gets a reply within ${grievanceOfficer.responseDays} days.`,
    ],
  },
  {
    title: 'Our data promises',
    body: DATA_PROMISES.map((promise) => promise.text),
  },
  {
    title: 'What we collect',
    body: [
      'Account: your email address, or your mobile number if you sign in by phone; your password, which our database host stores only as a one-way hash we cannot read; and when the account was created and last signed in.',
      'Identity: your name, date of birth and gender, given at sign-up. Your date of birth is what the 18+ check rests on.',
      'Profile: your country, and the currency and time zone that follow from it; an optional mobile number and place; your daily baseline; and preferences such as discreet mode and theme.',
      'Ledger: each entry’s date and time, quantity, brand and variant, and price, and, if you add them, the trigger, your mood before and after, the craving, the situation and a note. Also the brands and prices you add, your goals and reminders, and the facts you have seen. This is information about your health.',
      'Consents: which versions of the terms, this policy and the medical notice you accepted, and when; when you gave health-data consent; and your choices for usage analytics and Ask the ledger.',
      'Records: security records of account events such as sign-up, export, erasure and consent changes, some holding a one-way hash of your IP address but never the address itself; error reports, with identifiers removed; usage events, only if you turn analytics on, which count app actions and hold no entry content, brand names or prices; and rate-limit counters, keyed by a one-way hash.',
      'Questions you ask in Ask the ledger, and its replies, are not stored on our servers. What happens to them is set out below.',
    ],
  },
  {
    title: 'Why we use it, and the legal basis',
    body: [
      'Your ledger, to keep it and show your trends, goals and savings: your explicit consent (GDPR Article 9(2)(a) and Article 6(1)(a)), given on its own unticked line. Without it there can be no ledger.',
      'Your account and identity, to sign you in, keep your account and check you are 18 or older: needed to provide the service you asked for (GDPR Article 6(1)(b)). You need an email address or mobile number, a name, a date of birth and a gender to open an account; everything else is optional.',
      'Usage analytics, to see which parts of the app are used: your consent (GDPR Article 6(1)(a)). Off unless you turn it on.',
      'Ask the ledger, to answer questions about your own ledger: your explicit consent (GDPR Article 9(2)(a)), because it sends information about your health to the AI provider.',
      'Security records, error reports, rate limits and form checks, to keep accounts and the service safe and to show we did what you asked: our legitimate interest in security and in being accountable (GDPR Article 6(1)(f) and Article 5(2)).',
      'In India, we process all of this with your consent, given when you accept this policy, and only for the purposes above.',
    ],
  },
  {
    title: 'Who receives it',
    body: [
      'Supabase (United States, AWS us-east-2 in Ohio) hosts our database and sign-in. It holds everything listed above except the Ask the ledger conversation.',
      `Vercel (United States) runs the web app, so every web request passes through it, and it keeps request logs under its own retention. It also keeps your brand names in a short-lived cache for up to ${brandCacheMinutes} minutes so pages load faster; erasing your data or deleting your account clears that cache.`,
      'Anthropic, PBC (United States) writes the answers in Ask the ledger, and only if you turn it on. Exactly what it receives is set out in the AI section below.',
      'MSG91 (India) sends the one-time code by SMS if you sign in with your mobile number. It receives the number and the code.',
      'Cloudflare Turnstile, when switched on, checks the sign-in and sign-up forms for automated abuse. It sees your browser and IP address while it checks.',
      `${LEGAL_ENTITY.emailDeliveryProvider} delivers our sign-in, confirmation and password-reset emails. It receives your email address and the email we send.`,
      'Expo (EAS) builds the mobile app. The app does not send your data to Expo: it uses no push service and no over-the-air updates, and reminders are scheduled on your phone.',
      'We use these providers only to run the service, and we are confirming a written data-processing agreement with each of them. We share nothing with advertisers or data brokers. We disclose data to authorities only when the law requires it.',
    ],
  },
  {
    title: 'Transfers outside India and the EU',
    body: [
      'Our database is in the United States (Supabase, AWS us-east-2), and Vercel and Anthropic are in the United States too. Your data is therefore processed outside India and the European Economic Area.',
      `For readers in the EU, these transfers rely on the European Commission’s Standard Contractual Clauses, which our providers’ data-processing terms use. We are putting those agreements and an assessment of the transfers in place. You can ask for a copy at ${contactEmail}.`,
      'Indian law currently restricts no country for these transfers.',
    ],
  },
  {
    title: 'How long we keep it',
    body: [
      'Your ledger, profile and settings: until you erase them or delete your account. We never delete an account for being inactive.',
      `Security records: ${RETENTION.auditEventsMonths} months, then deleted by a daily job. This includes the record that you erased your data or deleted your account. That record holds a one-way hashed identifier, the date and, while your account exists, a link to it, but not your name or your ledger, and it lets us show that your request was carried out.`,
      `Error reports: ${RETENTION.errorEventsDays} days. Usage events: ${RETENTION.usageEventsMonths} months, or until you turn analytics off, which deletes them. Rate-limit counters: about ${RETENTION.rateLimitCountersDays} days.`,
      'The Ask the ledger conversation: in your browser until you clear it. Anthropic’s copy: as described in the AI section.',
      'Our database host may keep backup copies for a limited time under its own schedule, so erased data can remain in a backup until it expires. We do not use backups to bring back data you erased.',
      `When India’s DPDP rules apply, they may require some processing records to be kept for a year. We meet that with the security records above, kept for ${RETENTION.auditEventsMonths} months, not with your ledger.`,
    ],
  },
  {
    title: 'Your rights, and how to use them',
    body: [
      'See and take a copy: Settings › Export your data gives you a JSON file of everything listed in our promises.',
      'Correct: change your profile details in Settings. Your name, date of birth and gender work differently; see below.',
      'Erase: Settings › Erase all log data removes your ledger and identity details and keeps your login. Your country and currency stay, because the app needs them to work: they are regional settings, not part of your ledger. Delete: Settings › Delete account permanently does the same and then removes your account. Deleting needs a sign-in within the last 15 minutes.',
      'Withdraw consent: see the next section. To object to or restrict any processing, or for anything the app cannot do, write to us.',
      `We answer requests free of charge within one month, and grievances within ${grievanceOfficer.responseDays} days. We may ask you to write from the email address on your account so we know the request is yours.`,
      'Once the DPDP rules apply, you will also be able to name someone to use these rights for you if you die or cannot act yourself. Write to us to do that.',
    ],
  },
  {
    title: 'Withdrawing consent',
    body: [
      'Usage analytics: turn it off in Settings. Collection stops and your past usage events are deleted.',
      'Ask the ledger: turn it off in Settings. Nothing more is sent and the conversation in your browser is cleared. Whatever Anthropic already received ages out on its own schedule.',
      'Health data: Settings › Withdraw consent. A ledger cannot be kept without this consent, so withdrawing it ends in one of two ways you choose: erase everything and keep your login, or delete the account. You can export a copy first.',
      'Withdrawing does not make earlier processing unlawful, and it is as easy as giving consent was.',
    ],
  },
  {
    title: 'Complaints',
    body: [
      `Start with our Grievance Officer, ${grievanceOfficer.name}, at ${grievanceOfficer.email}. You will get a reply within ${grievanceOfficer.responseDays} days.`,
      'In the EU, you can complain at any time to the data protection authority in the country where you live or work, or where you think the problem happened. It is free.',
      'In India, once the DPDP rules apply (expected May 2027), you can take a grievance we have not resolved to the Data Protection Board of India.',
      'Nothing in our terms takes away your right to complain to a regulator.',
    ],
  },
  {
    title: 'The AI feature, and no automated decisions',
    body: [
      'Ask the ledger is on the web app only and off until you turn it on. It answers questions about your own ledger with an AI model run by Anthropic. Each answer is labelled “Written by AI”. It can be wrong, and it is not medical advice.',
      `When you ask a question, our server reads up to ${GOAL_WINDOW_LOG_LIMIT.toLocaleString('en-US')} of your entries from the last 90 days and your daily totals for up to the past year to work out the figures. Raw entries go to Anthropic only as described here.`,
      `Anthropic receives: your question; up to ${CHAT_HISTORY_MAX_TURNS} earlier turns of the conversation, your questions and its replies, so it can follow on; a short context line with today’s date, your time zone, currency and locale, your daily baseline, how many days have entries, the kind and state of your active goals, and whether discreet mode is on; and the results of the lookups it asks for. Those results are figures such as totals and comparisons, savings and spend outlook, peak hours and weekdays, pairings of mood and trigger, share of spend by brand, goal progress and targets, and the app’s rules-based insights.`,
      `When a question needs the detail, it also receives up to ${RECENT_MAX_ROWS} individual entries from the last ${RECENT_MAX_DAYS} days: date, hour, quantity, trigger, mood before and after, craving, situation, brand, and the first ${NOTE_MAX_CHARS} characters of your note.`,
      'In discreet mode, brand names are replaced with aliases and notes are not sent. A brand name you type into a question is sent as you typed it. Your name, date of birth, gender, email, phone number and place are never sent.',
      LEGAL_ENTITY.anthropicRetention,
      'The conversation is kept in your browser, under your Ask the ledger consent, until you choose Clear conversation, turn the feature off, sign out, erase your data, delete your account or turn discreet mode on.',
      'Smoke Ledger makes no decision about you that has a legal or similarly significant effect. The app suggests goals and shows insights worked out from your entries; you can ignore any of them.',
    ],
  },
  {
    title: 'On your device',
    body: [
      'Web: sign-in cookies that end when you close the browser, unless you tick Remember me, which adds a small cookie that keeps you signed in on that browser. Browser storage holds the Ask the ledger conversation, the goal suggestion you dismissed, app-lock state, your theme and the brand catalogue.',
      'Mobile: secure storage holds your sign-in session and app-lock PIN; app storage holds your theme, the brand catalogue and the dismissed suggestion; reminders are scheduled with your phone’s notification system; and an export file sits in the app’s cache after you export.',
      'Signing out ends the session and clears the conversation and the dismissed suggestion. Erasing or deleting also clears app-lock state, cancels reminders and deletes the export file; deleting also removes the Remember me cookie. Your theme and the brand catalogue stay, because they say nothing about you.',
      'We use no advertising or tracking cookies, so there is nothing to opt out of.',
    ],
  },
  {
    title: 'Security, and if something goes wrong',
    body: [
      'Connections are encrypted, and our database host encrypts data at rest. The database lets each account read only its own rows. Sign-in attempts are rate-limited, identifiers in rate-limit counters and security records are hashed, error reports have identifiers removed, and deleting an account needs a recent sign-in. You can add an app lock.',
      'If a breach puts your data at risk, we will act at once to contain it. Where the GDPR requires, we will tell the data protection authority of each EU country where affected people live within 72 hours, and tell you directly, without undue delay, when the risk to you is high. Once the DPDP rules apply, we will tell every affected person and the Data Protection Board of India.',
    ],
  },
  {
    title: 'Adults only',
    body: [
      'Smoke Ledger is for people aged 18 or older. Your date of birth is checked at sign-up, and the database refuses one under 18. If we learn that someone under 18 has an account, we delete it and its data.',
    ],
  },
  {
    title: 'Name, date of birth and gender',
    body: [
      'Once set, your name, date of birth and gender cannot be edited. Your date of birth is what the 18+ check rests on; if it could be changed later, the check could be stepped around, so it and the other identity details are fixed once given.',
      'If one is wrong, write to us and we will correct it by hand. Erase clears all three along with your ledger, but the app has no screen to enter them again, so to record corrected details after an erase, write to us too. Erase and Delete remove them everywhere we keep them, including the sign-in record.',
    ],
  },
  {
    title: 'Languages',
    body: [
      'This policy is in English. A Hindi version is being prepared. If you would like it in another of the 22 languages of the Eighth Schedule to the Constitution of India, write to us.',
    ],
  },
  {
    title: 'Versions and changes',
    body: [
      'The date at the top is this version. We record which version you accepted, and when.',
      'When we change this policy or the terms in a way that matters to you, we will say what changed and why, and ask you to accept again the next time you open the app. Until you do, the app shows only the consent screen, Settings (where you can export or delete) and the legal pages. If you would rather not accept, you can export your data or delete your account. Earlier versions are available on request.',
    ],
  },
] as const;

export default function PrivacyPage() {
  return (
    <LegalDocument
      title="Privacy Policy"
      subtitle="What Smoke Ledger keeps about you, why, who sees it, and how to take it back."
      effectiveDate={LEGAL_VERSIONS.privacy}
      sections={sections}
    />
  );
}

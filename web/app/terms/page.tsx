import * as React from 'react';
import { LegalDocument } from '@web/components/legal/LegalDocument';
import { LEGAL_COPY, LEGAL_VERSIONS } from '@web/lib/legal';
import { LEGAL_ENTITY } from '@/lib/legalEntity';

// Rendered per request: the CSP is nonce-based, and a statically pre-rendered page
// has no nonce on its inline scripts, so the browser blocks them (hydration breaks).
export const dynamic = 'force-dynamic';

const { contactEmail, grievanceOfficer } = LEGAL_ENTITY;
const { indiaQuitline, emergencyIndia, emergencyEu } = LEGAL_ENTITY.helplines;
const { law, courts } = LEGAL_ENTITY.governingLaw;

const sections = [
  {
    title: 'Who runs Smoke Ledger',
    body: [
      `${LEGAL_COPY.productName} is run by ${LEGAL_ENTITY.operatorName}, an individual based in ${LEGAL_ENTITY.city}, ${LEGAL_ENTITY.country}. Write to ${contactEmail} with any question about these terms.`,
      `Grievance Officer: ${grievanceOfficer.name}, ${grievanceOfficer.email}, who replies within ${grievanceOfficer.responseDays} days.`,
      'These terms, together with the Privacy Policy, are the agreement between you and us when you use Smoke Ledger on the web or on your phone.',
    ],
  },
  {
    title: 'Who can use it',
    body: [
      'You must be 18 or older. If we learn that an account belongs to someone under 18, we delete it and its data.',
      'Give accurate details when you sign up, and keep your sign-in details to yourself.',
    ],
  },
  {
    title: 'What the service is',
    body: [
      'Smoke Ledger is a private ledger of the cigarettes you smoke and what they cost. It shows your trends, helps you set goals to cut down or stop, sends reminders if you ask for them, and lets you export, erase or delete your data at any time.',
      'Ask the ledger, in the web and mobile apps, answers questions about your own ledger using an AI model run by Groq, Google or OpenRouter. It is off until you turn it on, each answer is labelled “Written by AI”, there is a daily limit on questions, and its answers can be wrong. Check anything that matters against your own entries.',
      'We will keep improving Smoke Ledger, so features may change. The section on changes below sets out how.',
    ],
  },
  {
    title: 'Not medical advice',
    body: [
      'Smoke Ledger is not a medical device. It does not diagnose, treat, cure or prevent any condition, and nothing in it, including the AI answers, is medical advice.',
      'Talk to a doctor or another qualified health professional before changing any medication or making a health decision, including about nicotine replacement or quitting.',
      `In an emergency, call ${emergencyIndia} in India or ${emergencyEu} anywhere in the EU. In India, the National Tobacco Quitline on ${indiaQuitline} offers free support to stop.`,
    ],
  },
  {
    title: 'Tobacco and acceptable use',
    body: [
      'Smoke Ledger does not sell, advertise or promote tobacco. Brand names are there only so you can record what you smoke. Do not use the app, or anything you enter in it, to advertise or promote tobacco products.',
      'Do not try to get into accounts or systems that are not yours, overload or disrupt the service, automate sign-ups or requests, copy or probe our private infrastructure, or use the AI feature to produce harmful or unlawful content. Do not enter unlawful content or pretend to be someone else.',
      'If an account breaks these rules seriously or repeatedly, we may suspend or close it. We will tell you why, unless the law or someone’s safety stops us.',
    ],
  },
  {
    title: 'Liability',
    body: [
      'We work to keep Smoke Ledger running and its figures accurate, but we cannot promise it will always be available or free of errors. Keep an export if your records matter to you.',
      'To the extent the law allows, we are not liable for indirect or consequential losses arising from your use of Smoke Ledger.',
      'Nothing in these terms limits or excludes liability for death or personal injury caused by negligence, for fraud, for gross negligence or deliberate wrongdoing, or for anything else the law does not allow to be limited. That includes your rights as a consumer and, in the EU, liability for defective products, including software.',
    ],
  },
  {
    title: 'Changes to these terms',
    body: [
      'We change these terms or the service only for a good reason: a change in the law, a new or changed feature, a security need, or a change in how we handle data. Changes never apply to the past.',
      'When a change matters to you, we will say what is changing and why before it takes effect, and ask you to accept the new terms the next time you open the app. If you do not accept, you can export your data and delete your account, free of charge.',
    ],
  },
  {
    title: 'Ending your use',
    body: [
      'You can stop using Smoke Ledger at any time. Settings › Delete account permanently erases your data and removes your account; it cannot be undone, so export a copy first if you want one.',
      'If we close an account under these terms, we will give you the chance to export your data first, unless the law prevents it. If we ever stop running Smoke Ledger, we will tell you at least 30 days ahead so you can export.',
    ],
  },
  {
    title: 'Governing law and courts',
    body: [
      `These terms are governed by ${law}, and disputes go to ${courts}.`,
      'If you are a consumer living in the EU, you keep the protection of the mandatory laws of the country where you live, and you can bring proceedings in the courts there. Nothing in these terms takes that away.',
    ],
  },
  {
    title: 'Your right to complain',
    body: [
      `You can raise any concern with our Grievance Officer at ${grievanceOfficer.email}. Nothing in these terms stops you complaining to a data protection authority, a consumer body, or, once it hears complaints, the Data Protection Board of India.`,
    ],
  },
  {
    title: 'How acceptance is recorded',
    body: [
      'You accept these terms by ticking boxes that are never ticked for you. We record which versions of these terms, the Privacy Policy and the medical notice you accepted, and when. That record is kept with your account and erased with it.',
    ],
  },
] as const;

export default function TermsPage() {
  return (
    <LegalDocument
      title="Terms of Service"
      subtitle="The agreement for using Smoke Ledger, in plain words."
      effectiveDate={LEGAL_VERSIONS.terms}
      sections={sections}
    />
  );
}

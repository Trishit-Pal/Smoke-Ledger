import * as React from 'react';
import { LegalDocument } from '@web/components/legal/LegalDocument';
import { LEGAL_COPY, LEGAL_VERSIONS } from '@web/lib/legal';

// Pure static legal content — no per-request data. Serve from the CDN and
// revalidate daily instead of rendering per request. See SCALING_PLAN.md §2b.
export const dynamic = 'force-static';
export const revalidate = 86400;

const sections = [
  {
    title: 'Acceptance',
    body: [
      `By creating an account or using ${LEGAL_COPY.productName}, you agree to these Terms of Service and the Privacy Policy.`,
      'If you do not agree, do not use the service.',
    ],
  },
  {
    title: 'Eligibility',
    body: [
      'This service is intended for adults (18+).',
      'You must provide accurate account information and keep your credentials secure.',
    ],
  },
  {
    title: 'Service scope',
    body: [
      `${LEGAL_COPY.productName} helps you log smoking behavior, monitor trends, and set reduction or cessation goals.`,
      'The product is educational and behavioral support software. It is not a clinical, emergency, or diagnostic service.',
    ],
  },
  {
    title: 'Medical and safety disclaimer',
    body: [
      'Nothing in the app is medical advice. The product does not diagnose, treat, or cure medical conditions.',
      'If you have chest pain, severe withdrawal symptoms, or urgent health concerns, seek immediate medical care.',
    ],
  },
  {
    title: 'User responsibilities',
    body: [
      'Do not abuse the service, attempt unauthorized access, reverse engineer private infrastructure, or automate high-volume attacks.',
      'Do not upload unlawful, harmful, or deceptive content.',
      'You are responsible for decisions made based on your logged data.',
    ],
  },
  {
    title: 'Account and data controls',
    body: [
      'You can sign out, erase app data, request export, and delete your account from product settings.',
      'Deleting an account is irreversible after backend processing completes.',
    ],
  },
  {
    title: 'Service availability',
    body: [
      'We aim for reliable service but do not guarantee uninterrupted availability.',
      'We may update features, enforce abuse protections, or suspend compromised accounts to protect users and systems.',
    ],
  },
  {
    title: 'Liability',
    body: [
      'To the maximum extent allowed by law, the service is provided as-is and as-available.',
      'We are not liable for indirect or consequential losses arising from use of the product.',
    ],
  },
  {
    title: 'Contact',
    body: [
      `For legal or support questions, contact ${LEGAL_COPY.supportEmail}.`,
    ],
  },
] as const;

export default function TermsPage() {
  return (
    <LegalDocument
      title="Terms of Service"
      subtitle="Rules and responsibilities for using Smoke Ledger."
      effectiveDate={LEGAL_VERSIONS.terms}
      sections={sections}
    />
  );
}

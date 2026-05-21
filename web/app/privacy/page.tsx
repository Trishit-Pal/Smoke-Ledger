import * as React from 'react';
import { LegalDocument } from '@web/components/legal/LegalDocument';
import { LEGAL_COPY, LEGAL_VERSIONS } from '@web/lib/legal';

const sections = [
  {
    title: 'What this policy covers',
    body: [
      `${LEGAL_COPY.productName} is a smoking reduction and cessation support product. This policy explains how we handle personal data when you use the web app and connected mobile clients.`,
      'We only collect data needed to deliver core product features, account security, and support. We do not run ad networks and we do not sell personal data.',
    ],
  },
  {
    title: 'Data we collect',
    body: [
      'Account data: email address, authentication metadata, and account lifecycle events.',
      'Product data: cigarette logs, trigger and mood selections, goals, reminders, onboarding preferences, and profile settings.',
      'Operational data: security and audit events, sanitized error diagnostics, and abuse-prevention telemetry.',
    ],
  },
  {
    title: 'Sensitive health-adjacent data',
    body: [
      'Smoking behavior, cravings, and cessation progress can be sensitive in many jurisdictions. We treat this data as restricted and enforce per-user access with database row-level security.',
      'This product is not a medical device and does not provide diagnosis or treatment. You should consult a licensed clinician before making medical decisions.',
    ],
  },
  {
    title: 'How we use data',
    body: [
      'To provide account access, sync your data across devices, generate trends and progress views, and process your deletion/export requests.',
      'To secure the service through rate limits, abuse checks, and incident response logs.',
      'To improve product reliability using redacted diagnostics and optional first-party analytics signals (opt-in).',
    ],
  },
  {
    title: 'Data retention and deletion',
    body: [
      'Account content remains until you erase it or delete your account from Settings.',
      'Erase data wipes product tables and resets onboarding while keeping your login. Audit rows are anonymized (user link removed, hashed identifier retained) for abuse prevention.',
      'Delete account removes your Supabase Auth identity and cascades product data. A compliance delete record may be retained in anonymized form for incident response.',
      'Security logs are retained only for as long as required for abuse prevention, compliance, and incident response.',
    ],
  },
  {
    title: 'Data sharing and processors',
    body: [
      'Core infrastructure providers process data strictly to host and secure the service. For this repository, Supabase is the primary auth/database processor and Vercel can host the web app.',
      'We do not share raw product logs with advertisers or data brokers.',
      `Support requests are handled by our team at ${LEGAL_COPY.supportEmail}.`,
    ],
  },
  {
    title: 'Your rights',
    body: [
      'You can access, correct, export, or delete your data. You can also close your account at any time.',
      `To submit a privacy request, contact ${LEGAL_COPY.supportEmail}. We target an initial response within ${LEGAL_COPY.supportResponseTarget}.`,
    ],
  },
] as const;

export default function PrivacyPage() {
  return (
    <LegalDocument
      title="Privacy Policy"
      subtitle="How Smoke Ledger collects, uses, and protects your data."
      effectiveDate={LEGAL_VERSIONS.privacy}
      sections={sections}
    />
  );
}

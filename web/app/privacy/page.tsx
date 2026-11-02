import * as React from 'react';
import { LegalDocument } from '@web/components/legal/LegalDocument';
import { LEGAL_COPY, LEGAL_VERSIONS } from '@web/lib/legal';

// Rendered per request: the CSP is nonce-based, and a statically pre-rendered page
// has no nonce on its inline scripts, so the browser blocks them (hydration breaks).
export const dynamic = 'force-dynamic';

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
      'Questions you type into Ask the ledger, if you turn that feature on. We pass them to the AI processor described below and do not store them.',
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
      'To answer your questions about your own ledger through an AI model, only if you turn Ask the ledger on (opt-in).',
    ],
  },
  {
    title: 'Data retention and deletion',
    body: [
      'Account content remains until you erase it or delete your account from Settings.',
      'Erase data wipes product tables, clears the name, date of birth, gender, mobile number and place on your profile, and resets onboarding while keeping your login. Audit rows are anonymized (user link removed, hashed identifier retained) for abuse prevention.',
      'Delete account removes your Supabase Auth identity and cascades product data. A compliance delete record may be retained in anonymized form for incident response.',
      'Security logs are retained only for as long as required for abuse prevention, compliance, and incident response.',
    ],
  },
  {
    title: 'Data sharing and processors',
    body: [
      'Core infrastructure providers process data strictly to host and secure the service. Supabase is the primary auth/database processor, Vercel hosts the web app, Cloudflare Turnstile checks sign-in forms for automated abuse when enabled, and an SMS provider delivers one-time codes if you choose phone sign-in.',
      'Our database is hosted in the United States (Supabase, AWS us-east-2), so your data is processed outside India and the European Economic Area. We rely on our processors’ data processing agreements and standard contractual safeguards for those transfers.',
      'Ask the ledger is an optional feature, off by default, that answers questions about your own ledger using an AI model operated by Anthropic, PBC in the United States. If you turn it on, each question you ask and the figures needed to answer it are sent to Anthropic: totals, trends, spend by brand, time-of-day and weekday patterns, mood and trigger counts, goal progress and targets, your daily baseline, and your country-level currency and time zone. When a question needs them, so are your recent entries from the last 30 days: dates, times, quantities, triggers, moods, cravings, the situation you tagged, brand names, and your own notes. In discreet mode, brand names are replaced with aliases and notes are not sent; a brand name you type into a question is sent as typed. Anthropic does not use this data to train its models and deletes it after a limited retention period, currently up to 30 days, unless it must be kept longer for safety or legal reasons. We do not store your questions, the replies, or any conversation on our servers; the conversation is kept only on the device you used until you sign out, erase your data, delete your account, or turn the feature off in Settings.',
      'We do not share raw product logs with advertisers or data brokers.',
      `Support requests are handled by our team at ${LEGAL_COPY.supportEmail}.`,
    ],
  },
  {
    title: 'Your rights',
    body: [
      'You can access, correct, export, or delete your data. You can also close your account at any time.',
      'If you are in India, these rights come from the Digital Personal Data Protection Act, 2023. If you are in the European Union, they come from the GDPR, and you can also object to or restrict processing and lodge a complaint with your data protection authority.',
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

import * as React from 'react';
import Link from 'next/link';
import { EditorialPageShell } from '@web/components/editorial/EditorialPageShell';
import { EditorialMasthead } from '@web/components/editorial/EditorialMasthead';
import { EditorialClosingSignet } from '@web/components/editorial/EditorialClosingSignet';
import { LEGAL_COPY, LEGAL_LINKS } from '@web/lib/legal';

// Rendered per request: the CSP is nonce-based, and a statically pre-rendered page
// has no nonce on its inline scripts, so the browser blocks them (hydration breaks).
export const dynamic = 'force-dynamic';

interface SupportSectionProps {
  index: string;
  title: string;
  children: React.ReactNode;
}

function SupportSection({ index, title, children }: SupportSectionProps) {
  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <header
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          gap: 16,
          borderTop: '1px solid var(--rule-strong)',
          paddingTop: 18,
        }}
      >
        <span
          className="editorial-caption-tight nums-tabular"
          style={{ color: 'var(--text-faint)', minWidth: 28 }}
        >
          {index}
        </span>
        <h2
          className="editorial-headline"
          style={{
            fontSize: 'clamp(22px, 2.5vw, 28px)',
            margin: 0,
            flex: 1,
            color: 'var(--text)',
          }}
        >
          {title}
        </h2>
      </header>
      <div style={{ paddingLeft: 44, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {children}
      </div>
    </section>
  );
}

export default function SupportPage() {
  return (
    <EditorialPageShell maxWidth={760}>
      <EditorialMasthead
        caption="Legal · Support"
        title={
          <>
            How can we <span style={{ color: 'var(--accent-ink)', fontStyle: 'italic' }}>help</span>?
          </>
        }
        subtitle="Account access, privacy, export, deletion, and technical support."
        ruleWidth={80}
      />

      <SupportSection index="01" title="By email">
        <a
          href={`mailto:${LEGAL_COPY.supportEmail}`}
          style={{
            fontFamily: 'var(--font-display)',
            fontStyle: 'italic',
            fontSize: 22,
            color: 'var(--accent-ink)',
            textDecoration: 'underline',
            textUnderlineOffset: 4,
            // An address has no spaces; at 22px it is wider than a 320px phone.
            overflowWrap: 'anywhere',
          }}
        >
          {LEGAL_COPY.supportEmail}
        </a>
        <p
          style={{
            fontSize: 13,
            color: 'var(--text-muted)',
            lineHeight: 1.55,
            margin: 0,
          }}
        >
          Initial response target: {LEGAL_COPY.supportResponseTarget}. Include your account
          email and request type (access, export, correction, deletion) so we can process
          requests safely.
        </p>
      </SupportSection>

      <SupportSection index="02" title="Privacy & legal">
        <p
          style={{
            fontSize: 13,
            color: 'var(--text-muted)',
            lineHeight: 1.55,
            margin: 0,
          }}
        >
          For policy details, see the{' '}
          <Link
            href={LEGAL_LINKS.privacy}
            style={{
              fontFamily: 'var(--font-display)',
              fontStyle: 'italic',
              color: 'var(--accent-ink)',
              textDecoration: 'underline',
              textUnderlineOffset: 3,
            }}
          >
            Privacy Policy
          </Link>{' '}
          and{' '}
          <Link
            href={LEGAL_LINKS.terms}
            style={{
              fontFamily: 'var(--font-display)',
              fontStyle: 'italic',
              color: 'var(--accent-ink)',
              textDecoration: 'underline',
              textUnderlineOffset: 3,
            }}
          >
            Terms of Service
          </Link>
          .
        </p>
      </SupportSection>

      <EditorialClosingSignet align="left">
        Replies come from a real person. Usually within {LEGAL_COPY.supportResponseTarget}.
      </EditorialClosingSignet>
    </EditorialPageShell>
  );
}

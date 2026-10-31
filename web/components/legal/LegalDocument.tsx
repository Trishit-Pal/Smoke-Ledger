import * as React from 'react';
import Link from 'next/link';
import { EditorialPageShell } from '@web/components/editorial/EditorialPageShell';
import { EditorialMasthead } from '@web/components/editorial/EditorialMasthead';
import { EditorialClosingSignet } from '@web/components/editorial/EditorialClosingSignet';
import { LEGAL_COPY, LEGAL_LINKS } from '@web/lib/legal';

export interface LegalSection {
  title: string;
  body: readonly string[];
}

interface LegalDocumentProps {
  title: string;
  subtitle: string;
  effectiveDate: string;
  sections: readonly LegalSection[];
}

export function LegalDocument({
  title,
  subtitle,
  effectiveDate,
  sections,
}: LegalDocumentProps) {
  return (
    <EditorialPageShell maxWidth={760}>
      <EditorialMasthead
        caption={`Legal · ${LEGAL_COPY.productName}`}
        title={title}
        subtitle={subtitle}
        effectiveDate={`Effective ${effectiveDate}`}
        ruleWidth={80}
      />

      {sections.map((section, i) => (
        <section
          key={section.title}
          style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
        >
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
              {String(i + 1).padStart(2, '0')}
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
              {section.title}
            </h2>
          </header>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
              paddingLeft: 44,
            }}
          >
            {section.body.map((paragraph, j) => (
              <React.Fragment key={`${section.title}-${j}`}>
                {j > 0 ? (
                  <div
                    aria-hidden
                    style={{
                      borderTop: '1px solid var(--rule)',
                      width: 32,
                    }}
                  />
                ) : null}
                <p
                  style={{
                    fontSize: 14,
                    color: 'var(--text-muted)',
                    lineHeight: 1.6,
                    margin: 0,
                  }}
                >
                  {paragraph}
                </p>
              </React.Fragment>
            ))}
          </div>
        </section>
      ))}

      <EditorialClosingSignet align="left">
        Need help with account data requests?{' '}
        <Link
          href={LEGAL_LINKS.support}
          style={{ color: 'var(--accent-ink)', textDecoration: 'underline', textUnderlineOffset: 3 }}
        >
          Contact support →
        </Link>
      </EditorialClosingSignet>
    </EditorialPageShell>
  );
}

export default LegalDocument;

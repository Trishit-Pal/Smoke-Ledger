import * as React from 'react';
import Link from 'next/link';
import { LEGAL_LINKS } from '@web/lib/legal';

interface FooterLink {
  label: string;
  href: string;
}

const NAV: FooterLink[] = [
  { label: 'Privacy', href: LEGAL_LINKS.privacy },
  { label: 'Terms', href: LEGAL_LINKS.terms },
  { label: 'Support', href: LEGAL_LINKS.support },
];

export function LandingFooter() {
  return (
    <footer
      style={{
        padding: 'clamp(48px, 6vw, 72px) clamp(20px, 5vw, 64px)',
        background: 'var(--bg)',
        borderTop: '1px solid var(--rule-strong)',
      }}
    >
      <div
        style={{
          maxWidth: 880,
          margin: '0 auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          alignItems: 'flex-start',
        }}
      >
        <span className="editorial-caption">Colophon</span>
        <p
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 22,
            color: 'var(--text)',
            margin: 0,
            lineHeight: 1.3,
          }}
        >
          Smoke<span style={{ fontStyle: 'italic', color: 'var(--accent)' }}> Ledger</span>{' '}
          · Vol. I · Est. 2026
        </p>
        <p
          style={{
            fontFamily: 'var(--font-display)',
            fontStyle: 'italic',
            fontSize: 14,
            color: 'var(--text-muted)',
            margin: 0,
            lineHeight: 1.55,
            maxWidth: 560,
          }}
        >
          Body set in DM Sans. Display in Fraunces. Hairlines in <span className="nums-tabular">1px</span>.
          Editorial restraint by design.
        </p>
        <div
          aria-hidden
          style={{ borderTop: '1px solid var(--rule)', width: 60, marginTop: 4 }}
        />
        <nav
          aria-label="Legal"
          style={{
            display: 'flex',
            gap: 18,
            alignItems: 'baseline',
            flexWrap: 'wrap',
          }}
        >
          {NAV.map((link, i, arr) => (
            <React.Fragment key={link.label}>
              <Link
                href={link.href}
                style={{
                  fontFamily: 'var(--font-display)',
                  fontStyle: 'italic',
                  fontSize: 13,
                  color: 'var(--accent)',
                  textDecoration: 'none',
                }}
              >
                {link.label}
              </Link>
              {i < arr.length - 1 ? (
                <span
                  aria-hidden
                  style={{ color: 'var(--text-faint)', fontSize: 12 }}
                >
                  ·
                </span>
              ) : null}
            </React.Fragment>
          ))}
        </nav>
        <span
          style={{
            fontFamily: 'var(--font-display)',
            fontStyle: 'italic',
            fontSize: 12,
            color: 'var(--text-faint)',
            marginTop: 12,
          }}
        >
          Awareness is the first move.
        </span>
      </div>
    </footer>
  );
}

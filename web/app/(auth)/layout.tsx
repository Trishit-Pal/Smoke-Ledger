import * as React from 'react';
import Link from 'next/link';
import { EditorialPageShell } from '@web/components/editorial/EditorialPageShell';
import { SceneBackdrop } from '@web/components/marketing/SceneBackdrop';
import { LEGAL_LINKS } from '@web/lib/legal';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    // The wordmark is the way home here; the fixed-corner "Go to Homepage" link
    // stays only on the legal and support pages.
    <EditorialPageShell
      maxWidth={520}
      backdrop={<SceneBackdrop intensity="full" />}
      showGoHome={false}
    >
      <Link
        href="/"
        aria-label="Smoke Ledger home"
        className="focus-ring mb-lg inline-flex min-h-11 items-center self-start"
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 18,
          letterSpacing: '-0.015em',
          lineHeight: 1.05,
          color: 'var(--text)',
          textDecoration: 'none',
        }}
      >
        {/* One flex child: as separate items the space before "Ledger" collapses. */}
        <span>
          Smoke<span style={{ fontStyle: 'italic', color: 'var(--accent-ink)' }}> Ledger</span>
        </span>
      </Link>
      {children}
      <footer
        style={{
          marginTop: 20,
          paddingTop: 12,
          borderTop: '1px solid var(--rule)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        {[
          { label: 'Privacy', href: LEGAL_LINKS.privacy },
          { label: 'Terms', href: LEGAL_LINKS.terms },
          { label: 'Support', href: LEGAL_LINKS.support },
        ].map((link, i, arr) => (
          <React.Fragment key={link.label}>
            <Link
              href={link.href}
              style={{
                fontFamily: 'var(--font-display)',
                fontStyle: 'italic',
                fontSize: 12,
                color: 'var(--text-muted)',
                textDecoration: 'none',
              }}
            >
              {link.label}
            </Link>
            {i < arr.length - 1 ? (
              <span aria-hidden style={{ color: 'var(--text-faint)', fontSize: 11 }}>
                ·
              </span>
            ) : null}
          </React.Fragment>
        ))}
      </footer>
    </EditorialPageShell>
  );
}

import * as React from 'react';
import type { Metadata } from 'next';
import { EditorialPageShell } from '@web/components/editorial/EditorialPageShell';
import { EditorialMasthead } from '@web/components/editorial/EditorialMasthead';

// The middleware rewrites here with a 503 when the profile read fails, so the URL
// stays the one the reader asked for. Per request: the CSP is nonce-based.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Smoke Ledger', robots: { index: false } };

export default function UnavailablePage() {
  return (
    <EditorialPageShell maxWidth={560} showGoHome={false} centered>
      <EditorialMasthead
        title="The ledger couldn't be read just now."
        subtitle="Nothing has been lost. Give it a moment, then try again."
        ruleWidth={60}
      />
      {/* href="" is this document's own URL: the page the reader asked for. A full
          reload, not a client navigation, so it asks the server afresh. */}
      <a
        href=""
        style={{
          alignSelf: 'flex-start',
          display: 'inline-flex',
          alignItems: 'center',
          minHeight: 44,
          fontFamily: 'var(--font-display)',
          fontStyle: 'italic',
          fontSize: 20,
          color: 'var(--accent-ink)',
          textDecoration: 'underline',
          textUnderlineOffset: 4,
        }}
      >
        Try again
      </a>
    </EditorialPageShell>
  );
}

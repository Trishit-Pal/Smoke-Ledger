import * as React from 'react';
import Link from 'next/link';
import { LEGAL_LINKS } from '@web/lib/legal';

export function LandingPrivacy() {
  return (
    <section
      aria-labelledby="landing-privacy-heading"
      style={{
        padding: 'clamp(56px, 8vw, 96px) clamp(20px, 5vw, 64px)',
        background: 'transparent',
        borderTop: '1px solid var(--rule)',
      }}
    >
      <div
        style={{
          maxWidth: 800,
          margin: '0 auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 24,
          alignItems: 'flex-start',
        }}
      >
        <span id="landing-privacy-heading" className="editorial-caption">
          The pledge
        </span>
        <p
          style={{
            fontFamily: 'var(--font-display)',
            fontStyle: 'italic',
            fontSize: 'clamp(28px, 4vw, 40px)',
            lineHeight: 1.4,
            color: 'var(--text)',
            margin: 0,
          }}
        >
          &ldquo;No ads. No upsell. No third-party trackers. Encrypted at rest. Yours to{' '}
          <span style={{ color: 'var(--accent)' }}>export</span> or{' '}
          <span style={{ color: 'var(--accent)' }}>delete</span>.&rdquo;
        </p>
        <div
          className="rule-draw"
          style={{ borderTop: '1px solid var(--rule-strong)', width: 60 }}
        />
        <span
          className="editorial-caption-tight"
          style={{ color: 'var(--text-muted)' }}
        >
          Set in India · Hosted on Supabase + Vercel · Free forever
        </span>
        <Link
          href={LEGAL_LINKS.privacy}
          style={{
            fontFamily: 'var(--font-display)',
            fontStyle: 'italic',
            fontSize: 13,
            color: 'var(--accent)',
            textDecoration: 'underline',
            textUnderlineOffset: 4,
          }}
        >
          Read the full Privacy Policy →
        </Link>
      </div>
    </section>
  );
}

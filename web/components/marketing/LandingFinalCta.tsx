import * as React from 'react';
import Link from 'next/link';

const PRIMARY_CTA_STYLE: React.CSSProperties = {
  height: 56,
  padding: '0 28px',
  border: 'none',
  borderRadius: 10,
  background: 'var(--accent)',
  color: '#ffffff',
  fontFamily: 'var(--font-sans)',
  fontWeight: 600,
  fontSize: 15,
  letterSpacing: '0.01em',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 10,
  cursor: 'pointer',
  textDecoration: 'none',
  boxShadow: '0 12px 32px -8px rgba(47, 163, 155, 0.45), 0 2px 4px rgba(11, 15, 20, 0.08)',
};

export function LandingFinalCta() {
  return (
    <section
      aria-labelledby="landing-final-cta-heading"
      style={{
        padding: 'clamp(72px, 10vw, 120px) clamp(20px, 5vw, 64px)',
        background: 'transparent',
        borderTop: '1px solid var(--rule)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div
        aria-hidden
        style={{
          position: 'absolute',
          left: '50%',
          bottom: -120,
          transform: 'translateX(-50%)',
          width: 600,
          height: 600,
          borderRadius: '50%',
          background:
            'radial-gradient(ellipse 70% 50% at 50% 50%, var(--accent-glow), transparent 70%)',
          opacity: 0.3,
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          maxWidth: 680,
          margin: '0 auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 22,
          alignItems: 'center',
          textAlign: 'center',
        }}
      >
        <span className="editorial-caption">The first line</span>
        <h2
          id="landing-final-cta-heading"
          className="editorial-headline"
          style={{ fontSize: 'clamp(40px, 6vw, 64px)', margin: 0 }}
        >
          Today is <span style={{ color: 'var(--accent)', fontStyle: 'italic' }}>fine</span>.
        </h2>
        <p
          style={{
            fontFamily: 'var(--font-display)',
            fontStyle: 'italic',
            fontSize: 17,
            color: 'var(--text-muted)',
            lineHeight: 1.55,
            margin: 0,
            maxWidth: 480,
          }}
        >
          About ninety seconds. Then your ledger is open.
        </p>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' }}>
          <Link href="/signup" style={PRIMARY_CTA_STYLE}>
            Begin the ledger
            <span aria-hidden style={{ fontSize: 18 }}>
              →
            </span>
          </Link>
          <span
            style={{
              fontSize: 11,
              color: 'var(--text-faint)',
              fontFamily:
                'var(--font-mono, ui-monospace, SFMono-Regular, Menlo, monospace)',
              letterSpacing: '0.12em',
            }}
          >
            ↵ ENTER
          </span>
        </div>
        <Link
          href="/login"
          style={{
            fontFamily: 'var(--font-display)',
            fontStyle: 'italic',
            fontSize: 13,
            color: 'var(--text-muted)',
            textDecoration: 'none',
          }}
        >
          Already have an account? <span style={{ color: 'var(--accent)' }}>Sign in →</span>
        </Link>
      </div>
    </section>
  );
}

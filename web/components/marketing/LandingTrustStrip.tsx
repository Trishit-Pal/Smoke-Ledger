import * as React from 'react';

export function LandingTrustStrip() {
  return (
    <section
      aria-label="Heard around the desk"
      style={{
        padding: 'clamp(40px, 5vw, 64px) clamp(20px, 5vw, 64px)',
        borderTop: '1px solid var(--rule)',
        borderBottom: '1px solid var(--rule)',
        background: 'transparent',
      }}
    >
      <div
        style={{
          maxWidth: 760,
          margin: '0 auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          alignItems: 'center',
          textAlign: 'center',
        }}
      >
        <p
          style={{
            fontFamily: 'var(--font-display)',
            fontStyle: 'italic',
            fontSize: 'clamp(20px, 2.6vw, 28px)',
            lineHeight: 1.45,
            color: 'var(--text)',
            margin: 0,
          }}
        >
          &ldquo;Honest. Quiet. Free. The cigarette tracker that doesn&rsquo;t try to gamify
          your way out.&rdquo;
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center' }}>
          <span className="editorial-caption">Heard around the desk</span>
          <span
            style={{
              fontSize: 12,
              color: 'var(--text-faint)',
              fontFamily:
                'var(--font-mono, ui-monospace, SFMono-Regular, Menlo, monospace)',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
            }}
          >
            Free to use · Row-level security · You own your data · Export anytime
          </span>
        </div>
      </div>
    </section>
  );
}

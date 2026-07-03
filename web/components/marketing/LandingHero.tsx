'use client';

import * as React from 'react';
import Link from 'next/link';
import { TiltCard } from '@web/components/onboarding/TiltCard';
import { CharacterCompanion } from '@web/components/character/CharacterCompanion';
import { dispatchMood } from '@web/lib/character/mood';

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
  transition: 'transform 120ms ease-out, box-shadow 240ms ease',
};

const PILLARS: { num: string; title: string; copy: string }[] = [
  { num: 'I.', title: 'Free', copy: 'No ads, no upsell, no subscription tier.' },
  { num: 'II.', title: 'Private', copy: 'Encrypted at rest. Yours to export or delete.' },
  { num: 'III.', title: 'Honest', copy: 'No streaks. No badges. No shame patterns.' },
];

export function LandingHero() {
  // Greet on load — mirrors the dashboard's soft entrance beat. (Resting mood is
  // already `greet`, so the figure degrades to a static greet with no JS too.)
  React.useEffect(() => {
    const t = window.setTimeout(() => dispatchMood('greet', { durationMs: 1800 }), 400);
    return () => window.clearTimeout(t);
  }, []);

  // Celebrate when the visitor reaches for the primary CTA — throttled so
  // repeated hover/focus doesn't spam. Confetti auto-skips under reduced motion
  // inside CharacterCompanion.
  const lastCelebrateRef = React.useRef(0);
  const celebrate = React.useCallback(() => {
    const now = Date.now();
    if (now - lastCelebrateRef.current < 3000) return;
    lastCelebrateRef.current = now;
    dispatchMood('applaud', { celebrate: true });
  }, []);

  return (
    <section
      aria-labelledby="landing-hero-heading"
      style={{
        position: 'relative',
        overflow: 'hidden',
        padding: 'clamp(56px, 8vw, 96px) clamp(20px, 5vw, 64px) clamp(40px, 5vw, 64px)',
        // Transparent so the page-level fixed WebGL backdrop shows through this
        // fold (readability is held by the page veil in PublicPageShell).
        background: 'transparent',
      }}
    >
      {/* Character companion — greets on load, applauds on CTA reach. Hidden on
          narrow screens so it never crowds the headline. */}
      <div
        className="hidden md:block"
        style={{
          position: 'absolute',
          top: 'clamp(16px, 3vw, 40px)',
          right: 'clamp(20px, 5vw, 64px)',
          zIndex: 1,
          pointerEvents: 'none',
        }}
      >
        <CharacterCompanion size={72} showCaption={false} />
      </div>

      <div
        aria-hidden
        style={{
          position: 'absolute',
          top: -60,
          right: -90,
          fontFamily: 'var(--font-display)',
          fontStyle: 'italic',
          fontWeight: 300,
          fontSize: 'clamp(220px, 28vw, 420px)',
          color: 'var(--rule)',
          opacity: 0.5,
          lineHeight: 0.85,
          pointerEvents: 'none',
          letterSpacing: '-0.06em',
          userSelect: 'none',
          transform: 'translateZ(0)',
          animation: 'driftSlow 18s ease-in-out infinite',
          zIndex: 0,
        }}
      >
        №.01
      </div>

      <div
        className="editorial-stage"
        style={{
          position: 'relative',
          zIndex: 1,
          maxWidth: 880,
          margin: '0 auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 28,
        }}
      >
        <span className="editorial-caption">
          Smoke Ledger · An honest tracker · Established 2026
        </span>

        <h1
          id="landing-hero-heading"
          className="editorial-headline"
          style={{
            fontSize: 'clamp(48px, 8vw, 84px)',
            margin: 0,
            color: 'var(--text)',
          }}
        >
          Know every stick.
          <br />
          Spend less.
          <br />
          <span style={{ color: 'var(--accent)', fontStyle: 'italic' }}>Quit on your terms.</span>
        </h1>

        <div
          className="rule-draw"
          style={{ borderTop: '1px solid var(--rule-strong)', width: 80 }}
        />

        <p
          style={{
            fontSize: 17,
            lineHeight: 1.6,
            color: 'var(--text-muted)',
            margin: 0,
            maxWidth: 560,
            fontFamily: 'var(--font-display)',
            fontStyle: 'italic',
          }}
        >
          A private, observational record of your smoking — not a streak game, not a guilt
          machine. Free, forever.
        </p>

        <div
          style={{
            display: 'flex',
            gap: 16,
            alignItems: 'center',
            flexWrap: 'wrap',
          }}
        >
          <Link href="/signup" style={PRIMARY_CTA_STYLE} onMouseEnter={celebrate} onFocus={celebrate}>
            Begin the ledger
            <span aria-hidden style={{ fontSize: 18 }}>
              →
            </span>
          </Link>
          <Link
            href="/login"
            style={{
              fontFamily: 'var(--font-display)',
              fontStyle: 'italic',
              fontSize: 14,
              color: 'var(--text-muted)',
              textDecoration: 'none',
            }}
          >
            Already have an account? <span style={{ color: 'var(--accent)' }}>Sign in →</span>
          </Link>
        </div>

        <span
          style={{
            fontSize: 11,
            color: 'var(--text-faint)',
            fontFamily:
              'var(--font-mono, ui-monospace, SFMono-Regular, Menlo, monospace)',
            letterSpacing: '0.12em',
          }}
        >
          Support software, not medical care. Adults 18+.
        </span>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 18,
            marginTop: 16,
            paddingTop: 24,
            borderTop: '1px solid var(--rule)',
            perspective: 1000,
            transformStyle: 'preserve-3d',
          }}
        >
          {PILLARS.map(({ num, title, copy }, i) => (
            <TiltCard
              key={num}
              max={8}
              lift={10}
              glare
              style={{
                padding: '18px 16px',
                background: 'var(--bg-elevated)',
                border: '1px solid var(--rule)',
                borderRadius: 10,
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                opacity: 0,
                animationDelay: `${i * 80 + 600}ms`,
                animationName: 'pillarRise',
                animationDuration: '700ms',
                animationTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)',
                animationFillMode: 'both',
              }}
            >
              <span
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 32,
                  color: 'var(--accent)',
                  lineHeight: 1,
                  fontStyle: 'italic',
                  fontWeight: 500,
                }}
              >
                {num}
              </span>
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{title}</span>
              <span style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                {copy}
              </span>
            </TiltCard>
          ))}
        </div>
      </div>
    </section>
  );
}

'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { TiltCard } from '@web/components/onboarding/TiltCard';

const PILLARS: { num: string; title: string; copy: string }[] = [
  { num: 'I.', title: 'Free', copy: 'No ads, no upsell, no subscription tier.' },
  { num: 'II.', title: 'Private', copy: 'Encrypted at rest. Yours to export or delete.' },
  { num: 'III.', title: 'Honest', copy: 'No streaks. No badges. No shame patterns.' },
];

export default function OnboardingWelcomePage() {
  const router = useRouter();
  const [pressed, setPressed] = React.useState(false);

  const advance = React.useCallback(() => {
    router.push('/onboarding/privacy');
  }, [router]);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || target?.isContentEditable) return;
      if (e.key === 'Enter' || e.key === 'ArrowRight') {
        e.preventDefault();
        advance();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [advance]);

  return (
    <div
      className="editorial-stage"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 32,
        maxWidth: 640,
        position: 'relative',
      }}
    >
      <div
        aria-hidden
        style={{
          position: 'absolute',
          top: -40,
          right: -80,
          fontFamily: 'var(--font-display)',
          fontStyle: 'italic',
          fontWeight: 300,
          fontSize: 360,
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

      <div style={{ position: 'relative', zIndex: 1 }}>
        <span className="editorial-caption">An honest tracker · Established 2026</span>
      </div>

      <h1
        className="editorial-headline"
        style={{
          fontSize: 'clamp(40px, 5.5vw, 64px)',
          margin: 0,
          color: 'var(--text)',
          position: 'relative',
          zIndex: 1,
        }}
      >
        Know every stick.
        <br />
        Spend less.
        <br />
        <span style={{ color: 'var(--accent-ink)', fontStyle: 'italic' }}>Quit on your terms.</span>
      </h1>

      <div
        className="rule-draw"
        style={{
          borderTop: '1px solid var(--rule-strong)',
          width: 80,
          position: 'relative',
          zIndex: 1,
        }}
      />

      <p
        style={{
          fontSize: 16,
          lineHeight: 1.6,
          color: 'var(--text-muted)',
          margin: 0,
          maxWidth: 520,
          position: 'relative',
          zIndex: 1,
        }}
      >
        Smoke Ledger is a private, observational record of your smoking — not a streak game, not a
        guilt machine. We&rsquo;ll set this up in four small steps. About ninety seconds.
      </p>

      <div
        style={{
          display: 'flex',
          gap: 16,
          alignItems: 'center',
          position: 'relative',
          zIndex: 1,
        }}
      >
        <button
          type="button"
          onClick={advance}
          onMouseDown={() => setPressed(true)}
          onMouseUp={() => setPressed(false)}
          onMouseLeave={() => setPressed(false)}
          className="focus-ring"
          style={{
            height: 56,
            padding: '0 28px',
            border: 'none',
            cursor: 'pointer',
            background: 'var(--accent-ink)',
            color: 'var(--on-accent)',
            borderRadius: 10,
            fontFamily: 'var(--font-sans)',
            fontWeight: 600,
            fontSize: 15,
            letterSpacing: '0.01em',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 10,
            transform: pressed ? 'translateY(2px) scale(0.98)' : 'translateY(0) scale(1)',
            boxShadow: pressed
              ? '0 2px 8px rgba(47, 163, 155, 0.3)'
              : '0 12px 32px -8px rgba(47, 163, 155, 0.45), 0 2px 4px rgba(11, 15, 20, 0.08)',
            transition: 'transform 120ms ease-out, box-shadow 240ms ease',
          }}
        >
          Begin the ledger
          <span aria-hidden style={{ fontSize: 18 }}>
            →
          </span>
        </button>
        <span
          style={{
            fontSize: 11,
            color: 'var(--text-faint)',
            fontFamily: 'var(--font-mono, ui-monospace, SFMono-Regular, Menlo, monospace)',
            letterSpacing: '0.12em',
          }}
        >
          ↵ ENTER
        </span>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 18,
          marginTop: 16,
          paddingTop: 24,
          borderTop: '1px solid var(--rule)',
          position: 'relative',
          transformStyle: 'preserve-3d',
          perspective: 1000,
          zIndex: 1,
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
                color: 'var(--accent-ink)',
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
  );
}

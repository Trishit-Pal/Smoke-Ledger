'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { SETUP_STEPS, type SetupStepKey } from '@web/components/onboarding/steps';

/**
 * What each step asks and why. Keep every line true of the step as built:
 * the usual-day number (Settings) and the goal (Goals) are the answers a reader
 * can change after setup, so the lead names only those.
 */
const STEP_DETAILS: Record<SetupStepKey, { asks: string; why: string }> = {
  privacy: {
    asks: 'Confirm you’re 18 or older, accept the terms, and consent to us keeping a record of your smoking. Analytics is optional.',
    why: 'What you log is health information, so the ledger needs your consent first.',
  },
  usage: {
    asks: 'How many you smoke on a usual day, how you usually buy, and how many days to compare over.',
    why: 'Your savings and trends are measured against it.',
  },
  goal: {
    asks: 'One small limit if you want one: sticks a day, spend a day, or hours without smoking.',
    why: 'Your dashboard shows how each day compares with it.',
  },
  brands: {
    asks: 'The few brands you smoke most.',
    why: 'They come first in the dashboard’s quick log, so logging one takes a tap.',
  },
};

/** Stagger index for the editorial-stage entrance (instant under reduced motion). */
const idx = (n: number) => ({ ['--ed-index' as string]: n }) as React.CSSProperties;

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
    <div className="editorial-stage flex max-w-[640px] flex-col gap-xl">
      <header className="flex flex-col gap-md" style={idx(0)}>
        <h1
          className="editorial-headline m-0"
          style={{ fontSize: 'clamp(32px, 4vw, 44px)', color: 'var(--text)' }}
        >
          Set up your ledger.
        </h1>
        <p className="m-0 max-w-[34rem]" style={{ fontSize: 16, lineHeight: 1.6, color: 'var(--text-muted)' }}>
          Four short steps, a few minutes. Your usual-day number and your goal can be changed later,
          in Settings and Goals.
        </p>
      </header>

      <ol
        aria-label="Setup steps"
        className="m-0 list-none p-0"
        style={{ ...idx(1), borderTop: '1px solid var(--rule-strong)' }}
      >
        {SETUP_STEPS.map((step) => (
          <li
            key={step.key}
            className="grid items-baseline gap-x-lg py-lg"
            style={{ gridTemplateColumns: 'auto 1fr', borderBottom: '1px solid var(--rule)' }}
          >
            {/* Same folio as the rail; the <ol> already numbers the steps for screen readers. */}
            <span aria-hidden className="editorial-caption-tight nums-tabular" style={{ color: 'var(--text-faint)' }}>
              {step.index}
            </span>
            <div className="flex max-w-[34rem] flex-col gap-xs">
              <h2
                className="m-0"
                style={{ fontFamily: 'var(--font-display)', fontWeight: 400, fontSize: 20, lineHeight: 1.25 }}
              >
                {step.label}
              </h2>
              <p className="m-0" style={{ fontSize: 15, lineHeight: 1.55, color: 'var(--text)' }}>
                {STEP_DETAILS[step.key].asks}
              </p>
              <p className="m-0" style={{ fontSize: 13, lineHeight: 1.55, color: 'var(--text-muted)' }}>
                {STEP_DETAILS[step.key].why}
              </p>
            </div>
          </li>
        ))}
      </ol>

      <div className="flex flex-wrap items-center gap-lg" style={idx(2)}>
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
          Start setup
          <span aria-hidden style={{ fontSize: 18 }}>
            →
          </span>
        </button>
        {/* Keyboard hint only where a keyboard is likely. */}
        <span className="hidden text-small md:inline" style={{ color: 'var(--text-faint)' }}>
          or press Enter
        </span>
      </div>
    </div>
  );
}

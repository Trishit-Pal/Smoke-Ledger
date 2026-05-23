'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { DigitRoll } from '@web/components/onboarding/DigitRoll';
import { SealCircle } from '@web/components/onboarding/SealCircle';
import { PaperEdge } from '@web/components/onboarding/PaperEdge';
import { ThemeToggle } from '@web/components/layout/ThemeToggle';
import { useReduceMotion } from '@web/components/onboarding/useReduceMotion';
import type { GoalType } from '@/types';

const PRICE_PER_STICK = 18;

interface GoalSummary {
  type: GoalType;
  targetValue: number;
}

interface GoalDisplay {
  label: string;
  unit: string;
  prefix?: string;
}

const GOAL_DISPLAY: Record<GoalType, GoalDisplay> = {
  daily_cap: { label: 'Daily cap', unit: 'sticks / day' },
  spend_cap_daily: { label: 'Spend cap', unit: 'INR / day', prefix: '₹' },
  reduction_target: { label: 'Reduction target', unit: '% below baseline' },
  no_smoke_window: { label: 'No-smoke window', unit: 'hours protected' },
  weekly_target: { label: 'Weekly target', unit: 'sticks / week' },
  quit_date: { label: 'Quit date', unit: '' },
};

const PURCHASE_PREF_LABEL: Record<'single' | 'pack' | 'mixed', string> = {
  single: 'mostly singles',
  pack: 'mostly packs',
  mixed: 'mixed',
};

export interface OnboardingDoneClientProps {
  baselinePerDay: number;
  baselineWindowDays: number;
  purchasePref: 'single' | 'pack' | 'mixed' | null;
  favorites: string[];
  goal: GoalSummary | null;
}

export function OnboardingDoneClient({
  baselinePerDay,
  baselineWindowDays,
  purchasePref,
  favorites,
  goal,
}: OnboardingDoneClientProps) {
  const router = useRouter();
  const reduce = useReduceMotion();
  const [printed, setPrinted] = React.useState(false);

  React.useEffect(() => {
    const t = setTimeout(() => setPrinted(true), reduce ? 0 : 200);
    return () => clearTimeout(t);
  }, [reduce]);

  const baseline = Math.max(0, Math.round(Number(baselinePerDay) || 0));
  const yearlySpend = baseline * PRICE_PER_STICK * 365;

  const today = new Date();
  const dateLine = today.toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const filedDate = today.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

  const goalDisplay = goal ? GOAL_DISPLAY[goal.type] : null;

  return (
    <div
      className="editorial-stage"
      style={{ display: 'flex', flexDirection: 'column', gap: 28, maxWidth: 720, position: 'relative' }}
    >
      <ThemeToggle placement="floating-onboarding" />

      <header style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <span className="editorial-caption">The ledger is open · {dateLine}</span>
        <h2
          className="editorial-headline"
          style={{ fontSize: 'clamp(36px, 5vw, 56px)', margin: 0 }}
        >
          You&rsquo;re set up.
          <br />
          <span style={{ color: 'var(--accent)', fontStyle: 'italic' }}>
            One stick at a time.
          </span>
        </h2>
      </header>

      <div
        className="rule-draw"
        style={{ borderTop: '1px solid var(--rule-strong)', width: 80 }}
      />

      <div style={{ position: 'relative' }}>
        <div
          style={{
            position: 'relative',
            padding: '32px 28px 28px 28px',
            background: 'var(--bg-elevated)',
            border: '1px solid var(--rule)',
            borderRadius: 4,
            overflow: 'visible',
            boxShadow: printed
              ? '0 24px 60px -20px rgba(11,15,20,0.18), 0 4px 12px rgba(11,15,20,0.06), inset 0 0 0 1px rgba(255,255,255,0.4)'
              : '0 0 0 transparent',
            clipPath: reduce
              ? 'inset(0 0 0 0)'
              : printed
                ? 'inset(0 0 0 0)'
                : 'inset(0 0 100% 0)',
            transition: reduce
              ? 'none'
              : 'clip-path 1100ms cubic-bezier(0.16, 1, 0.3, 1), box-shadow 600ms ease-out',
            transformOrigin: 'top center',
          }}
        >
          <PaperEdge side="top" color="var(--bg)" />
          <div
            aria-hidden
            className="paper-noise"
            style={{ position: 'absolute', inset: 0, borderRadius: 4 }}
          />

          <div style={{ position: 'absolute', top: -28, right: 24, zIndex: 2 }}>
            <SealCircle show={printed} size={96} label="SMOKE · LEDGER · " />
          </div>

          <div
            style={{
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
              gap: 14,
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'baseline',
                gap: 12,
                flexWrap: 'wrap',
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span className="editorial-caption">Your setup</span>
                <span
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontStyle: 'italic',
                    fontSize: 14,
                    color: 'var(--text-muted)',
                  }}
                >
                  Filed {filedDate}
                </span>
              </div>
              <span
                className="editorial-caption-tight nums-tabular"
                style={{ color: 'var(--text-faint)' }}
              >
                No. <DigitRoll value="0001" delay={400} />
              </span>
            </div>

            <Hairline strong />

            <SummaryRow
              label="Baseline"
              value={
                <span className="nums-tabular" style={{ display: 'inline-flex', alignItems: 'baseline', gap: 6 }}>
                  <DigitRoll value={baseline} delay={500} />
                  <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>sticks / day</span>
                </span>
              }
              sub={`Compared over ${baselineWindowDays} days${
                purchasePref ? ` · ${PURCHASE_PREF_LABEL[purchasePref]}` : ''
              }`}
            />
            <Hairline />

            <SummaryRow
              label="Goal"
              value={
                goal && goalDisplay ? (
                  <span style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic' }}>
                    {goalDisplay.label} ·{' '}
                    <span
                      className="nums-tabular"
                      style={{ fontStyle: 'normal', display: 'inline-flex', alignItems: 'baseline' }}
                    >
                      {goalDisplay.prefix ?? ''}
                      <DigitRoll value={goal.targetValue} delay={700} />
                    </span>{' '}
                    <span
                      style={{
                        color: 'var(--text-muted)',
                        fontSize: 13,
                        fontStyle: 'normal',
                      }}
                    >
                      {goalDisplay.unit}
                    </span>
                  </span>
                ) : (
                  <span
                    style={{
                      color: 'var(--text-muted)',
                      fontStyle: 'italic',
                      fontFamily: 'var(--font-display)',
                    }}
                  >
                    Skipped — that&rsquo;s fine
                  </span>
                )
              }
            />
            <Hairline />

            <SummaryRow
              label="Favorites"
              value={
                <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 6 }}>
                  <DigitRoll value={favorites.length} delay={900} />
                  <span style={{ fontSize: 14 }}>
                    brand{favorites.length === 1 ? '' : 's'}
                  </span>
                </span>
              }
              sub={
                favorites.length > 0
                  ? favorites.slice(0, 4).join(' · ') +
                    (favorites.length > 4 ? ' …' : '')
                  : 'You can add favorites later from Settings.'
              }
            />
            <Hairline />

            <SummaryRow
              label="At this rate"
              value={
                <span
                  className="nums-tabular"
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: 24,
                    display: 'inline-flex',
                    alignItems: 'baseline',
                  }}
                >
                  ₹<DigitRoll value={yearlySpend.toLocaleString('en-IN')} delay={1100} />
                </span>
              }
              sub="Annual spend on cigarettes at current baseline."
              accent
            />
          </div>

          <PaperEdge side="bottom" color="var(--bg)" />
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <p
          style={{
            margin: 0,
            fontSize: 14,
            color: 'var(--text-muted)',
            lineHeight: 1.55,
            fontFamily: 'var(--font-display)',
            fontStyle: 'italic',
            maxWidth: 520,
          }}
        >
          &ldquo;Awareness is the first move. Nothing to prove today — just observe, log,
          learn.&rdquo;
        </p>
        <div>
          <DashboardButton onClick={() => router.replace('/dashboard')} />
        </div>
      </div>
    </div>
  );
}

interface HairlineProps {
  strong?: boolean;
}

function Hairline({ strong }: HairlineProps) {
  return (
    <div
      aria-hidden
      style={{
        borderTop: `1px solid var(--${strong ? 'rule-strong' : 'rule'})`,
        width: '100%',
      }}
    />
  );
}

interface SummaryRowProps {
  label: string;
  value: React.ReactNode;
  sub?: string;
  accent?: boolean;
}

function SummaryRow({ label, value, sub, accent }: SummaryRowProps) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '120px 1fr',
        gap: 16,
        alignItems: 'baseline',
      }}
    >
      <span className="editorial-caption-tight">{label}</span>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{ fontSize: 17, color: accent ? 'var(--accent)' : 'var(--text)' }}>
          {value}
        </span>
        {sub ? (
          <span style={{ fontSize: 12, color: 'var(--text-faint)', lineHeight: 1.5 }}>
            {sub}
          </span>
        ) : null}
      </div>
    </div>
  );
}

interface DashboardButtonProps {
  onClick: () => void;
}

function DashboardButton({ onClick }: DashboardButtonProps) {
  const [hover, setHover] = React.useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className="focus-ring"
      style={{
        height: 52,
        padding: '0 24px',
        border: 'none',
        cursor: 'pointer',
        background: 'var(--accent)',
        color: '#ffffff',
        borderRadius: 10,
        fontFamily: 'var(--font-sans)',
        fontWeight: 600,
        fontSize: 14,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 10,
        transform: hover ? 'translateY(-2px)' : 'translateY(0)',
        boxShadow: hover
          ? '0 16px 40px -8px rgba(47, 163, 155, 0.55), 0 4px 8px rgba(11, 15, 20, 0.1)'
          : '0 12px 32px -8px rgba(47, 163, 155, 0.45), 0 2px 4px rgba(11, 15, 20, 0.08)',
        transition: 'transform 120ms ease, box-shadow 200ms ease',
      }}
    >
      Open the dashboard
      <span aria-hidden style={{ fontSize: 16 }}>
        →
      </span>
    </button>
  );
}

export default OnboardingDoneClient;

'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { TiltCard } from '@web/components/onboarding/TiltCard';
import { OnboardingStepFooter } from '@web/components/onboarding/OnboardingStepFooter';
import { createGoal } from '@/db/repositories/goals';
import { setOnboardingStep } from '@/db/repositories/profile';
import { useOnboardingDraft } from '@/store/onboardingDraft';
import { track } from '@/services/analytics';
import { AnalyticsEvents } from '@/constants/events';
import type { GoalType } from '@/types';
import { toSafeErrorMessage } from '@/lib/errors';

interface GoalOption {
  id: GoalType;
  roman: string;
  label: string;
  hint: string;
  example: string;
  unit: string;
  placeholder: string;
  defaultTarget: number;
  prefix?: string;
}

const GOAL_OPTIONS: GoalOption[] = [
  {
    id: 'daily_cap',
    roman: 'I.',
    label: 'Daily cap',
    hint: 'A ceiling — sticks per day',
    example: 'e.g. no more than 8 a day',
    unit: 'sticks / day',
    placeholder: '8',
    defaultTarget: 8,
  },
  {
    id: 'spend_cap_daily',
    roman: 'II.',
    label: 'Spend cap',
    hint: 'A ceiling — rupees per day',
    example: 'e.g. no more than ₹100 a day',
    unit: 'INR / day',
    placeholder: '100',
    defaultTarget: 100,
    prefix: '₹',
  },
  {
    id: 'reduction_target',
    roman: 'III.',
    label: 'Reduction target',
    hint: 'A direction — percent below baseline',
    example: 'e.g. 20% less than I do now',
    unit: '% below baseline',
    placeholder: '20',
    defaultTarget: 20,
  },
  {
    id: 'no_smoke_window',
    roman: 'IV.',
    label: 'No-smoke window',
    hint: 'Protected hours each day',
    example: 'e.g. nothing in the first 4 hours after waking',
    unit: 'hours protected',
    placeholder: '4',
    defaultTarget: 4,
  },
];

export default function OnboardingGoalPage() {
  const router = useRouter();
  // Draft-backed so the choice + target survive back/forward navigation.
  const { goalType: type, goalTarget: target, setGoal } = useOnboardingDraft();
  const setType = (goalType: GoalType) => setGoal({ goalType });
  const setTarget = (goalTarget: string) => setGoal({ goalTarget });
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const selected = GOAL_OPTIONS.find((g) => g.id === type) ?? null;
  const canContinue =
    type !== null && target !== '' && Number(target) > 0;

  const onSetGoal = async () => {
    if (!type) return;
    const parsed = Number(target);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setError('Enter a valid target value.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await createGoal({ type, targetValue: parsed });
      await track(AnalyticsEvents.GOAL_CREATED, { type });
      await setOnboardingStep('brands');
      router.push('/onboarding/brands');
    } catch (e) {
      setError(toSafeErrorMessage(e, 'dependency_failure'));
    } finally {
      setSubmitting(false);
    }
  };

  const onSkip = async () => {
    setSubmitting(true);
    try {
      await setOnboardingStep('brands');
    } catch {
      // non-fatal; middleware will still allow forward motion
    }
    router.push('/onboarding/brands');
  };

  return (
    <div
      className="editorial-stage"
      style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 760 }}
    >
      <header style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <span className="editorial-caption">Step 03 · A small goal</span>
        <h2
          className="editorial-headline"
          style={{ fontSize: 'clamp(32px, 4vw, 44px)', margin: 0 }}
        >
          Pick one small goal.
        </h2>
        <p
          style={{
            fontSize: 14,
            color: 'var(--text-muted)',
            margin: 0,
            lineHeight: 1.55,
            maxWidth: 520,
          }}
        >
          Small and specific is easier to sustain than ambitious. You can change this or add more
          later.
        </p>
      </header>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 16,
          perspective: 1200,
          transformStyle: 'preserve-3d',
        }}
      >
        {GOAL_OPTIONS.map((g) => {
          const isSelected = type === g.id;
          return (
            <TiltCard
              key={g.id}
              max={isSelected ? 4 : 9}
              lift={isSelected ? 18 : 12}
              glare
              onClick={() => {
                setType(g.id);
                setTarget(String(g.defaultTarget));
              }}
              ariaLabel={`Choose ${g.label}`}
              style={{
                textAlign: 'left',
                padding: 22,
                background: isSelected ? 'var(--accent-soft)' : 'var(--bg-elevated)',
                border: isSelected ? '1px solid var(--accent)' : '1px solid var(--rule)',
                borderRadius: 14,
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
                minHeight: 150,
                transition: 'background 200ms ease, border-color 200ms ease',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  justifyContent: 'space-between',
                  gap: 10,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                  <span
                    style={{
                      fontFamily: 'var(--font-display)',
                      fontSize: 28,
                      color: isSelected ? 'var(--accent)' : 'var(--text-faint)',
                      fontStyle: 'italic',
                      lineHeight: 1,
                      transition:
                        'color 240ms ease, transform 360ms cubic-bezier(0.16, 1, 0.3, 1)',
                      transform: isSelected
                        ? 'scale(1.15) translateZ(20px)'
                        : 'scale(1)',
                      display: 'inline-block',
                    }}
                  >
                    {g.roman}
                  </span>
                  <span
                    style={{
                      fontSize: 16,
                      fontWeight: 600,
                      color: isSelected ? 'var(--accent)' : 'var(--text)',
                    }}
                  >
                    {g.label}
                  </span>
                </div>
                <span
                  aria-hidden
                  style={{
                    width: 16,
                    height: 16,
                    borderRadius: 999,
                    border: isSelected ? 'none' : '1.5px solid var(--rule-strong)',
                    background: isSelected ? 'var(--accent)' : 'transparent',
                    transition: 'all 200ms cubic-bezier(0.16, 1, 0.3, 1)',
                    transform: isSelected ? 'scale(1.1)' : 'scale(1)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#ffffff',
                    fontSize: 11,
                  }}
                >
                  {isSelected ? '✓' : null}
                </span>
              </div>
              <span
                style={{
                  fontSize: 13,
                  color: 'var(--text-muted)',
                  lineHeight: 1.5,
                }}
              >
                {g.hint}
              </span>
              <span
                style={{
                  fontSize: 12,
                  color: 'var(--text-faint)',
                  fontFamily: 'var(--font-display)',
                  fontStyle: 'italic',
                  marginTop: 'auto',
                }}
              >
                {g.example}
              </span>
            </TiltCard>
          );
        })}
      </div>

      {selected ? (
        <div
          style={{
            padding: '20px 22px',
            border: '1px solid var(--rule)',
            borderRadius: 12,
            background: 'var(--bg-elevated)',
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 12,
              flexWrap: 'wrap',
            }}
          >
            <span className="editorial-caption">Target</span>
            <span
              style={{
                fontSize: 12,
                color: 'var(--text-muted)',
                fontFamily: 'var(--font-display)',
                fontStyle: 'italic',
              }}
            >
              {selected.label}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
            {selected.prefix ? (
              <span
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 40,
                  color: 'var(--text-muted)',
                  lineHeight: 1,
                }}
              >
                {selected.prefix}
              </span>
            ) : null}
            <input
              autoFocus
              type="number"
              min={1}
              step="0.1"
              inputMode="decimal"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              placeholder={selected.placeholder}
              className="nums-tabular focus-ring"
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 56,
                color: 'var(--text)',
                background: 'transparent',
                border: 'none',
                outline: 'none',
                width: 200,
                padding: 0,
                lineHeight: 1,
              }}
            />
            <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>{selected.unit}</span>
          </div>
        </div>
      ) : null}

      {error ? (
        <p role="alert" style={{ fontSize: 13, color: 'var(--warn-earth)', margin: 0 }}>
          {error}
        </p>
      ) : null}

      <OnboardingStepFooter
        onBack={() => router.push('/onboarding/usage')}
        secondary={{
          label: 'Skip for now',
          onPress: onSkip,
          disabled: submitting,
        }}
        primary={{
          label: submitting ? 'Saving…' : 'Continue →',
          onPress: onSetGoal,
          disabled: !canContinue || submitting,
          loading: submitting,
        }}
      />
    </div>
  );
}

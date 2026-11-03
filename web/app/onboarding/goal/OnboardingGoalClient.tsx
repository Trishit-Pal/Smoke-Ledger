'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { TiltCard } from '@web/components/onboarding/TiltCard';
import { OnboardingStepFooter } from '@web/components/onboarding/OnboardingStepFooter';
import { emptyGoalForm } from '@/domain/goalForm';
import { loadGoalStep, skipGoalStep, submitGoalStep } from '@/services/onboarding';
import { useOnboardingDraft } from '@/store/onboardingDraft';
import { formatMoney } from '@/lib/format';
import { regionFor } from '@/lib/regions';
import type { Goal, GoalType } from '@/types';
import { describeError } from '@/lib/errors';
import { canContinueGoalStep } from './goalStepView';

interface GoalOption {
  /** `null` is "Suggest one later": no goal now, the ledger proposes one after a week. */
  id: GoalType | null;
  roman: string;
  label: string;
  hint: string;
  example: string;
  unit: string;
  placeholder: string;
  defaultTarget: number;
  prefix?: string;
  /** A time-window goal — no numeric target; persists a default window to refine in-app. */
  window?: boolean;
}

// The default no-smoke window seeded at signup (refine the exact hours in-app).
const DEFAULT_WINDOW_LABEL = '10:00 pm – 6:00 am';

// Card IV. Not a GoalType; shown only when no goal was saved earlier in onboarding.
const SUGGEST_LATER: GoalOption = {
  id: null,
  roman: 'IV.',
  label: 'Suggest one later',
  hint: 'After a week of logging',
  example: 'the ledger proposes a cap from your own numbers',
  unit: '',
  placeholder: '',
  defaultTarget: 0,
};

function goalOptions(country: string | null): GoalOption[] {
  const region = regionFor(country) ?? regionFor(null)!;
  const euros = region.currency === 'EUR';
  return [
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
      hint: euros ? 'A ceiling — euros per day' : 'A ceiling — rupees per day',
      example: `e.g. no more than ${formatMoney(100, region.currency, { locale: region.locale })} a day`,
      unit: euros ? 'EUR / day' : 'INR / day',
      placeholder: '100',
      defaultTarget: 100,
      prefix: euros ? '€' : '₹',
    },
    {
      id: 'no_smoke_window',
      roman: 'III.',
      label: 'No-smoke window',
      hint: 'Protected hours each day',
      example: 'e.g. nothing from 10pm to 6am',
      unit: '',
      placeholder: '',
      defaultTarget: 0,
      window: true,
    },
  ];
}

export function OnboardingGoalClient({ country }: { country: string | null }) {
  const router = useRouter();
  const options = goalOptions(country);
  // Draft-backed so the choice + target survive back/forward navigation.
  const { goalType: type, goalTarget: target, setGoal } = useOnboardingDraft();
  const setTarget = (goalTarget: string) => setGoal({ goalTarget });
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  // The goal saved earlier in this onboarding (Back / refresh / re-login).
  // Continue edits it in place instead of tripping the one-active-per-type rule.
  // `undefined` = still loading: both buttons wait, so a submit can never race
  // the lookup and create a duplicate.
  const [existing, setExisting] = React.useState<Goal | null | undefined>(undefined);

  React.useEffect(() => {
    let cancelled = false;
    loadGoalStep()
      .then((draft) => {
        if (cancelled) return;
        setExisting(draft.existing);
        // Seed the draft only when the user has not chosen anything yet.
        if (draft.goalType && useOnboardingDraft.getState().goalType == null) {
          setGoal({ goalType: draft.goalType, goalTarget: draft.goalTarget });
        }
      })
      .catch(() => {
        // No prefill; Continue still saves a fresh goal.
        if (!cancelled) setExisting(null);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loaded = existing !== undefined;
  // Card IV stays out once a goal exists; the ghost "Keep and continue" covers that.
  const cards = existing === null ? [...options, SUGGEST_LATER] : options;
  // Only real goal types carry a target panel; null type is card IV.
  const selected = type == null ? null : (options.find((g) => g.id === type) ?? null);
  const canContinue = canContinueGoalStep({ loaded, type, selected, target });

  const onSetGoal = async () => {
    if (type == null) return onSkip();
    setSubmitting(true);
    setError(null);
    try {
      // Route through the same payload builder the in-app goal form uses, so a
      // goal set at signup persists identically to one set later (no theater).
      const form =
        type === 'no_smoke_window'
          ? emptyGoalForm('no_smoke_window')
          : { ...emptyGoalForm(type), target };
      const saved = await submitGoalStep(form, existing ?? null);
      setExisting(saved);
      router.push('/onboarding/brands');
    } catch (e) {
      setError(describeError(e, 'dependency_failure'));
      // The goal may have been created before a later write failed: re-read it
      // so a retry edits that goal instead of creating it again.
      // Awaited so the buttons stay disabled until the re-read lands.
      await loadGoalStep()
        .then((d) => setExisting(d.existing))
        .catch(() => {});
    } finally {
      setSubmitting(false);
    }
  };

  const onSkip = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await skipGoalStep();
      router.push('/onboarding/brands');
    } catch (e) {
      setError(describeError(e, 'dependency_failure'));
    } finally {
      setSubmitting(false);
    }
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
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(280px, 100%), 1fr))',
          gap: 16,
          perspective: 1200,
          transformStyle: 'preserve-3d',
        }}
      >
        {cards.map((g) => {
          const isSelected = type === g.id;
          return (
            <TiltCard
              key={g.id ?? 'later'}
              max={isSelected ? 4 : 9}
              lift={isSelected ? 18 : 12}
              glare
              onClick={() => {
                setGoal({
                  goalType: g.id,
                  goalTarget: g.window || g.id === null ? '' : String(g.defaultTarget),
                });
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
                      color: isSelected ? 'var(--accent-ink)' : 'var(--text-faint)',
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
                      color: isSelected ? 'var(--accent-ink)' : 'var(--text)',
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
            <span className="editorial-caption">{selected.window ? 'Quiet hours' : 'Target'}</span>
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
          {selected.window ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 32,
                  color: 'var(--text)',
                  lineHeight: 1.1,
                }}
              >
                {DEFAULT_WINDOW_LABEL}
              </span>
              <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                Fine-tune the exact hours in the app.
              </span>
            </div>
          ) : (
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
                  width: 'min(200px, 60vw)',
                  padding: 0,
                  lineHeight: 1,
                }}
              />
              <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>{selected.unit}</span>
            </div>
          )}
        </div>
      ) : null}

      {error ? (
        <p role="alert" style={{ fontSize: 13, color: 'var(--warn-earth-ink)', margin: 0 }}>
          {error}
        </p>
      ) : null}

      <OnboardingStepFooter
        onBack={() => router.push('/onboarding/usage')}
        secondary={{
          // With a goal already saved, skipping means leaving it as it is.
          label: existing ? 'Keep and continue' : 'Skip for now',
          onPress: onSkip,
          disabled: submitting || !loaded,
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

import React, { useEffect, useState } from 'react';
import { View, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { Divider } from '@/components/ui/Divider';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { FadeSlideIn } from '@/components/anim/FadeSlideIn';
import { Reveal } from '@/components/anim/Reveal';
import { Tilt } from '@/components/anim/Tilt';
import { PaperNoise } from '@/components/ui/PaperNoise';
import { spacing, radius } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { emptyGoalForm } from '@/domain/goalForm';
import { canContinueGoalStep } from '@/domain/goalStepView';
import { loadGoalStep, skipGoalStep, submitGoalStep } from '@/services/onboarding';
import { useOnboardingDraft } from '@/store/onboardingDraft';
import { useSession } from '@/store/session';
import { describeError } from '@/lib/errors';
import type { Goal, GoalType } from '@/types';


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

export default function GoalSetup() {
  const router = useRouter();
  const theme = useTheme();
  // Draft-backed so the choice + target survive back/forward navigation.
  const { goalType: type, goalTarget: target, setGoal } = useOnboardingDraft();
  const setType = (goalType: GoalType | null) => setGoal({ goalType });
  const setTarget = (goalTarget: string) => setGoal({ goalTarget });
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const refreshProfile = useSession((s) => s.refreshProfile);
  // The goal saved earlier in this onboarding (Back / relaunch / re-login).
  // Set goal edits it in place instead of tripping the one-active-per-type rule.
  // `undefined` = still loading: both buttons wait, so a submit can never race
  // the lookup and create a duplicate.
  const [existing, setExisting] = useState<Goal | null | undefined>(undefined);

  useEffect(() => {
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
        // No prefill; Set goal still saves a fresh goal.
        if (!cancelled) setExisting(null);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loaded = existing !== undefined;
  // Card IV stays out once a goal exists; the ghost "Keep and continue" covers that.
  const cards = existing === null ? [...GOAL_OPTIONS, SUGGEST_LATER] : GOAL_OPTIONS;
  // Only real goal types carry a target panel; null type is card IV.
  const selected = type == null ? null : (GOAL_OPTIONS.find((g) => g.id === type) ?? null);
  const canSetGoal = canContinueGoalStep({ loaded, type, selected, target });

  const onSetGoal = async () => {
    if (type == null) return onSkip();
    setSubmitting(true);
    setErrorMsg(null);
    try {
      // Route through the same payload builder the in-app goal form uses, so a
      // goal set at signup persists identically to one set later (no theater).
      const form =
        type === 'no_smoke_window'
          ? emptyGoalForm('no_smoke_window')
          : { ...emptyGoalForm(type), target };
      const saved = await submitGoalStep(form, existing ?? null);
      setExisting(saved);
      // The onboarding layout gates on the in-memory profile.
      await refreshProfile();
      router.push('/onboarding/brands');
    } catch (e) {
      setErrorMsg(describeError(e, 'dependency_failure'));
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
    setErrorMsg(null);
    try {
      await skipGoalStep();
      await refreshProfile();
      router.push('/onboarding/brands');
    } catch (e) {
      setErrorMsg(describeError(e, 'dependency_failure'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen>
      {/* Step header */}
      <FadeSlideIn index={0} delay={40}>
        <Text variant="caption" color={theme.textFaint} style={{ letterSpacing: 1.5 }}>
          STEP 03 · A SMALL GOAL
        </Text>
      </FadeSlideIn>

      <FadeSlideIn index={1}>
        <Text variant="display">Pick one small goal.</Text>
      </FadeSlideIn>

      <FadeSlideIn index={2}>
        <Text variant="body" muted>
          Small and specific is easier to sustain than ambitious. You can change this or add
          more later.
        </Text>
      </FadeSlideIn>

      {/* Hairline rule */}
      <FadeSlideIn index={3}>
        <View style={{ width: 60 }}>
          <Divider strong />
        </View>
      </FadeSlideIn>

      {/* Goal option cards */}
      <FadeSlideIn index={4}>
        <View style={{ gap: spacing.sm }}>
          {cards.map((g) => {
            const isSelected = type === g.id;
            return (
              <Tilt key={g.id ?? 'later'} maxDeg={isSelected ? 3 : 6}>
                <Pressable
                  onPress={() => {
                    setType(g.id);
                    setTarget(String(g.defaultTarget));
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`Choose ${g.label}`}
                >
                <Card
                  style={{
                    position: 'relative',
                    overflow: 'hidden',
                    borderColor: isSelected ? theme.accent : theme.border,
                    backgroundColor: isSelected ? theme.accentSoft : theme.card,
                  }}
                >
                  <PaperNoise />
                  <View style={{ gap: spacing.sm }}>
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'baseline',
                        justifyContent: 'space-between',
                      }}
                    >
                      <View
                        style={{ flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm }}
                      >
                        <Text
                          variant="h1"
                          color={isSelected ? theme.accent : theme.textFaint}
                          style={{ fontStyle: 'italic', fontSize: 26 }}
                        >
                          {g.roman}
                        </Text>
                        <Text
                          variant="bodyStrong"
                          color={isSelected ? theme.accent : theme.text}
                        >
                          {g.label}
                        </Text>
                      </View>
                      {/* Selection indicator */}
                      <View
                        style={{
                          width: 18,
                          height: 18,
                          borderRadius: radius.pill,
                          borderWidth: isSelected ? 0 : 1.5,
                          borderColor: theme.ruleStrong,
                          backgroundColor: isSelected ? theme.accent : 'transparent',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {isSelected ? (
                          <Text variant="caption" color={theme.bgElevated}>
                            ✓
                          </Text>
                        ) : null}
                      </View>
                    </View>

                    <Text variant="small" muted>
                      {g.hint}
                    </Text>
                    <Text
                      variant="caption"
                      color={theme.textFaint}
                      style={{ fontStyle: 'italic' }}
                    >
                      {g.example}
                    </Text>
                  </View>
                </Card>
                </Pressable>
              </Tilt>
            );
          })}
        </View>
      </FadeSlideIn>

      {/* Target input — revealed when type selected */}
      {selected ? (
        <Reveal dependencyKey={selected.id ?? 'later'} duration={300}>
          <Card>
            <View style={{ gap: spacing.sm }}>
              <View
                style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
              >
                <Text variant="caption" color={theme.textFaint} style={{ letterSpacing: 1.2 }}>
                  {selected.window ? 'QUIET HOURS' : 'TARGET'}
                </Text>
                <Text variant="caption" color={theme.textMuted} style={{ fontStyle: 'italic' }}>
                  {selected.label}
                </Text>
              </View>
              {selected.window ? (
                <View style={{ gap: spacing.xs }}>
                  <Text variant="h2">{DEFAULT_WINDOW_LABEL}</Text>
                  <Text variant="small" muted>
                    Fine-tune the exact hours in the app.
                  </Text>
                </View>
              ) : (
                <Input
                  label={
                    selected.prefix
                      ? `${selected.prefix} Amount (${selected.unit})`
                      : `Value (${selected.unit})`
                  }
                  keyboardType="number-pad"
                  value={target}
                  onChangeText={setTarget}
                  placeholder={selected.placeholder}
                  autoFocus
                />
              )}
            </View>
          </Card>
        </Reveal>
      ) : null}

      {/* Error */}
      {errorMsg ? (
        <FadeSlideIn index={5}>
          <Text variant="small" color={theme.warnEarth}>
            {errorMsg}
          </Text>
        </FadeSlideIn>
      ) : null}

      {/* Footer nav */}
      <FadeSlideIn index={6}>
        <View style={{ gap: spacing.sm }}>
          <View style={{ flexDirection: 'row', gap: spacing.md }}>
            <Button
              title="← Back"
              variant="secondary"
              style={{ flex: 1 }}
              onPress={() => router.push('/onboarding/usage')}
            />
            <Button
              title={submitting ? 'Saving…' : type == null ? 'Continue →' : 'Set goal →'}
              loading={submitting}
              disabled={!canSetGoal || submitting}
              style={{ flex: 2 }}
              onPress={onSetGoal}
            />
          </View>
          <Button
            // With a goal already saved, skipping means leaving it as it is.
            title={existing ? 'Keep and continue' : 'Skip for now'}
            variant="ghost"
            fullWidth
            disabled={submitting || !loaded}
            onPress={onSkip}
          />
        </View>
      </FadeSlideIn>
    </Screen>
  );
}

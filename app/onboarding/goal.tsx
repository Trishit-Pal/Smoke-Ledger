import React, { useState } from 'react';
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
import { createGoal } from '@/db/repositories/goals';
import { setOnboardingStep } from '@/db/repositories/profile';
import { useOnboardingDraft } from '@/store/onboardingDraft';
import { track } from '@/services/analytics';
import { AnalyticsEvents } from '@/constants/events';
import { toSafeErrorMessage } from '@/lib/errors';
import type { GoalType } from '@/types';

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

export default function GoalSetup() {
  const router = useRouter();
  const theme = useTheme();
  // Draft-backed so the choice + target survive back/forward navigation.
  const { goalType: type, goalTarget: target, setGoal } = useOnboardingDraft();
  const setType = (goalType: GoalType) => setGoal({ goalType });
  const setTarget = (goalTarget: string) => setGoal({ goalTarget });
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const selected = GOAL_OPTIONS.find((g) => g.id === type) ?? null;
  const canSetGoal = type !== null && target !== '' && Number(target) > 0;

  const onSetGoal = async () => {
    if (!type) return;
    const parsed = Number(target);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setErrorMsg('Enter a valid target value.');
      return;
    }
    setSubmitting(true);
    setErrorMsg(null);
    try {
      await createGoal({ type, targetValue: parsed });
      await track(AnalyticsEvents.GOAL_CREATED, { type });
      await setOnboardingStep('brands');
      router.push('/onboarding/brands');
    } catch (e) {
      setErrorMsg(toSafeErrorMessage(e, 'dependency_failure'));
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
          {GOAL_OPTIONS.map((g) => {
            const isSelected = type === g.id;
            return (
              <Tilt key={g.id} maxDeg={isSelected ? 3 : 6}>
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
        <Reveal dependencyKey={selected.id} duration={300}>
          <Card>
            <View style={{ gap: spacing.sm }}>
              <View
                style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
              >
                <Text variant="caption" color={theme.textFaint} style={{ letterSpacing: 1.2 }}>
                  TARGET
                </Text>
                <Text variant="caption" color={theme.textMuted} style={{ fontStyle: 'italic' }}>
                  {selected.label}
                </Text>
              </View>
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
              title={submitting ? 'Saving…' : 'Set goal →'}
              loading={submitting}
              disabled={!canSetGoal || submitting}
              style={{ flex: 2 }}
              onPress={onSetGoal}
            />
          </View>
          <Button
            title="Skip for now"
            variant="ghost"
            fullWidth
            disabled={submitting}
            onPress={onSkip}
          />
        </View>
      </FadeSlideIn>
    </Screen>
  );
}

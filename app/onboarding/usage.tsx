import React, { useState } from 'react';
import { View, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { Divider } from '@/components/ui/Divider';
import { Card } from '@/components/ui/Card';
import { AnimatedNumber } from '@/components/anim/AnimatedNumber';
import { FadeSlideIn } from '@/components/anim/FadeSlideIn';
import { Reveal } from '@/components/anim/Reveal';
import { spacing, radius } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { setSetting } from '@/db/repositories/settings';
import { updateProfile, setOnboardingStep } from '@/db/repositories/profile';
import { useOnboardingDraft } from '@/store/onboardingDraft';
import { toSafeErrorMessage } from '@/lib/errors';

const PRICE_PER_STICK = 18;
const MAX_STICKS = 40;

interface WindowOption {
  id: 7 | 30;
  label: string;
  sub: string;
}

const WINDOW_OPTIONS: WindowOption[] = [
  { id: 7, label: '7 days', sub: 'Tight cycle' },
  { id: 30, label: '30 days', sub: 'Smoother trend' },
];

interface PurchaseOption {
  id: 'single' | 'pack' | 'mixed';
  label: string;
}

const PURCHASE_OPTIONS: PurchaseOption[] = [
  { id: 'single', label: 'Mostly singles' },
  { id: 'pack', label: 'Mostly packs' },
  { id: 'mixed', label: 'Mix of both' },
];

export default function Usage() {
  const router = useRouter();
  const theme = useTheme();

  // Draft-backed so values survive back/forward navigation within the session.
  const {
    perDay: draftPerDay,
    windowDays: draftWindow,
    purchasePref: pref,
    setUsage,
  } = useOnboardingDraft();
  const perDay = draftPerDay ?? 10;
  const windowDays = draftWindow ?? 30;
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const n = Math.max(0, Math.min(MAX_STICKS, perDay));
  const dailySpend = n * PRICE_PER_STICK;
  const yearlySpend = dailySpend * 365;

  const increment = () => setUsage({ perDay: Math.min(MAX_STICKS, perDay + 1) });
  const decrement = () => setUsage({ perDay: Math.max(0, perDay - 1) });

  const onContinue = async () => {
    if (!pref) return;
    setSubmitting(true);
    setErrorMsg(null);
    try {
      await Promise.all([
        setSetting('onboarding.typicalDaily', n),
        setSetting('onboarding.purchasePref', pref),
        updateProfile({ baselinePerDay: n, baselineWindowDays: windowDays }),
      ]);
      await setOnboardingStep('goal');
      router.push('/onboarding/goal');
    } catch (e) {
      setErrorMsg(toSafeErrorMessage(e, 'dependency_failure'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen>
      {/* Step header */}
      <FadeSlideIn index={0} delay={40}>
        <Text variant="caption" color={theme.textFaint} style={{ letterSpacing: 1.5 }}>
          STEP 02 · THE BASELINE
        </Text>
      </FadeSlideIn>

      <FadeSlideIn index={1}>
        <Text variant="display">About how many a day?</Text>
      </FadeSlideIn>

      <FadeSlideIn index={2}>
        <Text variant="body" muted>
          One number is plenty. We'll use it for trends and savings — never to judge you.
        </Text>
      </FadeSlideIn>

      {/* Hairline rule */}
      <FadeSlideIn index={3}>
        <View style={{ width: 60 }}>
          <Divider strong />
        </View>
      </FadeSlideIn>

      {/* Big number display */}
      <FadeSlideIn index={4}>
        <Card style={{ position: 'relative', overflow: 'hidden' }}>
          <View style={{ flexDirection: 'row', gap: spacing.xl, flexWrap: 'wrap' }}>
            {/* Sticks per day */}
            <View style={{ gap: spacing.xs }}>
              <Text variant="caption" color={theme.textFaint} style={{ letterSpacing: 1.2 }}>
                STICKS PER DAY
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm }}>
                <AnimatedNumber
                  value={n}
                  duration={300}
                  style={{
                    fontSize: 64,
                    fontFamily: 'Fraunces_600SemiBold',
                    color: theme.text,
                    lineHeight: 70,
                  }}
                />
                <Text variant="small" muted style={{ marginBottom: 4 }}>
                  per day
                </Text>
              </View>
            </View>

            {/* Cost preview */}
            <View style={{ gap: spacing.xs }}>
              <Text variant="caption" color={theme.textFaint} style={{ letterSpacing: 1.2 }}>
                THAT'S ABOUT
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
                <Text
                  variant="h2"
                  color={theme.warnEarth}
                  style={{ fontFamily: 'Fraunces_600SemiBold' }}
                >
                  ₹
                </Text>
                <AnimatedNumber
                  value={dailySpend}
                  duration={300}
                  style={{
                    fontSize: 22,
                    fontFamily: 'Fraunces_600SemiBold',
                    color: theme.warnEarth,
                  }}
                />
                <Text variant="small" muted>
                  / day
                </Text>
              </View>
              <Text variant="caption" color={theme.textFaint}>
                ≈ ₹
                <AnimatedNumber
                  value={yearlySpend}
                  duration={400}
                  format={(v) => Math.round(v).toLocaleString('en-IN')}
                  style={{
                    fontSize: 12,
                    fontFamily: 'DMSans_400Regular',
                    color: theme.textFaint,
                  }}
                />{' '}
                a year · at ₹{PRICE_PER_STICK}/stick
              </Text>
            </View>
          </View>
        </Card>
      </FadeSlideIn>

      {/* Stepper */}
      <FadeSlideIn index={5}>
        <Card>
          <View style={{ gap: spacing.md }}>
            <Text variant="caption" color={theme.textFaint} style={{ letterSpacing: 1.2 }}>
              ADJUST
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
              <Pressable
                onPress={decrement}
                accessibilityLabel="Decrease"
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: radius.pill,
                  borderWidth: 1,
                  borderColor: theme.rule,
                  backgroundColor: theme.bgElevated,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text variant="h2" color={theme.textMuted}>
                  −
                </Text>
              </Pressable>

              {/* Stick bar visualization */}
              <Reveal dependencyKey={String(n)} style={{ flex: 1 }}>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'flex-end',
                    height: 32,
                    gap: 2,
                  }}
                >
                  {Array.from({ length: MAX_STICKS }, (_, i) => {
                    const on = i < n;
                    const isMilestone = i % 5 === 4;
                    return (
                      <View
                        key={i}
                        style={{
                          flex: 1,
                          height: on ? (isMilestone ? 24 : 14) : 4,
                          backgroundColor: on ? theme.accent : theme.rule,
                          borderRadius: 1,
                          opacity: on ? Math.max(0.55, 1 - i * 0.012) : 0.7,
                        }}
                      />
                    );
                  })}
                </View>
              </Reveal>

              <Pressable
                onPress={increment}
                accessibilityLabel="Increase"
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: radius.pill,
                  borderWidth: 1,
                  borderColor: theme.rule,
                  backgroundColor: theme.bgElevated,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text variant="h2" color={theme.textMuted}>
                  +
                </Text>
              </Pressable>
            </View>

            {/* Range labels */}
            <View
              style={{ flexDirection: 'row', justifyContent: 'space-between' }}
            >
              {['0', '10', '20', '30', '40+'].map((label) => (
                <Text key={label} variant="caption" color={theme.textFaint}>
                  {label}
                </Text>
              ))}
            </View>
          </View>
        </Card>
      </FadeSlideIn>

      {/* Comparison window */}
      <FadeSlideIn index={6}>
        <View style={{ gap: spacing.sm }}>
          <Text variant="caption" color={theme.textFaint} style={{ letterSpacing: 1.2 }}>
            COMPARE PROGRESS OVER
          </Text>
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            {WINDOW_OPTIONS.map((opt) => {
              const selected = windowDays === opt.id;
              return (
                <Pressable
                  key={opt.id}
                  onPress={() => setUsage({ windowDays: opt.id })}
                  style={{
                    flex: 1,
                    padding: spacing.md,
                    borderRadius: radius.md,
                    borderWidth: 1,
                    borderColor: selected ? theme.accent : theme.rule,
                    backgroundColor: selected ? theme.accentSoft : theme.bgElevated,
                  }}
                >
                  <Text
                    variant="bodyStrong"
                    color={selected ? theme.accent : theme.text}
                  >
                    {opt.label}
                  </Text>
                  <Text variant="small" muted>
                    {opt.sub}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </FadeSlideIn>

      {/* Purchase preference */}
      <FadeSlideIn index={7}>
        <View style={{ gap: spacing.sm }}>
          <Text variant="caption" color={theme.textFaint} style={{ letterSpacing: 1.2 }}>
            HOW DO YOU USUALLY BUY?
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {PURCHASE_OPTIONS.map((opt) => {
              const selected = pref === opt.id;
              return (
                <Pressable
                  key={opt.id}
                  onPress={() => setUsage({ purchasePref: opt.id })}
                  style={{
                    height: 36,
                    paddingHorizontal: spacing.lg,
                    borderRadius: radius.pill,
                    borderWidth: 1,
                    borderColor: selected ? theme.accent : theme.rule,
                    backgroundColor: selected ? theme.accentSoft : theme.bgElevated,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text
                    variant="small"
                    color={selected ? theme.accent : theme.textMuted}
                    style={{ fontFamily: 'DMSans_500Medium' }}
                  >
                    {opt.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </FadeSlideIn>

      {/* Error */}
      {errorMsg ? (
        <FadeSlideIn index={8}>
          <Text variant="small" color={theme.warnEarth}>
            {errorMsg}
          </Text>
        </FadeSlideIn>
      ) : null}

      {/* Footer nav */}
      <FadeSlideIn index={9}>
        <View style={{ flexDirection: 'row', gap: spacing.md }}>
          <Button
            title="← Back"
            variant="secondary"
            style={{ flex: 1 }}
            onPress={() => router.push('/onboarding/privacy')}
          />
          <Button
            title={submitting ? 'Saving…' : 'Continue →'}
            loading={submitting}
            disabled={!pref || submitting}
            style={{ flex: 2 }}
            onPress={onContinue}
          />
        </View>
      </FadeSlideIn>
    </Screen>
  );
}

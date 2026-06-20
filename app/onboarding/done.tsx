import React, { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { Divider } from '@/components/ui/Divider';
import { Card } from '@/components/ui/Card';
import { PaperNoise } from '@/components/ui/PaperNoise';
import { AnimatedNumber } from '@/components/anim/AnimatedNumber';
import { FadeSlideIn } from '@/components/anim/FadeSlideIn';
import { Tilt } from '@/components/anim/Tilt';
import { Pulse } from '@/components/anim/Pulse';
import { Figure } from '@/components/character/Figure';
import { ConfettiBurst } from '@/components/character/ConfettiBurst';
import { spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import { getSetting } from '@/db/repositories/settings';
import { track } from '@/services/analytics';
import { AnalyticsEvents } from '@/constants/events';
import { requestPermissions, scheduleDailyReminder } from '@/services/notifications';
import { useSession } from '@/store/session';
import { useOnboardingDraft } from '@/store/onboardingDraft';

const PRICE_PER_STICK = 18;

interface SummaryRow {
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
}

export default function Done() {
  const router = useRouter();
  const theme = useTheme();
  const reduce = useReduceMotion();
  const profile = useSession((s) => s.profile);
  const brands = useSession((s) => s.brands);
  const [busy, setBusy] = useState(false);
  const [purchasePref, setPurchasePref] = useState<string | null>(null);
  const [printed, setPrinted] = useState(false);
  // One-shot completion encouragement burst — gated by reduce-motion.
  const [burst, setBurst] = useState(false);
  // Favorites count comes from the session brands (mobile brands screen writes
  // isFavorite directly via the brands repo; no settings_kv key is written for
  // the favorite name list on mobile).
  const favCount = useMemo(() => brands.filter((b) => b.isFavorite).length, [brands]);

  const baseline = Math.max(0, Math.round(Number(profile?.baselinePerDay) || 0));
  const yearlySpend = baseline * PRICE_PER_STICK * 365;

  const today = new Date();
  const dateLine = today.toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const filedDate = today.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

  useEffect(() => {
    void (async () => {
      const pref = await getSetting<string>('onboarding.purchasePref');
      if (pref) setPurchasePref(pref);
    })();
    const t = setTimeout(() => setPrinted(true), 200);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (reduce) return;
    const on = setTimeout(() => setBurst(true), 500);
    const off = setTimeout(() => setBurst(false), 2400);
    return () => {
      clearTimeout(on);
      clearTimeout(off);
    };
  }, [reduce]);

  const goToDashboard = async (enableReminder: boolean) => {
    setBusy(true);
    try {
      if (enableReminder) {
        const ok = await requestPermissions();
        if (ok) {
          await scheduleDailyReminder(20, 0, 'Mind a quick check-in?');
          await track(AnalyticsEvents.REMINDER_ENABLED, { kind: 'evening' });
        }
      }
      await track(AnalyticsEvents.ONBOARDING_COMPLETED, {
        baseline_per_day: baseline,
        goal_set: false,
      });
      // Onboarding finished — discard the in-memory draft.
      useOnboardingDraft.getState().clear();
      router.replace('/(tabs)');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      {/* Completion encouragement — a victory wave + one-shot burst. The Figure
          self-collapses its animation under reduced motion; the burst never
          arms when reduce is set. */}
      <View style={{ width: 72, height: 86, position: 'relative', marginBottom: spacing.xs }}>
        <ConfettiBurst active={burst} count={22} />
        <Figure mood="victory" size={72} />
      </View>

      {/* Caption */}
      <FadeSlideIn index={0} delay={40}>
        <Text variant="caption" color={theme.textFaint} style={{ letterSpacing: 1.5 }}>
          THE LEDGER IS OPEN · {dateLine.toUpperCase()}
        </Text>
      </FadeSlideIn>

      {/* Headline */}
      <FadeSlideIn index={1}>
        <View>
          <Text variant="display">
            You're set up.{'\n'}
            <Text variant="display" color={theme.accent} style={{ fontStyle: 'italic' }}>
              One stick at a time.
            </Text>
          </Text>
        </View>
      </FadeSlideIn>

      {/* Hairline */}
      <FadeSlideIn index={2}>
        <View style={{ width: 80 }}>
          <Divider strong />
        </View>
      </FadeSlideIn>

      {/* Summary card */}
      <FadeSlideIn index={3}>
        <Tilt maxDeg={3}>
          <Card
            style={{
              position: 'relative',
              overflow: 'hidden',
              shadowOpacity: printed ? 0.08 : 0,
              shadowRadius: printed ? 16 : 0,
              shadowOffset: { width: 0, height: printed ? 8 : 0 },
              elevation: printed ? 4 : 0,
            }}
          >
            <PaperNoise />

            <View style={{ gap: spacing.lg }}>
              {/* Card header */}
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'baseline',
                }}
              >
                <View style={{ gap: 2 }}>
                  <Text variant="caption" color={theme.textFaint} style={{ letterSpacing: 1.2 }}>
                    YOUR SETUP
                  </Text>
                  <Text
                    variant="small"
                    color={theme.textMuted}
                    style={{ fontStyle: 'italic', fontFamily: 'Fraunces_400Regular' }}
                  >
                    Filed {filedDate}
                  </Text>
                </View>
                <Text variant="caption" color={theme.textFaint}>
                  No. 0001
                </Text>
              </View>

              <Divider strong />

              {/* Baseline row */}
              <View style={{ flexDirection: 'row', gap: spacing.lg, alignItems: 'baseline' }}>
                <Text
                  variant="caption"
                  color={theme.textFaint}
                  style={{ minWidth: 80, letterSpacing: 1 }}
                >
                  BASELINE
                </Text>
                <View style={{ gap: 2 }}>
                  <View
                    style={{ flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm }}
                  >
                    <AnimatedNumber
                      value={baseline}
                      duration={700}
                      style={{
                        fontSize: 22,
                        fontFamily: 'Fraunces_600SemiBold',
                        color: theme.text,
                      }}
                    />
                    <Text variant="small" muted>
                      sticks / day
                    </Text>
                  </View>
                  {purchasePref ? (
                    <Text variant="caption" color={theme.textFaint}>
                      compared over {profile?.baselineWindowDays ?? 30} days ·{' '}
                      {purchasePref}
                    </Text>
                  ) : (
                    <Text variant="caption" color={theme.textFaint}>
                      compared over {profile?.baselineWindowDays ?? 30} days
                    </Text>
                  )}
                </View>
              </View>

              <Divider />

              {/* Brands row */}
              <View style={{ flexDirection: 'row', gap: spacing.lg, alignItems: 'baseline' }}>
                <Text
                  variant="caption"
                  color={theme.textFaint}
                  style={{ minWidth: 80, letterSpacing: 1 }}
                >
                  FAVORITES
                </Text>
                <View style={{ gap: 2 }}>
                  <View
                    style={{ flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm }}
                  >
                    <AnimatedNumber
                      value={favCount}
                      duration={900}
                      style={{
                        fontSize: 18,
                        fontFamily: 'Fraunces_600SemiBold',
                        color: theme.text,
                      }}
                    />
                    <Text variant="small" muted>
                      {favCount === 1 ? 'brand' : 'brands'}
                    </Text>
                  </View>
                  {favCount === 0 ? (
                    <Text variant="caption" color={theme.textFaint}>
                      You can add favorites later from Settings.
                    </Text>
                  ) : null}
                </View>
              </View>

              <Divider />

              {/* Annual spend row */}
              <View style={{ flexDirection: 'row', gap: spacing.lg, alignItems: 'baseline' }}>
                <Text
                  variant="caption"
                  color={theme.textFaint}
                  style={{ minWidth: 80, letterSpacing: 1 }}
                >
                  AT THIS RATE
                </Text>
                <View style={{ gap: 2 }}>
                  <View
                    style={{ flexDirection: 'row', alignItems: 'baseline', gap: 2 }}
                  >
                    <Text
                      variant="h2"
                      color={theme.accent}
                      style={{ fontFamily: 'Fraunces_600SemiBold' }}
                    >
                      ₹
                    </Text>
                    <AnimatedNumber
                      value={yearlySpend}
                      duration={1100}
                      format={(v) => Math.round(v).toLocaleString('en-IN')}
                      style={{
                        fontSize: 22,
                        fontFamily: 'Fraunces_600SemiBold',
                        color: theme.accent,
                      }}
                    />
                  </View>
                  <Text variant="caption" color={theme.textFaint}>
                    Annual spend on cigarettes at current baseline.
                  </Text>
                </View>
              </View>
            </View>
          </Card>
        </Tilt>
      </FadeSlideIn>

      {/* Quote */}
      <FadeSlideIn index={4}>
        <Text
          variant="body"
          color={theme.textMuted}
          style={{
            fontStyle: 'italic',
            fontFamily: 'Fraunces_400Regular',
            lineHeight: 24,
          }}
        >
          "Awareness is the first move. Nothing to prove today — just observe, log, learn."
        </Text>
      </FadeSlideIn>

      {/* Notification prompt */}
      <FadeSlideIn index={5}>
        <Card>
          <View style={{ gap: spacing.sm }}>
            <Text variant="bodyStrong">Gentle reminders?</Text>
            <Text variant="small" muted>
              An optional evening nudge to log your day. No streak shaming, no health
              claims. A single reminder around 20:00 IST, only if you haven't logged that
              day. You can turn this off anytime.
            </Text>
          </View>
        </Card>
      </FadeSlideIn>

      {/* CTA buttons */}
      <FadeSlideIn index={6}>
        <View style={{ gap: spacing.sm }}>
          <Pulse active>
            <Button
              title="Enable reminder"
              fullWidth
              size="lg"
              loading={busy}
              onPress={() => goToDashboard(true)}
            />
          </Pulse>
          <Button
            title="Open the dashboard →"
            variant="secondary"
            fullWidth
            loading={busy}
            onPress={() => goToDashboard(false)}
          />
        </View>
      </FadeSlideIn>
    </Screen>
  );
}

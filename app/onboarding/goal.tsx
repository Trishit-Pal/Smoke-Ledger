import React, { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { FadeSlideIn } from '@/components/anim/FadeSlideIn';
import { Reveal } from '@/components/anim/Reveal';
import { spacing } from '@/constants/theme';
import { createGoal } from '@/db/repositories/goals';
import { setOnboardingStep } from '@/db/repositories/profile';
import { track } from '@/services/analytics';
import { AnalyticsEvents } from '@/constants/events';
import type { GoalType } from '@/types';

const GOAL_TYPES: { id: GoalType; label: string; hint: string }[] = [
  { id: 'daily_cap', label: 'Daily cap', hint: 'Max sticks per day' },
  { id: 'spend_cap_daily', label: 'Daily spend cap', hint: 'Max ₹ per day' },
  { id: 'no_smoke_window', label: 'No-smoke window', hint: 'Specific hours each day' },
  { id: 'reduction_target', label: 'Reduction target', hint: '% reduction goal' },
];

export default function GoalSetup() {
  const router = useRouter();
  const [type, setType] = useState<GoalType | null>(null);
  const [target, setTarget] = useState<string>('');

  return (
    <Screen>
      <View style={{ gap: spacing.lg }}>
        <FadeSlideIn index={0}>
          <Text variant="h1">Pick one small goal</Text>
        </FadeSlideIn>

        <FadeSlideIn index={1}>
          <Text variant="body" muted>
            Small, specific goals work best. You can add more later.
          </Text>
        </FadeSlideIn>

        <FadeSlideIn index={2}>
          <Card>
            <View style={{ gap: spacing.md }}>
              <Text variant="bodyStrong">Goal type</Text>
              <View style={{ gap: spacing.sm }}>
                {GOAL_TYPES.map((g) => (
                  <View key={g.id}>
                    <Chip
                      label={`${g.label} — ${g.hint}`}
                      selected={type === g.id}
                      onPress={() => setType(g.id)}
                    />
                  </View>
                ))}
              </View>
            </View>
          </Card>
        </FadeSlideIn>

        {type ? (
          <Reveal dependencyKey={type} duration={300}>
            <Card>
              <Input
                label={type === 'spend_cap_daily' ? 'Cap amount (₹)' : 'Target value'}
                keyboardType="number-pad"
                value={target}
                onChangeText={setTarget}
                placeholder={type === 'daily_cap' ? 'e.g., 8' : '—'}
              />
            </Card>
          </Reveal>
        ) : null}

        <FadeSlideIn index={3}>
          <View style={{ flexDirection: 'row', gap: spacing.md }}>
            <Button
              title="Skip"
              variant="ghost"
              onPress={async () => {
                await setOnboardingStep('brands');
                router.push('/onboarding/brands');
              }}
              style={{ flex: 1 }}
            />
            <Button
              title="Set goal"
              disabled={!type || !target}
              style={{ flex: 1 }}
              onPress={async () => {
                if (!type || !target) return;
                const n = Number(target);
                if (!Number.isFinite(n)) return;
                await createGoal({ type, targetValue: n });
                await track(AnalyticsEvents.GOAL_CREATED, { type });
                await setOnboardingStep('brands');
                router.push('/onboarding/brands');
              }}
            />
          </View>
        </FadeSlideIn>
      </View>
    </Screen>
  );
}

import React, { useState, useEffect } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Chip } from '@/components/ui/Chip';
import { Card } from '@/components/ui/Card';
import { spacing } from '@/constants/theme';
import { getSetting } from '@/db/repositories/settings';
import { updateProfile, setOnboardingStep } from '@/db/repositories/profile';

export default function Baseline() {
  const router = useRouter();
  const [perDay, setPerDay] = useState<string>('');
  const [window, setWindow] = useState<7 | 30>(30);

  useEffect(() => {
    (async () => {
      const v = await getSetting<number>('onboarding.typicalDaily');
      if (v) setPerDay(String(v));
    })();
  }, []);

  return (
    <Screen>
      <View style={{ gap: spacing.lg }}>
        <Text variant="h1">Set your baseline</Text>
        <Text variant="body" muted>
          Your baseline is the reference point we compare your progress against.
          You can change it anytime from Settings.
        </Text>

        <Card>
          <View style={{ gap: spacing.md }}>
            <Input
              label="Baseline — sticks per day"
              keyboardType="number-pad"
              value={perDay}
              onChangeText={setPerDay}
              placeholder="e.g., 10"
            />
            <Text variant="caption" muted>
              COMPARISON WINDOW
            </Text>
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <Chip label="7 days" selected={window === 7} onPress={() => setWindow(7)} />
              <Chip label="30 days" selected={window === 30} onPress={() => setWindow(30)} />
            </View>
          </View>
        </Card>

        <Button
          title="Continue"
          fullWidth
          size="lg"
          disabled={!perDay || Number.isNaN(Number(perDay))}
          onPress={async () => {
            const n = Number(perDay);
            if (!Number.isFinite(n) || n < 0) return;
            await updateProfile({
              baselinePerDay: n,
              baselineWindowDays: window,
            });
            await setOnboardingStep('goal');
            router.push('/onboarding/goal');
          }}
        />
      </View>
    </Screen>
  );
}

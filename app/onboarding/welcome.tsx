import React from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { FadeSlideIn } from '@/components/anim/FadeSlideIn';
import { Pulse } from '@/components/anim/Pulse';
import { spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';

export default function Welcome() {
  const router = useRouter();
  const theme = useTheme();
  return (
    <Screen>
      <View style={{ flex: 1, gap: spacing.lg, paddingTop: spacing.xxl }}>
        <FadeSlideIn index={0} delay={0}>
          <View
            style={{
              width: 56,
              height: 56,
              borderRadius: 16,
              backgroundColor: theme.accentSoft,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text variant="h1" color={theme.accent}>
              SL
            </Text>
          </View>
        </FadeSlideIn>

        <FadeSlideIn index={1}>
          <Text variant="display">Smoke Ledger</Text>
        </FadeSlideIn>

        <FadeSlideIn index={2}>
          <Text variant="body" muted>
            A calm place to reduce or quit smoking with clear daily tracking. Log what you smoke, what
            it costs in INR, and the small steps that keep progress sustainable. Sign in keeps your data
            synced securely in Smoke Ledger cloud—no ads, no third-party analytics SDKs.
          </Text>
        </FadeSlideIn>

        <View style={{ flex: 1 }} />

        <FadeSlideIn index={3}>
          <Pulse active>
            <Button
              title="Get started"
              fullWidth
              size="lg"
              onPress={() => router.push('/onboarding/privacy')}
            />
          </Pulse>
        </FadeSlideIn>
      </View>
    </Screen>
  );
}

import React, { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { spacing } from '@/constants/theme';
import { requestPermissions, scheduleDailyReminder } from '@/services/notifications';
import { markOnboarded } from '@/db/repositories/profile';
import { useSession } from '@/store/session';
import { track } from '@/services/analytics';
import { AnalyticsEvents } from '@/constants/events';

export default function Notifications() {
  const router = useRouter();
  const refresh = useSession((s) => s.refreshProfile);
  const profile = useSession((s) => s.profile);
  const [busy, setBusy] = useState(false);

  const finish = async () => {
    setBusy(true);
    try {
      await markOnboarded(profile?.baselinePerDay ?? null);
      await track(AnalyticsEvents.ONBOARDING_COMPLETED, {
        baseline_per_day: profile?.baselinePerDay ?? 0,
      });
      await refresh();
      router.replace('/(tabs)');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <View style={{ gap: spacing.lg }}>
        <Text variant="h1">Gentle reminders?</Text>
        <Text variant="body" muted>
          An optional daily nudge to log your day. No streak shaming, no
          notifications about health claims.
        </Text>

        <Card>
          <View style={{ gap: spacing.sm }}>
            <Text variant="bodyStrong">Evening check-in</Text>
            <Text variant="small" muted>
              A single reminder around 20:00 IST, only if you haven't logged that
              day. You can turn this off anytime.
            </Text>
          </View>
        </Card>

        <View style={{ gap: spacing.sm }}>
          <Button
            title="Enable reminder"
            fullWidth
            loading={busy}
            onPress={async () => {
              setBusy(true);
              const ok = await requestPermissions();
              if (ok) {
                await scheduleDailyReminder(20, 0, 'Mind a quick check-in?');
                await track(AnalyticsEvents.REMINDER_ENABLED, { kind: 'evening' });
              }
              setBusy(false);
              await finish();
            }}
          />
          <Button
            title="Not now"
            variant="ghost"
            fullWidth
            loading={busy}
            onPress={finish}
          />
        </View>
      </View>
    </Screen>
  );
}

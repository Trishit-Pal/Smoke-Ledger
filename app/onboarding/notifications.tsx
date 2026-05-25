/**
 * notifications.tsx — legacy redirect.
 *
 * Notification opt-in was absorbed into the done/summary screen.
 * Redirect any navigation here to the done screen.
 */
import React, { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';

export default function NotificationsRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/onboarding/done');
  }, [router]);

  return (
    <Screen>
      <Text variant="body" muted>
        One moment…
      </Text>
    </Screen>
  );
}

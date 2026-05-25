/**
 * setup.tsx — legacy redirect.
 *
 * The web funnel merged "setup" and "baseline" into a single "usage" step.
 * Any user who previously landed here is redirected forward to the current step.
 */
import React, { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';

export default function SetupRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/onboarding/usage');
  }, [router]);

  return (
    <Screen>
      <Text variant="body" muted>
        One moment…
      </Text>
    </Screen>
  );
}

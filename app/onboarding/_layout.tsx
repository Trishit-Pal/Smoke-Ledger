import React, { useEffect, useState } from 'react';
import { Stack, usePathname, useRouter } from 'expo-router';
import { useTheme } from '@/hooks/useTheme';
import { useSession } from '@/store/session';
import {
  canAccessOnboardingStep,
  earliestOnboardingRoute,
  hasRequiredConsents,
} from '@/lib/onboardingSteps';

export default function OnboardingLayout() {
  const theme = useTheme();
  const router = useRouter();
  const pathname = usePathname();
  const { booted, boot, profile } = useSession();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (!booted) {
      boot()
        .catch(() => {})
        .finally(() => setChecked(true));
      return;
    }
    setChecked(true);
  }, [booted, boot]);

  useEffect(() => {
    if (!checked || !profile) return;

    if (profile.onboardedAt) {
      router.replace('/(tabs)');
      return;
    }

    const path = pathname ?? '/onboarding/privacy';

    if (!hasRequiredConsents(profile) && path !== '/onboarding/privacy') {
      router.replace('/onboarding/privacy');
      return;
    }

    if (
      hasRequiredConsents(profile) &&
      !canAccessOnboardingStep(profile.onboardingStep, path)
    ) {
      router.replace(earliestOnboardingRoute(profile.onboardingStep));
    }
  }, [checked, profile, pathname, router]);

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.bg },
        animation: 'slide_from_right',
      }}
    />
  );
}

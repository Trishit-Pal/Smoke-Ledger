import React, { useEffect, useState } from 'react';
import { Stack, usePathname, useRouter } from 'expo-router';
import { useTheme } from '@/hooks/useTheme';
import { useSession } from '@/store/session';
import {
  canAccessOnboardingStep,
  effectiveOnboardingStep,
  hasRequiredConsents,
  resumeOnboardingRoute,
} from '@/lib/onboardingSteps';

export default function OnboardingLayout() {
  const theme = useTheme();
  const router = useRouter();
  const pathname = usePathname();
  const { booted, boot, profile } = useSession();
  // "checked" = a boot attempt has finished. Derived from `booted` so the
  // already-booted path needs no synchronous setState inside the effect.
  const [bootAttempted, setBootAttempted] = useState(false);
  const checked = booted || bootAttempted;

  useEffect(() => {
    if (booted) return;
    boot()
      .catch(() => {})
      .finally(() => setBootAttempted(true));
  }, [booted, boot]);

  useEffect(() => {
    if (!checked || !profile) return;

    // The /done screen is the last onboarding step and is shown AFTER markOnboarded
    // sets onboardedAt. Allow it to render; the done screen itself navigates to tabs.
    // An onboarded reader is never sent to a wizard step from here, missing consents
    // or not: the root guard owns re-consent (/consent).
    if (profile.onboardedAt) {
      if (pathname !== '/onboarding/done') router.replace('/(tabs)');
      return;
    }

    const path = pathname ?? '/onboarding/privacy';

    if (!hasRequiredConsents(profile) && path !== '/onboarding/privacy') {
      router.replace('/onboarding/privacy');
      return;
    }

    // Same derived step for "may I see this" and "where do I resume", so the
    // two can never disagree (a legacy consented row has no saved step).
    if (
      hasRequiredConsents(profile) &&
      !canAccessOnboardingStep(effectiveOnboardingStep(profile), path)
    ) {
      router.replace(resumeOnboardingRoute(profile));
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

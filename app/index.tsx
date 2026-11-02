import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Redirect } from 'expo-router';
import { useSession } from '@/store/session';
import { useAuth } from '@/store/auth';
import { useTheme } from '@/hooks/useTheme';
import { isOnboarded } from '@/lib/compliance';
import { resumeOnboardingRoute } from '@/lib/onboardingSteps';

export default function IndexRedirect() {
  const session = useAuth((s) => s.session);
  const initialized = useAuth((s) => s.initialized);
  const profile = useSession((s) => s.profile);
  const booted = useSession((s) => s.booted);
  const theme = useTheme();

  if (!initialized) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.bg, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color={theme.accent} />
      </View>
    );
  }

  if (!session) {
    return <Redirect href="/login" />;
  }

  if (!booted) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.bg, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color={theme.accent} />
      </View>
    );
  }

  // Mid-wizard sign-in resumes at the saved step (privacy until consented).
  if (!isOnboarded(profile)) return <Redirect href={resumeOnboardingRoute(profile)} />;
  return <Redirect href="/(tabs)" />;
}

import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Redirect, Stack, useGlobalSearchParams, usePathname } from 'expo-router';
import { useTheme } from '@/hooks/useTheme';
import { isReauthRequest } from '@/lib/reauth';
import { useAuth } from '@/store/auth';

export default function AuthLayout() {
  const theme = useTheme();
  const session = useAuth((s) => s.session);
  const initialized = useAuth((s) => s.initialized);
  const pathname = usePathname();
  const { reason } = useGlobalSearchParams<{ reason?: string }>();

  if (!initialized) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.bg, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color={theme.accent} />
      </View>
    );
  }

  // A signed-in user sent to sign in again before account deletion stays here.
  if (session && !isReauthRequest(pathname, reason)) return <Redirect href="/" />;

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.bg },
      }}
    >
      <Stack.Screen name="login" />
      <Stack.Screen name="signup" />
      <Stack.Screen name="reset" />
    </Stack>
  );
}

import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Redirect, Stack } from 'expo-router';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/store/auth';

export default function AuthLayout() {
  const theme = useTheme();
  const session = useAuth((s) => s.session);
  const initialized = useAuth((s) => s.initialized);

  if (!initialized) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.bg, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color={theme.accent} />
      </View>
    );
  }

  if (session) return <Redirect href="/" />;

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

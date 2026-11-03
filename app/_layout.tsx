import React, { useEffect, useState } from 'react';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import { Fraunces_400Regular, Fraunces_600SemiBold } from '@expo-google-fonts/fraunces';
import {
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_600SemiBold,
  DMSans_700Bold,
} from '@expo-google-fonts/dm-sans';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';
import { useSession } from '@/store/session';
import { useAuth } from '@/store/auth';
import { useTheme } from '@/hooks/useTheme';
import { track } from '@/services/analytics';
import { AnalyticsEvents } from '@/constants/events';
import { Text } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { spacing } from '@/constants/theme';
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { toSafeErrorMessage } from '@/lib/errors';
import { clearNativeDevice } from '@/lib/privacy/clearDeviceNative';
import { MilestoneCelebration } from '@/components/character/MilestoneCelebration';
import { LogoutFarewell } from '@/components/character/LogoutFarewell';
import { GoalMoment } from '@/components/character/GoalMoment';
import { RealtimeRefresher } from '@/components/realtime/RealtimeRefresher';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const [ready, setReady] = useState(false);
  // Missing-env is knowable at first render, so seed it here instead of a
  // synchronous setState inside the boot effect.
  const [error, setError] = useState<string | null>(() =>
    isSupabaseConfigured()
      ? null
      : 'Supabase is not configured. Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to .env (see .env.example) and restart Expo.',
  );
  // Editorial fonts (Fraunces display + DM Sans body). Render is gated until
  // these resolve so the first paint already uses the brand type.
  const [fontsLoaded, fontError] = useFonts({
    Fraunces_400Regular,
    Fraunces_600SemiBold,
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_600SemiBold,
    DMSans_700Bold,
  });
  const fontsReady = fontsLoaded || !!fontError;
  const boot = useSession((s) => s.boot);
  const resetSession = useSession((s) => s.reset);
  const setSession = useAuth((s) => s.setSession);
  const setAuthInitialized = useAuth((s) => s.setInitialized);
  const theme = useTheme();

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      // `error` is already seeded by the useState initializer above.
      setAuthInitialized(true);
      return;
    }

    let cancelled = false;
    const supabase = getSupabase();

    const init = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (cancelled) return;
        setSession(session);
        setAuthInitialized(true);
        if (session) {
          await boot();
          await track(AnalyticsEvents.APP_OPENED, { first_open: false });
        } else {
          resetSession();
        }
        if (!cancelled) setReady(true);
        SplashScreen.hideAsync().catch(() => {});
      } catch (e) {
        if (!cancelled) {
          setError(toSafeErrorMessage(e, 'dependency_failure'));
          setAuthInitialized(true);
          SplashScreen.hideAsync().catch(() => {});
        }
      }
    };

    void init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      setSession(session);
      if (event === 'SIGNED_OUT' || !session) {
        resetSession();
        // Only an explicit SIGNED_OUT clears device stores: INITIAL_SESSION also arrives with a
        // null session on a cold or offline start, and wiping the stored session then would
        // sign the reader out for good.
        if (event === 'SIGNED_OUT') void clearNativeDevice('signOut');
        setReady(true);
        return;
      }
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        try {
          await boot();
          setReady(true);
          SplashScreen.hideAsync().catch(() => {});
        } catch (e) {
          setError(toSafeErrorMessage(e, 'dependency_failure'));
        }
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [boot, resetSession, setAuthInitialized, setSession]);

  if (error) {
    const canRetry = isSupabaseConfigured();
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: theme.bg,
          alignItems: 'center',
          justifyContent: 'center',
          padding: spacing.lg,
          gap: spacing.md,
        }}
      >
        <Text variant="bodyStrong" color={theme.danger}>
          Could not start Smoke Ledger
        </Text>
        <Text variant="small" muted style={{ textAlign: 'center' }}>
          {error}
        </Text>
        {canRetry ? (
          <Button
            title="Try again"
            onPress={async () => {
              setError(null);
              setReady(false);
              try {
                await boot();
                setReady(true);
              } catch (e) {
                setError(toSafeErrorMessage(e, 'dependency_failure'));
              }
            }}
          />
        ) : null}
      </View>
    );
  }

  if (!ready || !fontsReady) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: theme.bg,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <ActivityIndicator color={theme.accent} />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ErrorBoundary label="App">
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: theme.bg },
          }}
        >
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="auth/callback" />
          <Stack.Screen name="auth/reset-password" />
          <Stack.Screen name="index" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="onboarding" />
          <Stack.Screen name="log/new" options={{ presentation: 'modal' }} />
          <Stack.Screen name="goals/new" options={{ presentation: 'modal' }} />
          <Stack.Screen name="ask" options={{ presentation: 'modal' }} />
        </Stack>
        </ErrorBoundary>
        {/* Character listeners — mounted once at the root so dispatchMilestone()
            and dispatchFarewell() reach them from any screen. They render
            nothing until their event fires. */}
        <MilestoneCelebration />
        <LogoutFarewell />
        <GoalMoment />
        {/* Subscribes to Supabase realtime CDC and refreshes the session store
            so saved changes surface across devices/screens without a manual
            refresh. Renders nothing. */}
        <RealtimeRefresher />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

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
import { Stack, usePathname, useRouter } from 'expo-router';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
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
import { isGuardLoading, routeGuardRedirect } from '@/lib/routeGuard';
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

  // The one guard for every route (tabs, modals, deep links). Redirects from an
  // effect, not <Redirect>: the Stack below must stay mounted so router.replace
  // has a navigator, and <Redirect> needs a focused screen. Not Stack.Protected
  // either: it is one boolean per screen and cannot say "resume at onboarding
  // step X" or "Settings yes, History no". The guard stays `loading` until the
  // Stack is rendered (fonts, boot, error screen), because a replace before that
  // is dropped and, with an unchanged target, never retried.
  const router = useRouter();
  const pathname = usePathname();
  const session = useAuth((s) => s.session);
  const authInitialized = useAuth((s) => s.initialized);
  const profile = useSession((s) => s.profile);
  const booted = useSession((s) => s.booted);
  const guardTarget = routeGuardRedirect({
    pathname,
    hasSession: Boolean(session),
    profile,
    loading: isGuardLoading({
      ready,
      fontsReady,
      hasError: Boolean(error),
      authInitialized,
      hasSession: Boolean(session),
      booted,
    }),
  });
  // pathname in the deps: a gated -> gated move with the same target must retry.
  useEffect(() => {
    if (guardTarget) router.replace(guardTarget);
  }, [guardTarget, pathname, router]);

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
        {/* importantForAccessibility is the Android half of the overlay's modal: TalkBack
            can otherwise reach this content during the redirect frame. */}
        <View style={{ flex: 1 }} importantForAccessibility={guardTarget ? 'no-hide-descendants' : 'auto'}>
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
        </View>
        {/* Covers the root content for the frame before the redirect lands. On iOS
            native-stack presents `modal` screens above the RN root, so this sits
            beneath them: the redirect landing is the protection, this only avoids
            a flash. accessibilityViewIsModal (iOS) keeps VoiceOver on the spinner; the
            content wrapper above hides itself from TalkBack while this shows. */}
        {guardTarget ? (
          <View
            accessibilityViewIsModal
            style={[StyleSheet.absoluteFill, { backgroundColor: theme.bg, alignItems: 'center', justifyContent: 'center' }]}
          >
            <ActivityIndicator color={theme.accent} accessibilityLabel="Loading" />
          </View>
        ) : null}
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

import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Redirect, router } from 'expo-router';
import * as Linking from 'expo-linking';
import { useTheme } from '@/hooks/useTheme';
import { Text } from '@/components/ui/Text';
import { spacing } from '@/constants/theme';
import { createSessionFromUrl } from '@/lib/authCallback';
import { toSafeErrorMessage } from '@/lib/errors';

export default function AuthCallbackScreen() {
  const theme = useTheme();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [recovery, setRecovery] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const run = async (url: string | null) => {
      if (!url) {
        if (!cancelled) setError('Missing authentication link.');
        return;
      }
      const result = await createSessionFromUrl(url);
      if (cancelled) return;
      if (result === 'none') {
        setError('This link is invalid or expired.');
        return;
      }
      if (result === 'recovery') {
        setRecovery(true);
      }
      setDone(true);
    };

    void Linking.getInitialURL().then((url) => run(url));

    const sub = Linking.addEventListener('url', ({ url }) => {
      void run(url);
    });

    return () => {
      cancelled = true;
      sub.remove();
    };
  }, []);

  useEffect(() => {
    if (!done) return;
    if (recovery) {
      router.replace('/auth/reset-password');
    } else {
      router.replace('/');
    }
  }, [done, recovery]);

  if (error) {
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
          Sign-in link failed
        </Text>
        <Text variant="small" muted style={{ textAlign: 'center' }}>
          {toSafeErrorMessage(error, 'authentication_error')}
        </Text>
        <Redirect href="/login" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator color={theme.accent} />
    </View>
  );
}

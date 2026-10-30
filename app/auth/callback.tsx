import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Redirect, router } from 'expo-router';
import * as Linking from 'expo-linking';
import { useTheme } from '@/hooks/useTheme';
import { Text } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { spacing } from '@/constants/theme';
import { createSessionFromUrl } from '@/lib/authCallback';
import { maskEmail, readAuthLink } from '@/lib/authLink';
import { getSupabase } from '@/lib/supabase';
import { useAuth } from '@/store/auth';
import { toSafeErrorMessage } from '@/lib/errors';

/** A token_hash link waiting for the person on this device to confirm it. */
interface PendingLink {
  url: string;
  signedInAs: string | null;
}

export default function AuthCallbackScreen() {
  const theme = useTheme();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingLink | null>(null);
  const [redeeming, setRedeeming] = useState(false);
  const [done, setDone] = useState(false);
  const [recovery, setRecovery] = useState(false);

  const redeem = async (url: string) => {
    setRedeeming(true);
    const result = await createSessionFromUrl(url);
    setRedeeming(false);
    if (result === 'none') {
      setError('This link is invalid or expired.');
      return;
    }
    setError(null);
    if (result === 'recovery') setRecovery(true);
    // First-time confirmation — let the welcome screen celebrate it.
    if (result === 'signed_up') useAuth.getState().setJustCreated(true);
    setDone(true);
  };

  useEffect(() => {
    let cancelled = false;
    // The cold-start URL (getInitialURL) and the warm-start listener can both
    // deliver the same link; process it at most once.
    let handled = false;

    const receive = async (url: string | null) => {
      if (!url) {
        if (!cancelled && !handled) setError('Missing authentication link.');
        return;
      }
      if (handled) return;
      handled = true;

      let link: ReturnType<typeof readAuthLink>;
      try {
        link = readAuthLink(new URL(url).searchParams);
      } catch {
        link = { kind: 'invalid' };
      }
      if (link.kind === 'invalid') {
        setError('This link is invalid or expired.');
        return;
      }

      // A token_hash link is not bound to this device: anyone could send one for
      // their own account. Ask before redeeming it (security scan F3).
      if (link.kind === 'confirm') {
        const { data } = await getSupabase().auth.getSession();
        if (!cancelled) setPending({ url, signedInAs: maskEmail(data.session?.user.email) });
        return;
      }

      // A PKCE code only works with this device's verifier: redeem it now.
      if (!cancelled) await redeem(url);
    };

    void Linking.getInitialURL().then((url) => receive(url));
    const sub = Linking.addEventListener('url', ({ url }) => {
      void receive(url);
    });

    return () => {
      cancelled = true;
      sub.remove();
    };
  }, []);

  useEffect(() => {
    if (!done) return;
    router.replace(recovery ? '/auth/reset-password' : '/');
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

  if (pending && !done) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: theme.bg,
          justifyContent: 'center',
          padding: spacing.lg,
          gap: spacing.md,
        }}
      >
        <Text variant="bodyStrong">Continue to your ledger.</Text>
        <Text variant="small" muted>
          This link signs you in on this device. Continue only if you asked for it.
        </Text>
        {pending.signedInAs ? (
          <Text variant="small" color={theme.warnEarth}>
            You&apos;re signed in as {pending.signedInAs}. Continuing switches to the account in this
            link.
          </Text>
        ) : null}
        <Button title="Continue" onPress={() => void redeem(pending.url)} loading={redeeming} />
        <Button
          title="Not now"
          variant="secondary"
          onPress={() => router.replace(pending.signedInAs ? '/' : '/login')}
        />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator color={theme.accent} />
    </View>
  );
}

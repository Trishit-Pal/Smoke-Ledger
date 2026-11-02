import React, { useState } from 'react';
import { View, Pressable, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { getSupabase } from '@/lib/supabase';
import { isUnknownEmailError, toAuthErrorMessage } from '@/lib/auth-errors';
import { ACCOUNT_DELETED_PARAM, DELETE_RESUME_PATH } from '@/lib/reauth';

type Mode = 'password' | 'magic-link';

function isLikelyEmail(value: string): boolean {
  return /\S+@\S+\.\S+/.test(value.trim());
}

export default function LoginScreen() {
  const theme = useTheme();
  const router = useRouter();
  // reason=reauth: a signed-in user sent here to confirm a credential before
  // account deletion; after sign-in return to Settings to re-confirm (a sign-in
  // alone never deletes). deleted=1: the account was just deleted.
  const params = useLocalSearchParams<{ reason?: string; [ACCOUNT_DELETED_PARAM]?: string }>();
  const reason = params.reason;
  // Derived from the live param, not a useState initialiser: sign-out mounts
  // this screen (tabs guard → /login) before the ?deleted=1 replace arrives.
  const [deletedDismissed, setDeletedDismissed] = useState(false);
  const deletedNotice = params[ACCOUNT_DELETED_PARAM] === '1' && !deletedDismissed;
  // Only a password sign-in refreshes this session's `amr` claim and returns
  // here; the email link comes back through the auth callback to Home.
  const [mode, setMode] = useState<Mode>('password');
  const reauth = reason === 'reauth';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const switchMode = (next: Mode) => {
    setMode(next);
    setErr(null);
    setInfo(null);
  };

  const onSignInWithPassword = async () => {
    setErr(null);
    setInfo(null);
    if (!isLikelyEmail(email) || password.length < 8) {
      setErr('Enter your email and a password of at least 8 characters.');
      return;
    }
    setLoading(true);
    try {
      const supabase = getSupabase();
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) {
        setErr(toAuthErrorMessage(error));
        return;
      }
      if (
        data.user &&
        data.user.email &&
        !data.user.email_confirmed_at &&
        !data.user.phone_confirmed_at
      ) {
        await supabase.auth.signOut();
        setErr('Please confirm your email before signing in.');
        return;
      }
      router.replace(reason === 'reauth' ? DELETE_RESUME_PATH : '/');
    } finally {
      setLoading(false);
    }
  };

  const onSendMagicLink = async () => {
    setErr(null);
    setInfo(null);
    if (!isLikelyEmail(email)) {
      setErr('Enter the email you signed up with.');
      return;
    }
    setLoading(true);
    try {
      const supabase = getSupabase();
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          // Only sign in existing accounts via magic link — never silently
          // create a new user from this flow. New users go through /signup.
          shouldCreateUser: false,
          // The `?next=` keeps a valid query string so the email template can
          // append `&token_hash=…&type=magiclink` — the cross-device-safe path.
          emailRedirectTo: Linking.createURL('/auth/callback', { queryParams: { next: '/' } }),
        },
      });
      if (error && !isUnknownEmailError(error)) {
        setErr(toAuthErrorMessage(error));
        return;
      }
      setInfo('If that email has a ledger, we sent a sign-in link.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ flexGrow: 1, paddingTop: spacing.xl, gap: spacing.lg }}
        >
          {deletedNotice ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Dismiss"
              onPress={() => setDeletedDismissed(true)}
              style={{
                borderTopWidth: 1,
                borderBottomWidth: 1,
                borderColor: theme.rule,
                paddingVertical: spacing.md,
              }}
            >
              <Text variant="small" style={{ fontStyle: 'italic' }}>
                Your account and all its data have been deleted. You’re welcome back anytime.
              </Text>
            </Pressable>
          ) : null}

          {/* Masthead */}
          <View style={{ gap: spacing.xs }}>
            <Text variant="caption" muted>
              SIGN IN
            </Text>
            <Text variant="display">Smoke Ledger</Text>
            <Text variant="small" muted>
              {mode === 'password'
                ? 'Use the email and password you registered with.'
                : 'We will email you a one-tap sign-in link. Open it on any device.'}
            </Text>
            {reauth ? (
              // Concern, not a positive state: terracotta, never the teal accent.
              <Text variant="small" color={theme.warnEarth} style={{ fontStyle: 'italic' }}>
                Confirm it’s you to finish deleting your account. You’ll be asked once more
                before anything is deleted. No password? Delete from the web app instead.
              </Text>
            ) : null}
          </View>

          {/* Mode toggle — editorial underlined choices. Not rendered during
              re-auth (not just hidden, so it leaves the accessibility tree too):
              only a password sign-in can finish the deletion on this device. */}
          {reauth ? null : (
          <View style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'center' }}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: mode === 'password' }}
              onPress={() => switchMode('password')}
            >
              <Text
                variant="small"
                style={{
                  textTransform: 'uppercase',
                  letterSpacing: 1.2,
                  color: mode === 'password' ? theme.text : theme.textMuted,
                  textDecorationLine: mode === 'password' ? 'underline' : 'none',
                  textDecorationColor: theme.ruleStrong,
                }}
              >
                Password
              </Text>
            </Pressable>
            <Text variant="small" style={{ color: theme.textFaint }}>
              ·
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: mode === 'magic-link' }}
              onPress={() => switchMode('magic-link')}
            >
              <Text
                variant="small"
                style={{
                  textTransform: 'uppercase',
                  letterSpacing: 1.2,
                  color: mode === 'magic-link' ? theme.text : theme.textMuted,
                  textDecorationLine: mode === 'magic-link' ? 'underline' : 'none',
                  textDecorationColor: theme.ruleStrong,
                }}
              >
                Email link
              </Text>
            </Pressable>
          </View>
          )}

          {/* Form */}
          <View style={{ gap: spacing.md }}>
            <Input
              label="Email"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
            />
            {mode === 'password' ? (
              <Input
                label="Password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoComplete="password"
              />
            ) : null}

            {err ? (
              <Text variant="small" color={theme.danger}>
                {err}
              </Text>
            ) : null}
            {info ? (
              <Text variant="small" color={theme.accent} style={{ fontStyle: 'italic' }}>
                {info}
              </Text>
            ) : null}

            {mode === 'password' ? (
              <Button title="Sign in" onPress={onSignInWithPassword} loading={loading} />
            ) : (
              <Button title="Email me a sign-in link" onPress={onSendMagicLink} loading={loading} />
            )}
          </View>

          {/* Footer links */}
          <View style={{ gap: spacing.sm }}>
            <Link href="/signup" asChild>
              <Pressable accessibilityRole="button">
                <Text variant="body" color={theme.accent}>
                  Create an account
                </Text>
              </Pressable>
            </Link>
            <Link href="/reset" asChild>
              <Pressable accessibilityRole="button">
                <Text variant="small" muted>
                  Forgot password?
                </Text>
              </Pressable>
            </Link>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

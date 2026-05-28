import React, { useState } from 'react';
import { View, Pressable, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { getSupabase } from '@/lib/supabase';
import { toAuthErrorMessage } from '@/lib/auth-errors';

type Mode = 'password' | 'magic-link';

// Deep-link redirect target for the magic-link email. The app's scheme is
// registered in app.config.js (scheme: 'smokeledger') and app/auth/callback.tsx
// handles the URL on both cold and warm starts via expo-linking.
const MAGIC_LINK_REDIRECT = 'smokeledger://auth/callback';

function isLikelyEmail(value: string): boolean {
  return /\S+@\S+\.\S+/.test(value.trim());
}

export default function LoginScreen() {
  const theme = useTheme();
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('password');
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
      router.replace('/');
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
          emailRedirectTo: MAGIC_LINK_REDIRECT,
        },
      });
      if (error) {
        setErr(toAuthErrorMessage(error));
        return;
      }
      // Neutral copy — don't reveal whether the email exists (per launch posture).
      setInfo('If that email is registered, a sign-in link is on its way. Open it on this device.');
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
          {/* Masthead */}
          <View style={{ gap: spacing.xs }}>
            <Text variant="caption" muted>
              SIGN IN
            </Text>
            <Text variant="display">Smoke Ledger</Text>
            <Text variant="small" muted>
              {mode === 'password'
                ? 'Use the email and password you registered with.'
                : 'We will email you a one-tap sign-in link. Open it on this device.'}
            </Text>
          </View>

          {/* Mode toggle — editorial underlined choices */}
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

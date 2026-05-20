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
import { toSafeErrorMessage } from '@/lib/errors';

export default function LoginScreen() {
  const theme = useTheme();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async () => {
    setErr(null);
    if (!email.trim() || password.length < 8) {
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
        setErr(toSafeErrorMessage(error, 'authentication_error'));
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
          <View style={{ gap: spacing.xs }}>
            <Text variant="caption" muted>
              SIGN IN
            </Text>
            <Text variant="display">Smoke Ledger</Text>
            <Text variant="small" muted>
              Use the email and password you registered with. Data is stored in your Supabase project.
            </Text>
          </View>

          <View style={{ gap: spacing.md }}>
            <Input
              label="Email"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
            />
            <Input
              label="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="password"
            />
            {err ? (
              <Text variant="small" color={theme.danger}>
                {err}
              </Text>
            ) : null}
            <Button title="Sign in" onPress={onSubmit} loading={loading} />
          </View>

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

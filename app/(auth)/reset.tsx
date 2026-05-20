import React, { useState } from 'react';
import { View, Pressable, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { Link } from 'expo-router';
import * as Linking from 'expo-linking';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { getSupabase } from '@/lib/supabase';

export default function ResetPasswordScreen() {
  const theme = useTheme();
  const [email, setEmail] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async () => {
    setErr(null);
    setMsg(null);
    const trimmed = email.trim();
    if (!trimmed) {
      setErr('Enter your email.');
      return;
    }
    setLoading(true);
    try {
      const supabase = getSupabase();
      // Neutral copy regardless of result to avoid account enumeration.
      // Deep-link back into the mobile reset-password handler so the user can
      // complete the recovery without bouncing through a browser.
      const redirectTo = Linking.createURL('/auth/callback');
      await supabase.auth.resetPasswordForEmail(trimmed, { redirectTo });
      setMsg('If an account exists for that email, a reset link is on its way.');
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
              RESET PASSWORD
            </Text>
            <Text variant="display">Forgot password</Text>
            <Text variant="small" muted>
              We will send a reset link to your email if an account exists.
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
            {err ? (
              <Text variant="small" color={theme.danger}>
                {err}
              </Text>
            ) : null}
            {msg ? (
              <Text variant="small" color={theme.accent}>
                {msg}
              </Text>
            ) : null}
            <Button title="Send reset link" onPress={onSubmit} loading={loading} />
          </View>

          <Link href="/login" asChild>
            <Pressable accessibilityRole="button">
              <Text variant="body" color={theme.accent}>
                Back to sign in
              </Text>
            </Pressable>
          </Link>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

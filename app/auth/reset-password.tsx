import React, { useState } from 'react';
import { View, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { ConfettiBurst } from '@/components/character/ConfettiBurst';
import { spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import { getSupabase } from '@/lib/supabase';
import { toSafeErrorMessage } from '@/lib/errors';

const RESET_SESS_HOLD_SHORT = 600;
const RESET_SESS_HOLD_LONG = 2200;

export default function ResetPasswordScreen() {
  const theme = useTheme();
  const reduceMotion = useReduceMotion();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  const onSubmit = async () => {
    setErr(null);
    if (password.length < 8) {
      setErr('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setErr('Passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      const supabase = getSupabase();
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setSuccess(true);
      // Let the celebratory burst play, then sign out so the user re-enters with
      // the new password. Shorter hold when reduce-motion is enabled.
      timerRef.current = setTimeout(async () => {
        await supabase.auth.signOut();
        router.replace('/login');
      }, reduceMotion ? RESET_SESS_HOLD_SHORT : RESET_SESS_HOLD_LONG);
    } catch (e) {
      setErr(toSafeErrorMessage(e, 'authentication_error'));
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <Screen scroll={false}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm }}>
          <ConfettiBurst active={!reduceMotion} />
          <Text variant="caption" muted style={{ textTransform: 'uppercase', letterSpacing: 1.6 }}>
            Password updated
          </Text>
          <Text variant="display" style={{ textAlign: 'center' }}>
            All set
          </Text>
          <Text variant="small" muted style={{ textAlign: 'center' }}>
            Signing you out so you can sign in with your new password…
          </Text>
        </View>
      </Screen>
    );
  }

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
              NEW PASSWORD
            </Text>
            <Text variant="display">Choose a password</Text>
            <Text variant="small" muted>
              You will be signed out after updating so you can sign in with the new password.
            </Text>
          </View>

          <View style={{ gap: spacing.md }}>
            <Input
              label="New password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="new-password"
            />
            <Input
              label="Confirm password"
              value={confirm}
              onChangeText={setConfirm}
              secureTextEntry
              autoComplete="new-password"
            />
            {err ? (
              <Text variant="small" color={theme.danger}>
                {err}
              </Text>
            ) : null}
            <Button title="Update password" onPress={onSubmit} loading={loading} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

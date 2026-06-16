import React, { useState } from 'react';
import { View, Pressable, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { getSupabase } from '@/lib/supabase';
import { toSafeErrorMessage } from '@/lib/errors';
import { computeAge, MIN_AGE } from '@/domain/age';
import { GENDER_VALUES } from '@/lib/validation';
import { GENDER_LABELS } from '@/lib/profileLabels';
import type { Gender } from '@/types';

export default function SignupScreen() {
  const theme = useTheme();
  const router = useRouter();
  const [fullName, setFullName] = useState('');
  const [dob, setDob] = useState('');
  const [gender, setGender] = useState<Gender | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async () => {
    setErr(null);
    setInfo(null);
    if (!fullName.trim()) {
      setErr('Please enter your name.');
      return;
    }
    // computeAge returns null for malformed or impossible dates (e.g. Feb 30),
    // so distinguish "invalid date" from "underage" with the right message.
    const age = computeAge(dob);
    if (age === null) {
      setErr('Enter a valid date of birth as YYYY-MM-DD.');
      return;
    }
    if (age < MIN_AGE) {
      setErr('You must be 18 or older to use Smoke Ledger.');
      return;
    }
    if (!gender) {
      setErr('Please select a gender option.');
      return;
    }
    if (password.length < 8) {
      setErr('Password must be at least 8 characters.');
      return;
    }
    if (password.length > 128) {
      setErr('Password is too long.');
      return;
    }
    if (password !== confirm) {
      setErr('Passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      const supabase = getSupabase();
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          // Persisted + 18+-enforced by the handle_new_user DB trigger.
          data: {
            full_name: fullName.trim(),
            date_of_birth: dob,
            gender,
          },
        },
      });
      if (error) {
        setErr(toSafeErrorMessage(error, 'authentication_error'));
        return;
      }
      // If email confirmation is enabled, session is null and we stay on this
      // screen showing a "check your email" message. Otherwise the auth state
      // listener in `_layout.tsx` will route us to the onboarding funnel.
      if (!data.session) {
        setInfo('Check your email to confirm your account. The next step captures consent.');
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
              CREATE ACCOUNT
            </Text>
            <Text variant="display">Sign up</Text>
            <Text variant="small" muted>
              Your logs and profile are saved to the cloud. Use a strong password.
            </Text>
          </View>

          <View style={{ gap: spacing.md }}>
            <Input
              label="Name"
              value={fullName}
              onChangeText={setFullName}
              autoCapitalize="words"
              autoComplete="name"
            />
            <Input
              label="Date of birth"
              value={dob}
              onChangeText={setDob}
              placeholder="YYYY-MM-DD"
              keyboardType="numbers-and-punctuation"
              autoComplete="birthdate-full"
              hint="You must be 18 or older. This can't be changed later."
            />
            <View style={{ gap: spacing.xs }}>
              <Text
                variant="caption"
                muted
                style={{ textTransform: 'uppercase', letterSpacing: 1.6 }}
              >
                Gender
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                {GENDER_VALUES.map((g) => (
                  <Chip
                    key={g}
                    label={GENDER_LABELS[g]}
                    selected={gender === g}
                    onPress={() => setGender(g)}
                  />
                ))}
              </View>
              <Text variant="small" muted>
                This can&rsquo;t be changed later.
              </Text>
            </View>
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
            {info ? (
              <Text variant="small" muted>
                {info}
              </Text>
            ) : null}
            <Button title="Create account" onPress={onSubmit} loading={loading} />
          </View>

          <Link href="/login" asChild>
            <Pressable accessibilityRole="button">
              <Text variant="body" color={theme.accent}>
                Already have an account? Sign in
              </Text>
            </Pressable>
          </Link>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

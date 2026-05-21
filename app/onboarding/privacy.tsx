import React, { useState } from 'react';
import { View, Alert, Switch, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { FadeSlideIn } from '@/components/anim/FadeSlideIn';
import { spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { saveComplianceConsents, setOnboardingStep } from '@/db/repositories/profile';
import { setSetting } from '@/db/repositories/settings';
import { recordAuditEvent } from '@/services/audit';
import { LEGAL_URLS, LEGAL_VERSIONS } from '@/lib/legal';
import { toSafeErrorMessage } from '@/lib/errors';
import { invalidateAnalyticsConsentCache } from '@/services/analytics';

export default function Privacy() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [medicalAccepted, setMedicalAccepted] = useState(false);
  const [dataProcessingAccepted, setDataProcessingAccepted] = useState(false);
  const [analyticsOptIn, setAnalyticsOptIn] = useState(false);

  const canContinue =
    ageConfirmed && termsAccepted && privacyAccepted && medicalAccepted && dataProcessingAccepted;

  return (
    <Screen>
      <View style={{ gap: spacing.lg }}>
        <FadeSlideIn index={0}>
          <Text variant="h1">Your data in the cloud</Text>
        </FadeSlideIn>

        <FadeSlideIn index={1}>
          <Text variant="body" muted>
            You signed in with a Supabase account. Your logs, brands, goals and profile are stored in a
            Postgres database managed by Smoke Ledger (not only on this device). The app does not load
            third-party advertising or analytics SDKs; optional usage events stay in first-party tables
            protected by Row Level Security.
          </Text>
        </FadeSlideIn>

        <FadeSlideIn index={2}>
          <Card>
            <View style={{ gap: spacing.sm }}>
              <Text variant="bodyStrong">What you should know</Text>
              <Text variant="small" muted>
                • Account email and password are handled by Supabase Auth{'\n'}
                • You can sign out, erase app data, or delete your account from Settings{'\n'}
                • Review Smoke Ledger privacy/terms for retention and data rights{'\n'}
                • Prices you enter are for your reference only
              </Text>
              <View style={{ flexDirection: 'row', gap: spacing.md }}>
                <Button
                  title="Privacy policy"
                  size="sm"
                  variant="secondary"
                  onPress={() => Linking.openURL(LEGAL_URLS.privacy)}
                />
                <Button
                  title="Terms"
                  size="sm"
                  variant="secondary"
                  onPress={() => Linking.openURL(LEGAL_URLS.terms)}
                />
              </View>
            </View>
          </Card>
        </FadeSlideIn>

        <FadeSlideIn index={3}>
          <Card>
            <View style={{ gap: spacing.sm }}>
              <Text variant="bodyStrong">This is not medical advice</Text>
              <Text variant="small" muted>
                Smoke Ledger helps you observe patterns. It cannot diagnose, treat, or recommend
                quitting plans. Please consult a doctor for health decisions.
              </Text>
            </View>
          </Card>
        </FadeSlideIn>

        <FadeSlideIn index={4}>
          <Card>
            <View style={{ gap: spacing.md }}>
              <ConsentRow
                label="I confirm I am 18+."
                value={ageConfirmed}
                onChange={setAgeConfirmed}
              />
              <ConsentRow
                label="I agree to the Terms of Service."
                value={termsAccepted}
                onChange={setTermsAccepted}
              />
              <ConsentRow
                label="I acknowledge the Privacy Policy."
                value={privacyAccepted}
                onChange={setPrivacyAccepted}
              />
              <ConsentRow
                label="I understand this is not medical advice."
                value={medicalAccepted}
                onChange={setMedicalAccepted}
              />
              <ConsentRow
                label="I consent to data processing required for account, sync, and security."
                value={dataProcessingAccepted}
                onChange={setDataProcessingAccepted}
              />
              <ConsentRow
                label="Optional: allow first-party product analytics."
                value={analyticsOptIn}
                onChange={setAnalyticsOptIn}
              />
            </View>
          </Card>
        </FadeSlideIn>

        <FadeSlideIn index={5}>
          <Button
            title={submitting ? 'Saving…' : 'I understand, continue'}
            fullWidth
            size="lg"
            loading={submitting}
            disabled={!canContinue || submitting}
            onPress={async () => {
              if (!canContinue) return;
              setSubmitting(true);
              try {
                const now = new Date().toISOString();
                await Promise.all([
                  saveComplianceConsents({
                    ageConfirmedAt: now,
                    termsVersion: LEGAL_VERSIONS.terms,
                    privacyVersion: LEGAL_VERSIONS.privacy,
                    healthDisclaimerVersion: LEGAL_VERSIONS.medicalDisclaimer,
                    dataProcessingConsentAt: now,
                  }),
                  setSetting('consent.termsVersion', LEGAL_VERSIONS.terms),
                  setSetting('consent.privacyVersion', LEGAL_VERSIONS.privacy),
                  setSetting('consent.medicalDisclaimerVersion', LEGAL_VERSIONS.medicalDisclaimer),
                  setSetting('consent.analyticsOptIn', analyticsOptIn),
                ]);
                invalidateAnalyticsConsentCache();
                await recordAuditEvent('consent_accepted', 'compliance', {
                  termsVersion: LEGAL_VERSIONS.terms,
                  privacyVersion: LEGAL_VERSIONS.privacy,
                });
                await setOnboardingStep('setup');
                router.push('/onboarding/setup');
              } catch (e) {
                Alert.alert('Consent not saved', toSafeErrorMessage(e, 'dependency_failure'));
              } finally {
                setSubmitting(false);
              }
            }}
          />
        </FadeSlideIn>
      </View>
    </Screen>
  );
}

interface ConsentRowProps {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
}

function ConsentRow({ label, value, onChange }: ConsentRowProps) {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
      <View style={{ flex: 1 }}>
        <Text variant="small" muted>
          {label}
        </Text>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: theme.border, true: theme.accent }}
      />
    </View>
  );
}

import React, { useRef, useState } from 'react';
import { View, Alert, Switch, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { Divider } from '@/components/ui/Divider';
import { FadeSlideIn } from '@/components/anim/FadeSlideIn';
import { spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { consentsCurrent, submitConsentStep } from '@/services/onboarding';
import { useOnboardingDraft } from '@/store/onboardingDraft';
import { useSession } from '@/store/session';
import { LEGAL_URLS } from '@/lib/legal';
import { toSafeErrorMessage } from '@/lib/errors';

// Stagger between stamps when "Acknowledge all" is pressed (a visual beat, not a save).
const STAMP_STAGGER_MS = 120;

interface ConsentItem {
  id: string;
  label: string;
  sub?: string;
  required: boolean;
}

const CONSENT_ROWS: ConsentItem[] = [
  {
    id: 'age',
    label: 'I confirm I am 18 or older.',
    sub: 'Smoke Ledger is for adults. Required by law.',
    required: true,
  },
  {
    id: 'terms',
    label: 'I agree to the Terms of Service.',
    required: true,
  },
  {
    id: 'privacy',
    label: 'I acknowledge the Privacy Policy.',
    required: true,
  },
  {
    id: 'medical',
    label: 'I understand this app does not provide medical advice.',
    sub: 'For health decisions, please consult a clinician.',
    required: true,
  },
  {
    id: 'dataProcessing',
    label: 'I consent to processing my data for account, sync, and security.',
    required: true,
  },
  {
    id: 'analytics',
    label: 'Optional — allow first-party product analytics.',
    sub: 'No third-party trackers, ever.',
    required: false,
  },
];

export default function Privacy() {
  const router = useRouter();
  const theme = useTheme();
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  // Set once the consent write lands, so a retry after a later failure
  // (profile refresh, navigation) never records a second consent audit.
  const savedRef = useRef(false);
  // Saved profile: a re-tick at the same legal versions skips the consent
  // rewrite + duplicate audit. The layout gates on this in-memory profile, so
  // refresh it after the step writes before navigating.
  const profile = useSession((s) => s.profile);
  const refreshProfile = useSession((s) => s.refreshProfile);

  // Draft-backed so ticked consents survive back/forward navigation within the
  // session. Never hydrated from the server: consent is a fresh decision.
  const { consents, setConsent } = useOnboardingDraft();
  const values: Record<string, boolean> = {
    age: consents.age ?? false,
    terms: consents.terms ?? false,
    privacy: consents.privacy ?? false,
    medical: consents.medical ?? false,
    dataProcessing: consents.dataProcessing ?? false,
    analytics: consents.analytics ?? false,
  };
  const analyticsOptIn = values.analytics;

  const required = CONSENT_ROWS.filter((r) => r.required);
  const canContinue = required.every((r) => values[r.id]);
  const ackCount = Object.values(values).filter(Boolean).length;

  const stampAll = () => {
    required.forEach((row, i) => {
      setTimeout(() => setConsent(row.id, true), i * STAMP_STAGGER_MS);
    });
    // Land the optional tick together with the last required one: Continue
    // enables the moment the required rows are in, so nothing may still be
    // pending after that.
    setTimeout(() => setConsent('analytics', true), (required.length - 1) * STAMP_STAGGER_MS);
  };

  const onContinue = async () => {
    if (!canContinue) return;
    setSubmitting(true);
    setErrorMsg(null);
    try {
      await submitConsentStep({
        alreadyConsented: savedRef.current || consentsCurrent(profile),
        analyticsOptIn,
      });
      savedRef.current = true;
      await refreshProfile();
      router.push('/onboarding/usage');
    } catch (e) {
      setErrorMsg(toSafeErrorMessage(e, 'dependency_failure'));
      Alert.alert('Consent not saved', toSafeErrorMessage(e, 'dependency_failure'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen>
      {/* Step header */}
      <FadeSlideIn index={0} delay={40}>
        <Text variant="caption" color={theme.textFaint} style={{ letterSpacing: 1.5 }}>
          STEP 01 · BEFORE WE START
        </Text>
      </FadeSlideIn>

      <FadeSlideIn index={1}>
        <Text variant="display">The honest fine print.</Text>
      </FadeSlideIn>

      <FadeSlideIn index={2}>
        <Text variant="body" muted>
          Smoke Ledger is cessation support software — not medical treatment or emergency care.
        </Text>
      </FadeSlideIn>

      {/* Hairline rule */}
      <FadeSlideIn index={3}>
        <View style={{ gap: spacing.xs }}>
          <View style={{ width: 60 }}>
            <Divider strong />
          </View>
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
      </FadeSlideIn>

      {/* Consent rows */}
      <FadeSlideIn index={4}>
        <View>
          {CONSENT_ROWS.map((row, i) => {
            const checked = values[row.id];
            const isLast = i === CONSENT_ROWS.length - 1;
            return (
              <ConsentRow
                key={row.id}
                index={i + 1}
                label={row.label}
                sub={row.sub}
                required={row.required}
                value={checked}
                onChange={(v) => setConsent(row.id, v)}
                showBottomRule={!isLast}
              />
            );
          })}
        </View>
      </FadeSlideIn>

      {/* Error */}
      {errorMsg ? (
        <FadeSlideIn index={5}>
          <Text variant="small" color={theme.warnEarth}>
            {errorMsg}
          </Text>
        </FadeSlideIn>
      ) : null}

      {/* Footer */}
      <FadeSlideIn index={6}>
        <View style={{ gap: spacing.md }}>
          {/* Ack counter + stamp all */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <Text variant="caption" color={canContinue ? theme.accent : theme.textFaint}>
              {ackCount} / {CONSENT_ROWS.length} acknowledged
            </Text>
            {!canContinue ? (
              <Button
                title="Acknowledge all"
                size="sm"
                variant="ghost"
                onPress={stampAll}
              />
            ) : null}
          </View>

          <Button
            title={submitting ? 'Saving…' : 'Continue →'}
            fullWidth
            size="lg"
            loading={submitting}
            disabled={!canContinue || submitting}
            onPress={onContinue}
          />
        </View>
      </FadeSlideIn>
    </Screen>
  );
}

interface ConsentRowProps {
  index: number;
  label: string;
  sub?: string;
  required: boolean;
  value: boolean;
  onChange: (value: boolean) => void;
  showBottomRule: boolean;
}

function ConsentRow({ index, label, sub, required, value, onChange, showBottomRule }: ConsentRowProps) {
  const theme = useTheme();
  return (
    <View>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'flex-start',
          gap: spacing.md,
          paddingVertical: spacing.md,
        }}
      >
        {/* Row number */}
        <Text
          variant="caption"
          color={value ? theme.accent : theme.textFaint}
          style={{ minWidth: 22, letterSpacing: 0.5, marginTop: 2 }}
        >
          {String(index).padStart(2, '0')}
        </Text>

        {/* Label + sub */}
        <View style={{ flex: 1, gap: spacing.xs }}>
          <Text variant="small" color={theme.text}>
            {label}
          </Text>
          {sub ? (
            <Text variant="caption" color={theme.textFaint}>
              {sub}
            </Text>
          ) : null}
          {!required ? (
            <Text
              variant="caption"
              color={theme.textFaint}
              style={{ fontStyle: 'italic' }}
            >
              optional
            </Text>
          ) : null}
        </View>

        {/* Switch */}
        <Switch
          value={value}
          onValueChange={onChange}
          trackColor={{ false: theme.border, true: theme.accent }}
          thumbColor={value ? theme.bgElevated : theme.textFaint}
        />
      </View>
      {showBottomRule ? <Divider /> : null}
    </View>
  );
}

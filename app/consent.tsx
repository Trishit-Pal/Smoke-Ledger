import React, { useState } from 'react';
import { ActivityIndicator, Alert, Linking, View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { Divider } from '@/components/ui/Divider';
import { spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { acceptChangedTerms } from '@/services/onboarding';
import { useAuth } from '@/store/auth';
import { useSession } from '@/store/session';
import { isOnboarded } from '@/lib/compliance';
import { LEGAL_URLS } from '@/lib/legal';
import { toSafeErrorMessage } from '@/lib/errors';
import { consentGateRedirect, resumeOnboardingRoute } from '@/lib/onboardingSteps';
import { HEALTH_CONSENT_LABEL, HEALTH_CONSENT_SUB, HEALTH_DECLINE_LABEL, HEALTH_DECLINE_NOTE_EXISTING } from '@/lib/healthConsent';
import {
  RECONSENT_ACCEPT_LABEL,
  RECONSENT_CAPTION,
  RECONSENT_CHANGES,
  RECONSENT_LEDE,
  RECONSENT_NOT_NOW_LABEL,
  RECONSENT_NOT_NOW_NOTE,
  RECONSENT_TITLE,
} from '@/lib/reconsentCopy';
import { ConsentRow } from './onboarding/privacy';

// Same rows as onboarding, in the same wording. Age and data-processing were
// given once and do not change with the documents, so they are not asked again.
const VERSIONED_ROWS = [
  { id: 'terms', label: 'I agree to the Terms of Service.' },
  { id: 'privacy', label: 'I acknowledge the Privacy Policy.' },
  {
    id: 'medical',
    label: 'I understand this app does not provide medical advice.',
    sub: 'For health decisions, please consult a clinician.',
  },
] as const;

export default function Consent() {
  const router = useRouter();
  const theme = useTheme();
  const session = useAuth((s) => s.session);
  const initialized = useAuth((s) => s.initialized);
  const profile = useSession((s) => s.profile);
  const booted = useSession((s) => s.booted);
  const refreshProfile = useSession((s) => s.refreshProfile);

  const [ticked, setTicked] = useState<Record<string, boolean>>({});
  const [health, setHealth] = useState(false);
  const [healthDeclined, setHealthDeclined] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!initialized || !booted) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.bg, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color={theme.accent} />
      </View>
    );
  }
  if (!session) return <Redirect href="/login" />;
  // Still onboarding: the wizard asks, not this screen.
  if (!isOnboarded(profile)) return <Redirect href={resumeOnboardingRoute(profile)} />;
  // Already current (including right after accepting): go home.
  const away = consentGateRedirect('/consent', profile, true, '/(tabs)');
  if (away) return <Redirect href={away} />;

  const needsHealthConsent = !profile?.healthDataConsentAt;
  const changes = RECONSENT_CHANGES.filter((c) => needsHealthConsent || !c.onlyWithoutHealthConsent);
  const canAccept = VERSIONED_ROWS.every((r) => ticked[r.id]) && (!needsHealthConsent || health);

  const setHealthConsent = (given: boolean) => {
    setHealth(given);
    setHealthDeclined(!given);
  };

  const onAccept = async () => {
    if (!canAccept) return;
    setSubmitting(true);
    setErrorMsg(null);
    try {
      await acceptChangedTerms({ needsHealthConsent, healthDataConsent: health });
      await refreshProfile();
      router.replace('/(tabs)');
    } catch (e) {
      const message = toSafeErrorMessage(e, 'dependency_failure');
      setErrorMsg(message);
      Alert.alert('Consent not saved', message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen>
      <Text variant="caption" color={theme.textFaint} style={{ letterSpacing: 1.5 }}>
        {RECONSENT_CAPTION.toUpperCase()}
      </Text>
      <Text variant="display">{RECONSENT_TITLE}</Text>
      <Text variant="body" muted>
        {RECONSENT_LEDE}
      </Text>

      <View style={{ width: 60 }}>
        <Divider strong />
      </View>
      <Text variant="caption" color={theme.textFaint} style={{ letterSpacing: 1.5 }}>
        WHAT CHANGED
      </Text>
      <View>
        {changes.map((c, i) => (
          <View key={c.title}>
            {i > 0 ? <Divider /> : null}
            <View style={{ paddingVertical: spacing.md, gap: spacing.xs }}>
              <Text variant="small" color={theme.text}>
                {c.title}
              </Text>
              <Text variant="caption" color={theme.textFaint}>
                {c.body}
              </Text>
            </View>
          </View>
        ))}
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

      <View>
        {VERSIONED_ROWS.map((row, i) => (
          <ConsentRow
            key={row.id}
            index={i + 1}
            label={row.label}
            sub={'sub' in row ? row.sub : undefined}
            required
            value={ticked[row.id] ?? false}
            onChange={(v) => setTicked((prev) => ({ ...prev, [row.id]: v }))}
            showBottomRule={needsHealthConsent || i < VERSIONED_ROWS.length - 1}
          />
        ))}
        {needsHealthConsent ? (
          <ConsentRow
            index={VERSIONED_ROWS.length + 1}
            label={HEALTH_CONSENT_LABEL}
            sub={HEALTH_CONSENT_SUB}
            required
            value={health}
            onChange={setHealthConsent}
            showBottomRule={false}
          />
        ) : null}
      </View>

      {needsHealthConsent ? (
        <View style={{ gap: spacing.xs }}>
          <Button title={HEALTH_DECLINE_LABEL} size="md" variant="ghost" onPress={() => setHealthConsent(false)} />
          {healthDeclined ? (
            <Text variant="small" muted accessibilityLiveRegion="polite">
              {HEALTH_DECLINE_NOTE_EXISTING}
            </Text>
          ) : null}
        </View>
      ) : null}

      {errorMsg ? (
        <Text variant="small" color={theme.warnEarth}>
          {errorMsg}
        </Text>
      ) : null}

      <View style={{ gap: spacing.md }}>
        <Button
          title={submitting ? 'Saving…' : `${RECONSENT_ACCEPT_LABEL} →`}
          fullWidth
          size="lg"
          loading={submitting}
          disabled={!canAccept || submitting}
          onPress={onAccept}
        />
        {/* Same size as Accept: declining is as easy as accepting. Settings holds export and withdraw. */}
        <Button
          title={RECONSENT_NOT_NOW_LABEL}
          fullWidth
          size="lg"
          variant="secondary"
          onPress={() => router.push('/(tabs)/settings')}
        />
        <Text variant="small" muted>
          {RECONSENT_NOT_NOW_NOTE}
        </Text>
      </View>
    </Screen>
  );
}

import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Linking, View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { Divider } from '@/components/ui/Divider';
import { AgreementRow, ChatChoiceRow, HealthConsentRow } from '@/components/consent/ConsentRows';
import { spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { acceptChangedTerms } from '@/services/onboarding';
import { shouldAskChat } from '@/services/chatConsentAsk';
import { setSetting } from '@/db/repositories/settings';
import { recordAuditEvent } from '@/services/audit';
import { useAuth } from '@/store/auth';
import { useSession } from '@/store/session';
import { isOnboarded } from '@/lib/compliance';
import { LEGAL_URLS, LEGAL_VERSIONS } from '@/lib/legal';
import { canContinueConsent, type ChatAnswer } from '@/lib/consentForm';
import { toSafeErrorMessage } from '@/lib/errors';
import { consentGateRedirect, resumeOnboardingRoute, termsChanged } from '@/lib/onboardingSteps';
import { LEDGER_CHAT_NOTICE_VERSION, chatOptInValue } from '@/domain/ledgerChat/notice';
import {
  RECONSENT_ACCEPT_LABEL,
  RECONSENT_CHANGES,
  RECONSENT_NOT_NOW_LABEL,
  RECONSENT_NOT_NOW_NOTE,
  reconsentHeading,
} from '@/lib/reconsentCopy';

export default function Consent() {
  const router = useRouter();
  const theme = useTheme();
  const session = useAuth((s) => s.session);
  const initialized = useAuth((s) => s.initialized);
  const profile = useSession((s) => s.profile);
  const booted = useSession((s) => s.booted);
  const refreshProfile = useSession((s) => s.refreshProfile);

  const [agreed, setAgreed] = useState(false);
  const [health, setHealth] = useState(false);
  // No default: null until the reader picks Yes or No.
  const [chatAnswer, setChatAnswer] = useState<ChatAnswer>(null);
  // null while the read is in flight; Accept waits so a reader is never let past an unasked question.
  const [chatAsk, setChatAsk] = useState<boolean | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  // Set once the terms are accepted, so a retry after a failed chat write never
  // records a second consent audit.
  const savedRef = useRef(false);

  useEffect(() => {
    let mounted = true;
    void shouldAskChat().then((ask) => {
      if (mounted) setChatAsk(ask);
    });
    return () => {
      mounted = false;
    };
  }, []);

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
  // Tick 1 is always asked (Terms, Privacy and the medical notice are versioned); it also
  // covers age and data processing, and the service stamps only what is missing.
  const needsAgeConfirm = !profile?.ageConfirmedAt;
  const needsDataProcessing = !profile?.dataProcessingConsentAt;
  const changed = termsChanged(profile);
  const heading = reconsentHeading(changed);
  const changes = RECONSENT_CHANGES.filter((c) => needsHealthConsent || !c.onlyWithoutHealthConsent);
  const canAccept =
    chatAsk !== null &&
    canContinueConsent({
      agreed,
      needsHealth: needsHealthConsent,
      health,
      chatShown: chatAsk === true,
      chatAnswer,
    });

  const onAccept = async () => {
    if (!canAccept) return;
    setSubmitting(true);
    setErrorMsg(null);
    try {
      if (!savedRef.current) {
        await acceptChangedTerms({
          needsHealthConsent,
          healthDataConsent: health,
          needsAgeConfirm,
          ageConfirmed: true,
          needsDataProcessing,
          dataProcessingConsent: true,
        });
        savedRef.current = true;
      }
      if (chatAnswer !== null) {
        await setSetting('consent.ledgerChatOptIn', chatOptInValue(chatAnswer));
        // Best-effort and not awaited: a slow or failing audit edge never blocks the next step.
        void recordAuditEvent('ledger_chat_consent_toggled', 'privacy', {
          enabled: chatAnswer,
          privacyVersion: LEGAL_VERSIONS.privacy,
          noticeVersion: LEDGER_CHAT_NOTICE_VERSION,
        }).catch(() => undefined);
      }
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
        {heading.caption.toUpperCase()}
      </Text>
      <Text variant="display">{heading.title}</Text>
      <Text variant="body" muted>
        {heading.lede}
      </Text>

      <View style={{ width: 60 }}>
        <Divider strong />
      </View>
      {/* Nothing changed for a reader who only lacks a confirmation; the agreement
          row below still links to both documents. */}
      {changed ? (
        <>
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
        </>
      ) : null}

      <View>
        <AgreementRow index={1} value={agreed} onChange={setAgreed} showBottomRule={needsHealthConsent || !!chatAsk} />
        {needsHealthConsent ? (
          <HealthConsentRow index={2} value={health} onChange={setHealth} showBottomRule={!!chatAsk} />
        ) : null}
        {chatAsk ? (
          <ChatChoiceRow answer={chatAnswer} onAnswer={setChatAnswer} index={needsHealthConsent ? 3 : 2} />
        ) : null}
      </View>

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

import React, { useEffect, useRef, useState } from 'react';
import { View, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { Divider } from '@/components/ui/Divider';
import { FadeSlideIn } from '@/components/anim/FadeSlideIn';
import { AgreementRow, ChatChoiceRow, ConsentRow, HealthConsentRow } from '@/components/consent/ConsentRows';
import { spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { consentsCurrent, submitConsentStep } from '@/services/onboarding';
import { shouldAskChat } from '@/services/chatConsentAsk';
import { setSetting } from '@/db/repositories/settings';
import { recordAuditEvent } from '@/services/audit';
import { useOnboardingDraft } from '@/store/onboardingDraft';
import { useSession } from '@/store/session';
import { LEGAL_VERSIONS } from '@/lib/legal';
import { canContinueConsent, type ChatAnswer } from '@/lib/consentForm';
import { toSafeErrorMessage } from '@/lib/errors';
import { LEDGER_CHAT_NOTICE_VERSION, chatOptInValue } from '@/domain/ledgerChat/notice';

// "Acknowledge all" ticks the agreement only. The health-data consent (Art 9), the
// optional analytics switch and the Ask the ledger choice are separate decisions.

export default function Privacy() {
  const router = useRouter();
  const theme = useTheme();
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  // null while the read is in flight; Continue waits so a reader is never let past an unasked question.
  const [chatAsk, setChatAsk] = useState<boolean | null>(null);
  // Set once the consent write lands, so a retry after a later failure
  // (chat answer, profile refresh, navigation) never records a second consent audit.
  const savedRef = useRef(false);
  // Saved profile: a re-tick at the same legal versions skips the consent
  // rewrite + duplicate audit. The layout gates on this in-memory profile, so
  // refresh it after the step writes before navigating.
  const profile = useSession((s) => s.profile);
  const refreshProfile = useSession((s) => s.refreshProfile);

  useEffect(() => {
    let mounted = true;
    void shouldAskChat().then((ask) => {
      if (mounted) setChatAsk(ask);
    });
    return () => {
      mounted = false;
    };
  }, []);

  // Draft-backed so ticked consents survive back/forward navigation within the
  // session. Never hydrated from the server: consent is a fresh decision.
  const { consents, setConsent } = useOnboardingDraft();
  const agreed = consents.agreement ?? false;
  const healthDataConsent = consents.health ?? false;
  const analyticsOptIn = consents.analytics ?? false;
  // No default: null until the reader picks Yes or No.
  const chatAnswer: ChatAnswer = chatAsk ? (consents.chat ?? null) : null;

  const canContinue =
    chatAsk !== null &&
    canContinueConsent({
      agreed,
      needsHealth: true,
      health: healthDataConsent,
      chatShown: chatAsk === true,
      chatAnswer,
    });
  // The counter covers the required rows that are shown; the analytics switch is optional.
  const requiredCount = chatAsk ? 3 : 2;
  const ackCount = [agreed, healthDataConsent, chatAsk && chatAnswer !== null].filter(Boolean).length;

  const stampAll = () => setConsent('agreement', true);

  const onContinue = async () => {
    if (!canContinue) return;
    setSubmitting(true);
    setErrorMsg(null);
    try {
      // A retry after the consent landed is "already consented": no second consent audit.
      await submitConsentStep({
        alreadyConsented: savedRef.current || consentsCurrent(profile),
        analyticsOptIn,
        healthDataConsent,
      });
      savedRef.current = true;
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
        <View style={{ width: 60 }}>
          <Divider strong />
        </View>
      </FadeSlideIn>

      {/* Consent rows: the agreement, the health consent, the optional analytics switch, the chat choice. */}
      <FadeSlideIn index={4}>
        <View>
          <AgreementRow index={1} value={agreed} onChange={(v) => setConsent('agreement', v)} showBottomRule />
          <HealthConsentRow index={2} value={healthDataConsent} onChange={(v) => setConsent('health', v)} showBottomRule />
          <ConsentRow
            index={3}
            label="Optional — allow first-party product analytics."
            sub="No third-party trackers, ever."
            required={false}
            value={analyticsOptIn}
            onChange={(v) => setConsent('analytics', v)}
            showBottomRule={!!chatAsk}
          />
          {chatAsk ? (
            <ChatChoiceRow answer={chatAnswer} onAnswer={(turnOn) => setConsent('chat', turnOn)} index={4} />
          ) : null}
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
              {ackCount} / {requiredCount} acknowledged
            </Text>
            {!agreed ? <Button title="Acknowledge all" size="sm" variant="ghost" onPress={stampAll} /> : null}
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

'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { ConfettiBurst } from '@web/components/character/ConfettiBurst';
import { submitConsentStep } from '@/services/onboarding';
import { setSetting } from '@/db/repositories/settings';
import { recordAuditEvent } from '@/services/audit';
import { LEGAL_VERSIONS } from '@/lib/legal';
import { canContinueConsent, type ChatAnswer } from '@/lib/consentForm';
import { useOnboardingDraft } from '@/store/onboardingDraft';
import { toSafeErrorMessage } from '@/lib/errors';
import { LEDGER_CHAT_NOTICE_VERSION, chatOptInValue } from '@web/components/chat/notice';
import {
  AgreementRow,
  ChatChoiceRow,
  HealthConsentRow,
  TickRow,
} from '@web/components/onboarding/ConsentRows';

// "Stamp all" ticks the agreement only. The health-data consent (Art 9), the optional
// analytics tick and the Ask the ledger choice are separate decisions the reader makes.

export interface OnboardingPrivacyClientProps {
  /** Server-computed: the saved consents are already at the current legal versions. */
  alreadyConsented: boolean;
  /** Server-computed: the chat is enabled and this reader has never answered the Yes / No. */
  chatAsk: boolean;
}

export function OnboardingPrivacyClient({ alreadyConsented, chatAsk }: OnboardingPrivacyClientProps) {
  const router = useRouter();
  // Draft-backed so ticked consents survive back/forward navigation within the
  // session. Never hydrated from the server: consent is a fresh decision.
  const { consents, setConsent } = useOnboardingDraft();
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [welcome, setWelcome] = React.useState(false);
  // Set once the consent write lands, so a retry after a later failure
  // (navigation) never records a second consent audit.
  const savedRef = React.useRef(false);

  // Fire the account-created celebration once when arriving from a fresh signup
  // confirmation (?welcome=1, set by the auth callback). Read from the URL
  // directly (no useSearchParams Suspense requirement) and strip the param so a
  // refresh or back-navigation doesn't replay it.
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    if (new URLSearchParams(window.location.search).get('welcome') === '1') {
      setWelcome(true);
      router.replace('/onboarding/privacy');
    }
  }, [router]);

  const agreed = consents.agreement ?? false;
  const healthDataConsent = consents.health ?? false;
  const analyticsOptIn = consents.analytics ?? false;
  // No default: null until the reader picks Yes or No. Draft-backed like the ticks.
  const chatAnswer: ChatAnswer = chatAsk ? (consents.chat ?? null) : null;

  const canContinue = canContinueConsent({
    agreed,
    needsHealth: true,
    health: healthDataConsent,
    chatShown: chatAsk,
    chatAnswer,
  });
  // The counter covers the required rows that are shown; the analytics tick is optional.
  const requiredCount = chatAsk ? 3 : 2;
  const ackCount = [agreed, healthDataConsent, chatAsk && chatAnswer !== null].filter(Boolean).length;

  const stampAll = () => setConsent('agreement', true);

  const onContinue = async () => {
    if (!canContinue) return;
    setSubmitting(true);
    setError(null);
    try {
      await submitConsentStep({
        alreadyConsented: savedRef.current || alreadyConsented,
        analyticsOptIn,
        healthDataConsent,
      });
      savedRef.current = true;
      if (chatAnswer !== null) {
        // Consent is already saved above, so a failure here retries safely (alreadyConsented).
        await setSetting('consent.ledgerChatOptIn', chatOptInValue(chatAnswer));
        // Best-effort and not awaited: a slow or failing audit edge never blocks the next step.
        void recordAuditEvent('ledger_chat_consent_toggled', 'privacy', {
          enabled: chatAnswer,
          privacyVersion: LEGAL_VERSIONS.privacy,
          noticeVersion: LEDGER_CHAT_NOTICE_VERSION,
        }).catch(() => undefined);
      }
      router.push('/onboarding/usage');
    } catch (e) {
      setError(toSafeErrorMessage(e, 'dependency_failure'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="editorial-stage"
      style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 620 }}
    >
      {welcome ? <ConfettiBurst active /> : null}
      <header style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <span className="editorial-caption">Step 01 · Before we start</span>
        <h2
          className="editorial-headline"
          style={{ fontSize: 'clamp(32px, 4vw, 44px)', margin: 0 }}
        >
          The honest fine print.
        </h2>
        <p style={{ fontSize: 14, color: 'var(--text-muted)', margin: 0, lineHeight: 1.55 }}>
          Smoke Ledger is cessation support software — not medical treatment or emergency care.
        </p>
      </header>

      <div
        className="rule-draw"
        style={{ borderTop: '1px solid var(--rule-strong)', width: 60 }}
      />

      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <AgreementRow checked={agreed} onChange={(v) => setConsent('agreement', v)} number="01" />

        <HealthConsentRow
          checked={healthDataConsent}
          onChange={(given) => setConsent('health', given)}
          number="02"
        />

        <TickRow
          checked={analyticsOptIn}
          onChange={(v) => setConsent('analytics', v)}
          number="03"
          rotate={-4}
          last={!chatAsk}
          label={
            <>
              <em
                style={{
                  color: 'var(--text-muted)',
                  fontStyle: 'italic',
                  fontFamily: 'var(--font-display)',
                }}
              >
                Optional
              </em>{' '}
              — allow first-party product analytics to help improve reliability.
            </>
          }
          sub="No third-party trackers, ever."
        />

        {chatAsk ? (
          <ChatChoiceRow
            answer={chatAnswer}
            onAnswer={(turnOn) => setConsent('chat', turnOn)}
            number="04"
          />
        ) : null}
      </div>

      {error ? (
        <p
          role="alert"
          style={{
            fontSize: 13,
            color: 'var(--warn-earth-ink)',
            margin: 0,
          }}
        >
          {error}
        </p>
      ) : null}

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 16,
          flexWrap: 'wrap',
        }}
      >
        <button
          type="button"
          onClick={() => router.push('/onboarding')}
          className="focus-ring"
          style={{
            height: 44,
            padding: '0 16px',
            border: '1px solid var(--rule)',
            borderRadius: 10,
            background: 'transparent',
            color: 'var(--text)',
            fontFamily: 'var(--font-sans)',
            fontWeight: 500,
            fontSize: 14,
            cursor: 'pointer',
          }}
        >
          ← Back
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={stampAll}
            disabled={agreed}
            className="focus-ring hit-target"
            style={{
              background: 'transparent',
              border: 'none',
              cursor: agreed ? 'default' : 'pointer',
              fontSize: 12,
              fontFamily: 'var(--font-display)',
              fontStyle: 'italic',
              color: agreed ? 'var(--text-faint)' : 'var(--accent-ink)',
              textDecoration: agreed ? 'none' : 'underline',
              textUnderlineOffset: 4,
              padding: 0,
              opacity: agreed ? 0.5 : 1,
              transition: 'all 200ms ease',
            }}
            aria-label="Stamp all consents"
          >
            {agreed ? 'stamped' : 'stamp all'}
          </button>
          <span
            className="editorial-caption-tight nums-tabular"
            style={{ color: canContinue ? 'var(--accent-ink)' : 'var(--text-faint)' }}
          >
            {ackCount} / {requiredCount} acknowledged
          </span>
          <button
            type="button"
            onClick={onContinue}
            disabled={!canContinue || submitting}
            className="focus-ring"
            style={{
              height: 44,
              padding: '0 20px',
              border: 'none',
              borderRadius: 10,
              background: 'var(--accent-ink)',
              color: 'var(--on-accent)',
              fontFamily: 'var(--font-sans)',
              fontWeight: 600,
              fontSize: 14,
              cursor: !canContinue || submitting ? 'not-allowed' : 'pointer',
              opacity: !canContinue || submitting ? 0.45 : 1,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            {submitting ? (
              <span
                aria-hidden
                className="animate-spin"
                style={{
                  width: 14,
                  height: 14,
                  border: '2px solid rgba(255,255,255,0.4)',
                  borderTopColor: '#ffffff',
                  borderRadius: '50%',
                }}
              />
            ) : null}
            Continue →
          </button>
        </div>
      </div>
    </div>
  );
}

export default OnboardingPrivacyClient;

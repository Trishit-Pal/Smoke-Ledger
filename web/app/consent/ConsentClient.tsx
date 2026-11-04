'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { acceptChangedTerms } from '@/services/onboarding';
import { setSetting } from '@/db/repositories/settings';
import { recordAuditEvent } from '@/services/audit';
import { LEGAL_VERSIONS } from '@/lib/legal';
import { canContinueConsent, type ChatAnswer } from '@/lib/consentForm';
import { toSafeErrorMessage } from '@/lib/errors';
import {
  RECONSENT_ACCEPT_LABEL,
  RECONSENT_CHANGES,
  RECONSENT_NOT_NOW_LABEL,
  RECONSENT_NOT_NOW_NOTE,
  reconsentHeading,
} from '@/lib/reconsentCopy';
import { LEDGER_CHAT_NOTICE_VERSION, chatOptInValue } from '@web/components/chat/notice';
import {
  AgreementRow,
  ChatChoiceRow,
  HealthConsentRow,
} from '@web/components/onboarding/ConsentRows';
import { InlineRule, SectionLabel } from '@web/components/visual';

const linkStyle: React.CSSProperties = {
  color: 'var(--accent-ink)',
  textDecoration: 'underline',
  textUnderlineOffset: 3,
};

// Accept and "Not now" share one size so declining is as easy as accepting.
const buttonBase: React.CSSProperties = {
  height: 44,
  padding: '0 20px',
  borderRadius: 10,
  fontFamily: 'var(--font-sans)',
  fontSize: 14,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  textDecoration: 'none',
};

export interface ConsentClientProps {
  /** The documents changed since this reader accepted them (`termsChanged`): show what changed. */
  termsChanged: boolean;
  /** The profile has no health-data consent yet: show its unticked row. */
  needsHealthConsent: boolean;
  /** The profile has no age confirmation on record: show its row. */
  needsAgeConfirm: boolean;
  /** The profile has no data-processing consent on record: show its row. */
  needsDataProcessing: boolean;
  /** Server-computed: the chat is enabled and this reader has never answered the Yes / No. */
  chatAsk: boolean;
}

export function ConsentClient({
  termsChanged,
  needsHealthConsent,
  needsAgeConfirm,
  needsDataProcessing,
  chatAsk,
}: ConsentClientProps) {
  const router = useRouter();
  const [agreed, setAgreed] = React.useState(false);
  const [health, setHealth] = React.useState(false);
  // No default: null until the reader picks Yes or No.
  const [chatAnswer, setChatAnswer] = React.useState<ChatAnswer>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  // Set once the terms are accepted, so a retry after a failed chat write never
  // records a second consent audit.
  const savedRef = React.useRef(false);

  const heading = reconsentHeading(termsChanged);
  const changes = RECONSENT_CHANGES.filter((c) => needsHealthConsent || !c.onlyWithoutHealthConsent);
  // Terms, Privacy and the medical notice are versioned, so tick 1 is always asked.
  const canAccept = canContinueConsent({
    agreed,
    needsHealth: needsHealthConsent,
    health,
    chatShown: chatAsk,
    chatAnswer,
  });

  const onAccept = async () => {
    if (!canAccept) return;
    setSubmitting(true);
    setError(null);
    try {
      if (!savedRef.current) {
        // Tick 1 covers age and data processing; the service stamps only what is missing.
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
      router.replace('/dashboard');
      router.refresh();
    } catch (e) {
      setError(toSafeErrorMessage(e, 'dependency_failure'));
      setSubmitting(false);
    }
  };

  return (
    <main
      className="editorial-stage"
      style={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        gap: 24,
        maxWidth: 620,
        margin: '0 auto',
        padding: 'clamp(28px, 4vw, 56px) clamp(20px, 5vw, 32px)',
        background: 'var(--bg)',
        color: 'var(--text)',
        minHeight: '100dvh',
      }}
    >
      <header style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <span className="editorial-caption">{heading.caption}</span>
        <h1 className="editorial-headline" style={{ fontSize: 'clamp(32px, 4vw, 44px)', margin: 0 }}>
          {heading.title}
        </h1>
        <p style={{ fontSize: 14, color: 'var(--text-muted)', margin: 0, lineHeight: 1.55 }}>
          {heading.lede}
        </p>
      </header>

      {/* Nothing changed for a reader who only lacks a confirmation; the Terms and
          Privacy rows below still link to both documents. */}
      {termsChanged ? (
        <section aria-labelledby="consent-changed">
          <SectionLabel id="consent-changed" rule="strong">
            What changed
          </SectionLabel>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {changes.map((c, i) => (
              <li key={c.title}>
                {i > 0 ? <InlineRule /> : null}
                <div style={{ padding: '14px 0', display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={{ fontSize: 14, color: 'var(--text)', lineHeight: 1.5 }}>{c.title}</span>
                  <span style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.55 }}>{c.body}</span>
                </div>
              </li>
            ))}
          </ul>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '4px 0 0' }}>
            Read them in full:{' '}
            <Link href="/terms" style={linkStyle}>
              Terms of Service
            </Link>
            {' · '}
            <Link href="/privacy" style={linkStyle}>
              Privacy Policy
            </Link>
          </p>
        </section>
      ) : null}

      <section aria-labelledby="consent-accept" style={{ display: 'flex', flexDirection: 'column' }}>
        <SectionLabel id="consent-accept" rule="strong">
          Your answer
        </SectionLabel>
        <AgreementRow checked={agreed} onChange={setAgreed} number="01" />
        {needsHealthConsent ? (
          <HealthConsentRow checked={health} onChange={setHealth} number="02" />
        ) : null}
        {chatAsk ? (
          <ChatChoiceRow
            answer={chatAnswer}
            onAnswer={setChatAnswer}
            number={needsHealthConsent ? '03' : '02'}
          />
        ) : null}
      </section>

      {error ? (
        <p role="alert" style={{ fontSize: 13, color: 'var(--warn-earth-ink)', margin: 0 }}>
          {error}
        </p>
      ) : null}

      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 16 }}>
        <button
          type="button"
          onClick={onAccept}
          disabled={!canAccept || submitting}
          className="focus-ring"
          style={{
            ...buttonBase,
            border: 'none',
            background: 'var(--accent-ink)',
            color: 'var(--on-accent)',
            fontWeight: 600,
            cursor: !canAccept || submitting ? 'not-allowed' : 'pointer',
            opacity: !canAccept || submitting ? 0.45 : 1,
          }}
        >
          {submitting ? 'Saving…' : `${RECONSENT_ACCEPT_LABEL} →`}
        </button>
        <Link
          href="/settings"
          className="focus-ring"
          style={{
            ...buttonBase,
            border: '1px solid var(--rule)',
            background: 'transparent',
            color: 'var(--text)',
            fontWeight: 500,
          }}
        >
          {RECONSENT_NOT_NOW_LABEL}
        </Link>
      </div>
      <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0, lineHeight: 1.55 }}>
        {RECONSENT_NOT_NOW_NOTE}
      </p>
    </main>
  );
}

export default ConsentClient;

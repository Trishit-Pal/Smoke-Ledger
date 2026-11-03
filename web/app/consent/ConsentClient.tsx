'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { acceptChangedTerms } from '@/services/onboarding';
import { toSafeErrorMessage } from '@/lib/errors';
import {
  RECONSENT_ACCEPT_LABEL,
  RECONSENT_CAPTION,
  RECONSENT_CHANGES,
  RECONSENT_LEDE,
  RECONSENT_NOT_NOW_LABEL,
  RECONSENT_NOT_NOW_NOTE,
  RECONSENT_TITLE,
} from '@/lib/reconsentCopy';
import {
  ConsentCheckRow,
  HealthConsentRow,
  REQUIRED_ROWS,
  type RequiredKey,
} from '@web/components/onboarding/ConsentRows';
import { InlineRule, SectionLabel } from '@web/components/visual';

// The rows tied to a legal version. Age and data-processing were given once and
// do not change with the documents, so they are not asked again.
const VERSIONED_ROWS = REQUIRED_ROWS.filter((r) => ['terms', 'privacy', 'medical'].includes(r.id));

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
  /** The profile has no health-data consent yet: show its unticked row. */
  needsHealthConsent: boolean;
}

export function ConsentClient({ needsHealthConsent }: ConsentClientProps) {
  const router = useRouter();
  const [ticked, setTicked] = React.useState<Partial<Record<RequiredKey, boolean>>>({});
  const [health, setHealth] = React.useState(false);
  const [healthDeclined, setHealthDeclined] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const changes = RECONSENT_CHANGES.filter((c) => needsHealthConsent || !c.onlyWithoutHealthConsent);
  const canAccept = VERSIONED_ROWS.every((r) => ticked[r.id]) && (!needsHealthConsent || health);

  const setHealthConsent = (given: boolean) => {
    setHealth(given);
    setHealthDeclined(!given);
  };

  const onAccept = async () => {
    if (!canAccept) return;
    setSubmitting(true);
    setError(null);
    try {
      await acceptChangedTerms({ needsHealthConsent, healthDataConsent: health });
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
        <span className="editorial-caption">{RECONSENT_CAPTION}</span>
        <h1 className="editorial-headline" style={{ fontSize: 'clamp(32px, 4vw, 44px)', margin: 0 }}>
          {RECONSENT_TITLE}
        </h1>
        <p style={{ fontSize: 14, color: 'var(--text-muted)', margin: 0, lineHeight: 1.55 }}>
          {RECONSENT_LEDE}
        </p>
      </header>

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

      <section aria-labelledby="consent-accept" style={{ display: 'flex', flexDirection: 'column' }}>
        <SectionLabel id="consent-accept" rule="strong">
          Your answer
        </SectionLabel>
        {VERSIONED_ROWS.map((row, i) => (
          <ConsentCheckRow
            key={row.id}
            row={row}
            index={i}
            checked={ticked[row.id] ?? false}
            onChange={(v) => setTicked((prev) => ({ ...prev, [row.id]: v }))}
          />
        ))}
        {needsHealthConsent ? (
          <HealthConsentRow
            checked={health}
            declined={healthDeclined}
            onChange={setHealthConsent}
            number={String(VERSIONED_ROWS.length + 1).padStart(2, '0')}
            existingLedger
          />
        ) : null}
      </section>

      {error ? (
        <p role="alert" style={{ fontSize: 13, color: 'var(--warn-earth)', margin: 0 }}>
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

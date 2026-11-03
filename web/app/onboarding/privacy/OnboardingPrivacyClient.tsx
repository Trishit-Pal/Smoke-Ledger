'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Stamp } from '@web/components/onboarding/Stamp';
import { ConfettiBurst } from '@web/components/character/ConfettiBurst';
import { submitConsentStep } from '@/services/onboarding';
import { useOnboardingDraft } from '@/store/onboardingDraft';
import { toSafeErrorMessage } from '@/lib/errors';
import {
  ConsentCheckRow,
  HealthConsentRow,
  REQUIRED_ROWS,
  type RequiredKey,
} from '@web/components/onboarding/ConsentRows';

// "Stamp all" covers only the five acknowledgements above. The health-data consent
// (Art 9) and the optional analytics tick are separate decisions the reader makes.
// Stagger between stamps when "stamp all" is pressed (a visual beat, not a save).
const STAMP_STAGGER_MS = 130;

export interface OnboardingPrivacyClientProps {
  /** Server-computed: the saved consents are already at the current legal versions. */
  alreadyConsented: boolean;
}

export function OnboardingPrivacyClient({ alreadyConsented }: OnboardingPrivacyClientProps) {
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

  const values: Record<RequiredKey | 'health' | 'analytics', boolean> = {
    age: consents.age ?? false,
    terms: consents.terms ?? false,
    privacy: consents.privacy ?? false,
    medical: consents.medical ?? false,
    dataProcessing: consents.dataProcessing ?? false,
    health: consents.health ?? false,
    analytics: consents.analytics ?? false,
  };
  const analyticsOptIn = values.analytics;
  const healthDataConsent = values.health;
  const healthDeclined = consents.healthDeclined ?? false;

  const acknowledged = REQUIRED_ROWS.every((row) => values[row.id]);
  const canContinue = acknowledged && healthDataConsent;
  const ackCount = Object.values(values).filter(Boolean).length;
  const totalRows = REQUIRED_ROWS.length + 2;

  const stampAll = () => {
    REQUIRED_ROWS.forEach((row, i) => {
      setTimeout(() => setConsent(row.id, true), i * STAMP_STAGGER_MS);
    });
  };

  const setHealthConsent = (given: boolean) => {
    setConsent('health', given);
    setConsent('healthDeclined', !given);
  };

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
        {REQUIRED_ROWS.map((row, i) => (
          <ConsentCheckRow
            key={row.id}
            row={row}
            index={i}
            checked={values[row.id]}
            onChange={(v) => setConsent(row.id, v)}
          />
        ))}

        <HealthConsentRow
          checked={healthDataConsent}
          declined={healthDeclined}
          onChange={setHealthConsent}
          number="06"
        />

        <label
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 14,
            padding: '14px 0',
            cursor: 'pointer',
            opacity: 0.95,
          }}
        >
          <input
            type="checkbox"
            className="ed-checkbox focus-ring"
            checked={analyticsOptIn}
            onChange={(e) => setConsent('analytics', e.target.checked)}
            style={{ marginTop: 2 }}
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1 }}>
            <span style={{ fontSize: 14, color: 'var(--text)', lineHeight: 1.5 }}>
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
            </span>
            <span style={{ fontSize: 12, color: 'var(--text-faint)', lineHeight: 1.5 }}>
              No third-party trackers, ever.
            </span>
          </div>
          <div style={{ minWidth: 96, display: 'flex', justifyContent: 'flex-end' }}>
            <Stamp show={analyticsOptIn} rotate={-4}>
              Acknowledged
            </Stamp>
          </div>
          <span
            className="editorial-caption-tight nums-tabular"
            style={{
              color: analyticsOptIn ? 'var(--accent-ink)' : 'var(--text-faint)',
              marginTop: 4,
              minWidth: 22,
              textAlign: 'right',
            }}
          >
            07
          </span>
        </label>
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
            disabled={acknowledged}
            className="focus-ring hit-target"
            style={{
              background: 'transparent',
              border: 'none',
              cursor: acknowledged ? 'default' : 'pointer',
              fontSize: 12,
              fontFamily: 'var(--font-display)',
              fontStyle: 'italic',
              color: acknowledged ? 'var(--text-faint)' : 'var(--accent-ink)',
              textDecoration: acknowledged ? 'none' : 'underline',
              textUnderlineOffset: 4,
              padding: 0,
              opacity: acknowledged ? 0.5 : 1,
              transition: 'all 200ms ease',
            }}
            aria-label="Stamp all consents"
          >
            {acknowledged ? 'stamped' : 'stamp all'}
          </button>
          <span
            className="editorial-caption-tight nums-tabular"
            style={{ color: canContinue ? 'var(--accent-ink)' : 'var(--text-faint)' }}
          >
            {ackCount} / {totalRows} acknowledged
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

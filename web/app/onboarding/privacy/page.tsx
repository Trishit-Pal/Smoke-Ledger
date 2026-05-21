'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card } from '@web/components/ui/Card';
import { Button } from '@web/components/ui/Button';
import { Text } from '@web/components/ui/Text';
import { saveComplianceConsents, setOnboardingStep } from '@/db/repositories/profile';
import { setSetting } from '@/db/repositories/settings';
import { recordAuditEvent } from '@/services/audit';
import { LEGAL_LINKS, LEGAL_VERSIONS } from '@web/lib/legal';
import { toSafeErrorMessage } from '@/lib/errors';
import { invalidateAnalyticsConsentCache } from '@/services/analytics';

export default function OnboardingPrivacyPage() {
  const router = useRouter();
  const [ageConfirmed, setAgeConfirmed] = React.useState(false);
  const [termsAccepted, setTermsAccepted] = React.useState(false);
  const [privacyAccepted, setPrivacyAccepted] = React.useState(false);
  const [medicalAccepted, setMedicalAccepted] = React.useState(false);
  const [dataProcessingAccepted, setDataProcessingAccepted] = React.useState(false);
  const [analyticsOptIn, setAnalyticsOptIn] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const canContinue =
    ageConfirmed && termsAccepted && privacyAccepted && medicalAccepted && dataProcessingAccepted;

  const onContinue = async () => {
    if (!canContinue) return;
    setSubmitting(true);
    setError(null);
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
      await setOnboardingStep('usage');
      router.push('/onboarding/usage');
    } catch (e) {
      setError(toSafeErrorMessage(e, 'dependency_failure'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-lg">
      <header className="flex flex-col gap-sm">
        <Text variant="caption" muted>
          ONBOARDING
        </Text>
        <Text variant="display">Before we start</Text>
        <Text variant="small" muted>
          Smoke Ledger is cessation support software. It is not medical treatment or emergency care.
        </Text>
      </header>

      <Card>
        <div className="flex flex-col gap-sm">
          <label className="flex items-start gap-sm text-small text-text-muted">
            <input
              type="checkbox"
              checked={ageConfirmed}
              onChange={(e) => setAgeConfirmed(e.target.checked)}
              className="mt-0.5"
            />
            <span>I confirm I am 18 or older.</span>
          </label>

          <label className="flex items-start gap-sm text-small text-text-muted">
            <input
              type="checkbox"
              checked={termsAccepted}
              onChange={(e) => setTermsAccepted(e.target.checked)}
              className="mt-0.5"
            />
            <span>
              I agree to the{' '}
              <Link href={LEGAL_LINKS.terms} className="text-accent hover:opacity-80">
                Terms of Service
              </Link>
              .
            </span>
          </label>

          <label className="flex items-start gap-sm text-small text-text-muted">
            <input
              type="checkbox"
              checked={privacyAccepted}
              onChange={(e) => setPrivacyAccepted(e.target.checked)}
              className="mt-0.5"
            />
            <span>
              I acknowledge the{' '}
              <Link href={LEGAL_LINKS.privacy} className="text-accent hover:opacity-80">
                Privacy Policy
              </Link>
              .
            </span>
          </label>

          <label className="flex items-start gap-sm text-small text-text-muted">
            <input
              type="checkbox"
              checked={medicalAccepted}
              onChange={(e) => setMedicalAccepted(e.target.checked)}
              className="mt-0.5"
            />
            <span>
              I understand this app does not provide medical advice, diagnosis, or treatment.
            </span>
          </label>

          <label className="flex items-start gap-sm text-small text-text-muted">
            <input
              type="checkbox"
              checked={dataProcessingAccepted}
              onChange={(e) => setDataProcessingAccepted(e.target.checked)}
              className="mt-0.5"
            />
            <span>I consent to processing my data to deliver account, sync, and security features.</span>
          </label>

          <label className="flex items-start gap-sm text-small text-text-muted">
            <input
              type="checkbox"
              checked={analyticsOptIn}
              onChange={(e) => setAnalyticsOptIn(e.target.checked)}
              className="mt-0.5"
            />
            <span>
              Optional: allow first-party product analytics events to help improve reliability and UX.
            </span>
          </label>
        </div>
      </Card>

      {error ? (
        <Text variant="small" color="var(--danger, #C85A54)">
          {error}
        </Text>
      ) : null}

      <Button
        title={submitting ? 'Saving…' : 'Continue'}
        variant="primary"
        fullWidth
        disabled={!canContinue || submitting}
        loading={submitting}
        onPress={onContinue}
      />
    </div>
  );
}

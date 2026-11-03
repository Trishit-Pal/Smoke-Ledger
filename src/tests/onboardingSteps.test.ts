import { LEGAL_VERSIONS } from '@/lib/legal';
import {
  canAccessOnboardingStep,
  consentGateRedirect,
  consentsOutdated,
  earliestOnboardingRoute,
  effectiveOnboardingStep,
  onboardingRouteIndex,
  resumeOnboardingRoute,
  resumeProfileFromRow,
} from '@/lib/onboardingSteps';

const consented = {
  ageConfirmedAt: '2026-01-01T00:00:00.000Z',
  termsVersion: '2026-05-19',
  privacyVersion: '2026-05-19',
  healthDisclaimerVersion: '2026-05-19',
  dataProcessingConsentAt: '2026-01-01T00:00:00.000Z',
};

describe('onboardingSteps', () => {
  describe('canAccessOnboardingStep (step = next page to see)', () => {
    it("step 'usage' reaches usage but not goal — the unsaved step cannot be skipped", () => {
      expect(canAccessOnboardingStep('usage', '/onboarding/usage')).toBe(true);
      expect(canAccessOnboardingStep('usage', '/onboarding/privacy')).toBe(true);
      expect(canAccessOnboardingStep('usage', '/onboarding/goal')).toBe(false);
    });

    it("step 'brands' denies done until Finish writes 'done'", () => {
      expect(canAccessOnboardingStep('brands', '/onboarding/brands')).toBe(true);
      expect(canAccessOnboardingStep('brands', '/onboarding/done')).toBe(false);
      expect(canAccessOnboardingStep('done', '/onboarding/done')).toBe(true);
    });

    it('null step behaves as privacy', () => {
      expect(canAccessOnboardingStep(null, '/onboarding/privacy')).toBe(true);
      expect(canAccessOnboardingStep(null, '/onboarding/usage')).toBe(false);
    });

    it('welcome and non-onboarding paths are always reachable', () => {
      expect(canAccessOnboardingStep(null, '/onboarding')).toBe(true);
      expect(canAccessOnboardingStep(null, '/onboarding/welcome')).toBe(true);
      expect(canAccessOnboardingStep(null, '/dashboard')).toBe(true);
    });
  });

  it('onboardingRouteIndex treats the welcome page as index 0 without prefix-matching everything', () => {
    expect(onboardingRouteIndex('/onboarding')).toBe(0);
    expect(onboardingRouteIndex('/onboarding/')).toBe(0);
    expect(onboardingRouteIndex('/onboarding/goal')).toBe(2);
    expect(onboardingRouteIndex('/onboarding/goal/anything')).toBe(2);
    expect(onboardingRouteIndex('/settings')).toBeNull();
  });

  it('earliestOnboardingRoute maps the legacy aliases onto the live usage route', () => {
    expect(earliestOnboardingRoute('setup')).toBe('/onboarding/usage');
    expect(earliestOnboardingRoute('baseline')).toBe('/onboarding/usage');
    expect(earliestOnboardingRoute('done')).toBe('/onboarding/done');
    expect(earliestOnboardingRoute(undefined)).toBe('/onboarding/privacy');
  });

  describe('resumeOnboardingRoute', () => {
    it('sends a user without consents to privacy regardless of step', () => {
      expect(resumeOnboardingRoute(null)).toBe('/onboarding/privacy');
      expect(resumeOnboardingRoute({ onboardingStep: 'goal' })).toBe('/onboarding/privacy');
    });

    it('resumes a consented user at the saved step', () => {
      expect(resumeOnboardingRoute({ ...consented, onboardingStep: 'goal' })).toBe('/onboarding/goal');
      expect(resumeOnboardingRoute({ ...consented, onboardingStep: 'brands' })).toBe(
        '/onboarding/brands',
      );
    });

    it('a consented profile with no step (legacy row) resumes at usage, not re-consent', () => {
      expect(resumeOnboardingRoute({ ...consented, onboardingStep: null })).toBe('/onboarding/usage');
    });

    it('the resume target is always reachable under the same derived step (no redirect loop)', () => {
      const profiles = [
        null,
        { onboardingStep: null },
        { ...consented, onboardingStep: null },
        { ...consented, onboardingStep: 'goal' as const },
        { ...consented, onboardingStep: 'done' as const },
      ];
      for (const p of profiles) {
        const step = effectiveOnboardingStep(p);
        expect(canAccessOnboardingStep(step, resumeOnboardingRoute(p))).toBe(true);
      }
      expect(effectiveOnboardingStep({ ...consented, onboardingStep: null })).toBe('usage');
      expect(effectiveOnboardingStep({ onboardingStep: null })).toBe('privacy');
    });
  });
});

describe('resumeProfileFromRow (shared by middleware + post-auth routing)', () => {
  it('maps every gate column from snake_case', () => {
    expect(
      resumeProfileFromRow({
        onboarding_step: 'goal',
        age_confirmed_at: 'a',
        terms_version: 't',
        privacy_version: 'p',
        health_disclaimer_version: 'h',
        data_processing_consent_at: 'd',
        health_data_consent_at: 'x',
      }),
    ).toEqual({
      onboardingStep: 'goal',
      ageConfirmedAt: 'a',
      termsVersion: 't',
      privacyVersion: 'p',
      healthDisclaimerVersion: 'h',
      dataProcessingConsentAt: 'd',
      healthDataConsentAt: 'x',
    });
  });

  it('a missing row maps to all nulls, which gates at privacy', () => {
    const p = resumeProfileFromRow(null);
    expect(Object.values(p).every((v) => v === null)).toBe(true);
    expect(resumeOnboardingRoute(p)).toBe('/onboarding/privacy');
  });

  it('a mapped consented row with no step resumes at usage (no redirect loop)', () => {
    const p = resumeProfileFromRow({
      age_confirmed_at: 'a',
      terms_version: 't',
      privacy_version: 'p',
      health_disclaimer_version: 'h',
      data_processing_consent_at: 'd',
    });
    expect(canAccessOnboardingStep(effectiveOnboardingStep(p), resumeOnboardingRoute(p))).toBe(true);
    expect(resumeOnboardingRoute(p)).toBe('/onboarding/usage');
  });
});

const current = {
  ageConfirmedAt: '2026-01-01T00:00:00.000Z',
  termsVersion: LEGAL_VERSIONS.terms,
  privacyVersion: LEGAL_VERSIONS.privacy,
  healthDisclaimerVersion: LEGAL_VERSIONS.medicalDisclaimer,
  dataProcessingConsentAt: '2026-01-01T00:00:00.000Z',
  healthDataConsentAt: '2026-01-01T00:00:00.000Z',
};

describe('consentsOutdated', () => {
  it('is false when every version is current and the health consent exists', () => {
    expect(consentsOutdated(current)).toBe(false);
  });

  it.each([
    ['terms', { termsVersion: '2020-01-01' }],
    ['privacy', { privacyVersion: '2020-01-01' }],
    ['medical disclaimer', { healthDisclaimerVersion: '2020-01-01' }],
  ])('is true when the stored %s version is older', (_name, over) => {
    expect(consentsOutdated({ ...current, ...over })).toBe(true);
  });

  it('is true for a live user whose health_data_consent_at is NULL', () => {
    expect(consentsOutdated({ ...current, healthDataConsentAt: null })).toBe(true);
    expect(consentsOutdated({ ...current, healthDataConsentAt: undefined })).toBe(true);
  });

  it('is false for someone who never consented: onboarding asks them, not /consent', () => {
    expect(consentsOutdated(null)).toBe(false);
    expect(consentsOutdated({})).toBe(false);
    expect(consentsOutdated({ ...current, dataProcessingConsentAt: null })).toBe(false);
  });

  it('resumeProfileFromRow carries health_data_consent_at into the check', () => {
    const row = {
      age_confirmed_at: 'a',
      terms_version: LEGAL_VERSIONS.terms,
      privacy_version: LEGAL_VERSIONS.privacy,
      health_disclaimer_version: LEGAL_VERSIONS.medicalDisclaimer,
      data_processing_consent_at: 'd',
    };
    expect(consentsOutdated(resumeProfileFromRow(row))).toBe(true);
    expect(consentsOutdated(resumeProfileFromRow({ ...row, health_data_consent_at: 'h' }))).toBe(false);
  });
});

describe('consentGateRedirect', () => {
  const outdated = { ...current, termsVersion: '2020-01-01' };
  const nullHealth = { ...current, healthDataConsentAt: null };

  it('sends an onboarded user with outdated consents to /consent from any app page', () => {
    for (const path of ['/dashboard', '/log', '/trends', '/onboarding/done', '/onboarding/usage']) {
      expect(consentGateRedirect(path, outdated, true)).toBe('/consent');
      expect(consentGateRedirect(path, nullHealth, true)).toBe('/consent');
    }
  });

  it('does not redirect a current user, and sends /consent home', () => {
    expect(consentGateRedirect('/dashboard', current, true)).toBeNull();
    expect(consentGateRedirect('/consent', current, true)).toBe('/dashboard');
    expect(consentGateRedirect('/consent', current, true, '/(tabs)')).toBe('/(tabs)');
  });

  it('never loops: the destination is itself never redirected', () => {
    for (const p of [outdated, nullHealth, current]) {
      const first = consentGateRedirect('/dashboard', p, true);
      if (first) expect(consentGateRedirect(first, p, true)).not.toBe(first);
    }
    expect(consentGateRedirect('/consent', outdated, true)).toBeNull();
  });

  it('keeps legal, settings (export / withdraw), auth, recovery and API paths reachable', () => {
    for (const path of [
      '/privacy',
      '/terms',
      '/support',
      '/settings',
      '/auth/callback',
      '/auth/confirm',
      '/reset-password',
      '/api/audit',
      '/api/ledger-chat',
    ]) {
      expect(consentGateRedirect(path, outdated, true)).toBeNull();
    }
    // Prefix lookalikes are not exempt.
    expect(consentGateRedirect('/settingsx', outdated, true)).toBe('/consent');
    expect(consentGateRedirect('/apix', outdated, true)).toBe('/consent');
  });

  it('leaves users who are not onboarded to the onboarding gates, outdated or not', () => {
    expect(consentGateRedirect('/dashboard', outdated, false)).toBeNull();
    expect(consentGateRedirect('/consent', outdated, false)).toBeNull();
    expect(consentGateRedirect('/dashboard', null, true)).toBeNull();
  });

  it('is pure: it does not read or return an onboarding step', () => {
    const withStep = { ...outdated, onboardingStep: 'brands' as const };
    const before = JSON.stringify(withStep);
    consentGateRedirect('/dashboard', withStep, true);
    expect(JSON.stringify(withStep)).toBe(before);
  });
});

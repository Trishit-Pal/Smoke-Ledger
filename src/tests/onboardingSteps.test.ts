import {
  canAccessOnboardingStep,
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
      }),
    ).toEqual({
      onboardingStep: 'goal',
      ageConfirmedAt: 'a',
      termsVersion: 't',
      privacyVersion: 'p',
      healthDisclaimerVersion: 'h',
      dataProcessingConsentAt: 'd',
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

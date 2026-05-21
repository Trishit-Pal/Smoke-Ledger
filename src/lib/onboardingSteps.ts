import type { OnboardingStep } from '@/types';



/** Web pathname order — keep in sync with web/middleware.ts ORDER map. */

export const ONBOARDING_ROUTE_ORDER: Record<string, number> = {

  '/onboarding/privacy': 0,

  '/onboarding/usage': 1,

  '/onboarding/setup': 1,

  '/onboarding/baseline': 1,

  '/onboarding/goal': 2,

  '/onboarding/brands': 3,

};



export const ONBOARDING_STEP_INDEX: Record<OnboardingStep, number> = {

  privacy: 0,

  usage: 1,

  setup: 1,

  baseline: 1,

  goal: 2,

  brands: 3,

  done: 4,

};



/** Expo Router paths (no /onboarding prefix in keys — pass full path). */

export const MOBILE_ONBOARDING_ROUTES = [

  '/onboarding/privacy',

  '/onboarding/usage',

  '/onboarding/setup',

  '/onboarding/baseline',

  '/onboarding/goal',

  '/onboarding/brands',

] as const;

export function onboardingStepIndex(step: OnboardingStep | null | undefined): number {
  return ONBOARDING_STEP_INDEX[step ?? 'privacy'] ?? 0;
}

export function onboardingRouteIndex(pathname: string): number | null {
  const match = Object.entries(ONBOARDING_ROUTE_ORDER).find(
    ([route]) => pathname === route || pathname.startsWith(`${route}/`),
  );
  return match ? match[1] : null;
}

export function canAccessOnboardingStep(
  currentStep: OnboardingStep | null | undefined,
  requestedPath: string,
): boolean {
  const requested = onboardingRouteIndex(requestedPath);
  if (requested == null) return true;
  const current = onboardingStepIndex(currentStep);
  return requested <= current + 1;
}

export function earliestOnboardingRoute(step: OnboardingStep | null | undefined): string {
  const idx = onboardingStepIndex(step);
  const entry = Object.entries(ONBOARDING_ROUTE_ORDER).find(([, v]) => v === idx);
  return entry?.[0] ?? '/onboarding/privacy';
}

export function hasRequiredConsents(profile: {
  ageConfirmedAt?: string | null;
  termsVersion?: string | null;
  privacyVersion?: string | null;
  healthDisclaimerVersion?: string | null;
  dataProcessingConsentAt?: string | null;
} | null): boolean {
  return Boolean(
    profile?.ageConfirmedAt &&
      profile?.termsVersion &&
      profile?.privacyVersion &&
      profile?.healthDisclaimerVersion &&
      profile?.dataProcessingConsentAt,
  );
}
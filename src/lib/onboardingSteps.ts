import type { OnboardingStep } from '@/types';
import { LEGAL_VERSIONS } from '@/lib/legal';

/**
 * Single source of truth for onboarding step order. Consumed by the web
 * middleware (`web/middleware.ts`), the post-auth router
 * (`web/lib/auth/postAuthDestination.ts`) and the Expo layout
 * (`app/onboarding/_layout.tsx`), so the gate can never drift between them.
 *
 * `user_profiles.onboarding_step` means "the next page the user should see":
 * each step writes the *following* step before navigating. A DB trigger
 * (`trg_user_profiles_onboarding_step_monotonic`) guarantees the value only
 * ever moves forward, so re-submitting an earlier step is harmless.
 */
export const ONBOARDING_ROUTE_ORDER: Record<string, number> = {
  '/onboarding/privacy': 0,
  '/onboarding/usage': 1,
  '/onboarding/setup': 1,
  '/onboarding/baseline': 1,
  '/onboarding/goal': 2,
  '/onboarding/brands': 3,
  '/onboarding/done': 4,
  '/onboarding/notifications': 4,
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
  '/onboarding/done',
  '/onboarding/notifications',
] as const;

// The welcome page (web `/onboarding`, mobile `/onboarding/welcome`) is always
// reachable. Matched by equality, not as a map entry: `'/onboarding'` as a key
// would prefix-match every onboarding route.
const WELCOME_PATHS = new Set(['/onboarding', '/onboarding/', '/onboarding/welcome']);

export function onboardingStepIndex(step: OnboardingStep | null | undefined): number {
  return ONBOARDING_STEP_INDEX[step ?? 'privacy'] ?? 0;
}

export function onboardingRouteIndex(pathname: string): number | null {
  if (WELCOME_PATHS.has(pathname)) return 0;
  const match = Object.entries(ONBOARDING_ROUTE_ORDER).find(
    ([route]) => pathname === route || pathname.startsWith(`${route}/`),
  );
  return match ? match[1] : null;
}

/**
 * A page is reachable when it is at or before the saved step. The step is the
 * next page to see, so `<=` (not `<= current + 1`): the old allowance let a
 * user deep-link past the step they had not saved yet.
 */
export function canAccessOnboardingStep(
  currentStep: OnboardingStep | null | undefined,
  requestedPath: string,
): boolean {
  const requested = onboardingRouteIndex(requestedPath);
  if (requested == null) return true;
  return requested <= onboardingStepIndex(currentStep);
}

export function earliestOnboardingRoute(step: OnboardingStep | null | undefined): string {
  const idx = onboardingStepIndex(step);
  const entry = Object.entries(ONBOARDING_ROUTE_ORDER).find(([, v]) => v === idx);
  return entry?.[0] ?? '/onboarding/privacy';
}

export interface ConsentProfile {
  ageConfirmedAt?: string | null;
  termsVersion?: string | null;
  privacyVersion?: string | null;
  healthDisclaimerVersion?: string | null;
  dataProcessingConsentAt?: string | null;
  healthDataConsentAt?: string | null;
}

export function hasRequiredConsents(profile: ConsentProfile | null | undefined): boolean {
  return Boolean(
    profile?.ageConfirmedAt &&
      profile?.termsVersion &&
      profile?.privacyVersion &&
      profile?.healthDisclaimerVersion &&
      profile?.dataProcessingConsentAt,
  );
}

export interface ResumeProfile extends ConsentProfile {
  onboardingStep?: OnboardingStep | null;
}

/** The snake_case `user_profiles` columns the gates select. */
export interface ResumeProfileRow {
  onboarding_step?: string | null;
  age_confirmed_at?: string | null;
  terms_version?: string | null;
  privacy_version?: string | null;
  health_disclaimer_version?: string | null;
  data_processing_consent_at?: string | null;
  health_data_consent_at?: string | null;
}

/**
 * One mapping from a raw profile row to the gate's shape, shared by the web
 * middleware and post-auth routing so a new consent column cannot be added to
 * one and forgotten in the other.
 */
export function resumeProfileFromRow(row: ResumeProfileRow | null | undefined): ResumeProfile {
  return {
    onboardingStep: (row?.onboarding_step as OnboardingStep | null | undefined) ?? null,
    ageConfirmedAt: row?.age_confirmed_at ?? null,
    termsVersion: row?.terms_version ?? null,
    privacyVersion: row?.privacy_version ?? null,
    healthDisclaimerVersion: row?.health_disclaimer_version ?? null,
    dataProcessingConsentAt: row?.data_processing_consent_at ?? null,
    healthDataConsentAt: row?.health_data_consent_at ?? null,
  };
}

/**
 * The step to gate on. A saved step wins; a consented profile with no step
 * (rows from before the privacy page wrote one) counts as 'usage' so it is not
 * re-asked for consent; anything else is 'privacy'. Every gate (web middleware,
 * post-auth routing, the Expo layout) must derive the step through this so the
 * "where to resume" and "may I see this page" answers can never disagree — a
 * resume target that the access check then rejects is a redirect loop.
 */
export function effectiveOnboardingStep(profile: ResumeProfile | null | undefined): OnboardingStep {
  // The consent gate wins over any saved step.
  if (!hasRequiredConsents(profile)) return 'privacy';
  return profile?.onboardingStep ?? 'usage';
}

/** Where a not-yet-onboarded user should land: the privacy step until the consents exist, then the saved step. */
export function resumeOnboardingRoute(profile: ResumeProfile | null | undefined): string {
  return earliestOnboardingRoute(effectiveOnboardingStep(profile));
}

/**
 * Someone who consented before, but not to what is current: a stored version is
 * older than LEGAL_VERSIONS (see `versionAtLeast`), or the explicit health-data consent was never given
 * (every user from before it existed has it NULL). Never true for someone who has
 * not consented at all - onboarding asks them. Reads only consent columns, never
 * `onboarding_step`, so asking again cannot move the wizard.
 */
export function consentsOutdated(profile: ConsentProfile | null | undefined): boolean {
  if (!hasRequiredConsents(profile)) return false;
  return !(
    versionAtLeast(profile?.termsVersion, LEGAL_VERSIONS.terms) &&
    versionAtLeast(profile?.privacyVersion, LEGAL_VERSIONS.privacy) &&
    versionAtLeast(profile?.healthDisclaimerVersion, LEGAL_VERSIONS.medicalDisclaimer) &&
    profile?.healthDataConsentAt
  );
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * A stored legal version counts as current when it is the required one or newer.
 * Versions are ISO dates, so string order is date order. `>=` rather than `===`
 * because the web and a store-installed mobile build can carry different
 * LEGAL_VERSIONS: with `===` each would ask again after the other stamped its own
 * version, forever. Legacy non-date values (e.g. '1') are always outdated.
 */
export function versionAtLeast(stored: string | null | undefined, required: string): boolean {
  return typeof stored === 'string' && ISO_DATE.test(stored) && stored >= required;
}

/** The version to stamp: never lower than what is stored (an older build must not downgrade it). */
export function newerVersion(stored: string | null | undefined, client: string): string {
  return versionAtLeast(stored, client) ? (stored as string) : client;
}

export const CONSENT_ROUTE = '/consent';

// Reachable while consents are outdated, so the reader can read the documents,
// export or withdraw (both live in settings), sign in/out and recover a password.
// Exact or `/x/...` matches only: `/settingsx` is not `/settings`.
const CONSENT_EXEMPT_PATHS = [
  CONSENT_ROUTE,
  '/privacy',
  '/terms',
  '/support',
  '/settings',
  '/auth',
  '/reset-password',
  '/api',
];

/**
 * Where an onboarded user must go for the re-consent gate, or null. Shared by the
 * web middleware, post-auth routing and the Expo layout so they cannot disagree.
 * Outdated -> /consent (which is exempt, so it never loops); current on /consent
 * -> `home`. A user still onboarding is left to the onboarding gates.
 */
export function consentGateRedirect(
  pathname: string,
  profile: ConsentProfile | null | undefined,
  onboarded: boolean,
  home = '/dashboard',
): string | null {
  if (!onboarded) return null;
  const onConsent = pathname === CONSENT_ROUTE || pathname.startsWith(`${CONSENT_ROUTE}/`);
  if (!consentsOutdated(profile)) return onConsent ? home : null;
  const exempt = CONSENT_EXEMPT_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  return exempt ? null : CONSENT_ROUTE;
}

import type { AllowedEmailOtpType } from '@/lib/emailOtpType';
import {
  CONSENT_ROUTE,
  consentsOutdated,
  hasRequiredConsents,
  resumeOnboardingRoute,
  resumeProfileFromRow,
} from '@/lib/onboardingSteps';
import type { OnboardingStep } from '@/types';
import { CALLBACK_ONBOARDING_PATHS } from '@web/lib/auth/callbackNextPath';

/** The profile columns the post-sign-in routing reads. */
export const POST_AUTH_PROFILE_COLUMNS =
  'onboarded_at, onboarding_step, age_confirmed_at, terms_version, privacy_version, health_disclaimer_version, data_processing_consent_at, health_data_consent_at';

export interface PostAuthProfile {
  onboarded_at?: string | null;
  onboarding_step?: OnboardingStep | string | null;
  age_confirmed_at?: string | null;
  terms_version?: string | null;
  privacy_version?: string | null;
  health_disclaimer_version?: string | null;
  data_processing_consent_at?: string | null;
  health_data_consent_at?: string | null;
}

/**
 * The `next` for a redeemed token_hash link: a recovery link with no explicit
 * next goes to set a new password. Only the token_hash path applies this, as
 * the callback always did; a bare `type=recovery` elsewhere changes nothing.
 */
export function nextPathForLink(type: AllowedEmailOtpType, nextPath: string | null): string | null {
  return type === 'recovery' && !nextPath ? '/reset-password' : nextPath;
}

/**
 * Where a freshly signed-in browser goes. Shared by the callback route (PKCE
 * code) and the confirm page's server action (token_hash) so the two cannot
 * drift. `nextPath` must already be sanitized by sanitizeCallbackNextPath.
 */
export function postAuthDestination(
  profile: PostAuthProfile | null,
  type: AllowedEmailOtpType | null,
  nextPath: string | null,
): string {
  // Route on the pathname alone so a query string cannot change the decision.
  const nextPathname = nextPath ? new URL(nextPath, 'https://x').pathname : null;

  // Recovery always wins so the user can finish setting a new password.
  if (nextPathname === '/reset-password') return nextPath!;

  const steps = resumeProfileFromRow(profile);
  if (!hasRequiredConsents(steps)) {
    // A first-time signup confirmation fires the account-created celebration;
    // carried in the URL so it works cross-device.
    return type === 'signup' ? '/onboarding/privacy?welcome=1' : '/onboarding/privacy';
  }

  if (!profile?.onboarded_at) {
    // Mid-wizard sign-in resumes at the saved step, not at consent again.
    return nextPathname && CALLBACK_ONBOARDING_PATHS.has(nextPathname)
      ? nextPath!
      : resumeOnboardingRoute(steps);
  }

  // Older consents ask again once, before the page they were heading to.
  if (consentsOutdated(steps)) return CONSENT_ROUTE;

  return nextPath ?? '/dashboard';
}

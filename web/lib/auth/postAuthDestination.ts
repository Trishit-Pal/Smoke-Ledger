import type { AllowedEmailOtpType } from '@/lib/emailOtpType';
import { CALLBACK_ONBOARDING_PATHS } from '@web/lib/auth/callbackNextPath';

/** The profile columns the post-sign-in routing reads. */
export const POST_AUTH_PROFILE_COLUMNS =
  'onboarded_at, age_confirmed_at, terms_version, privacy_version, health_disclaimer_version, data_processing_consent_at';

export interface PostAuthProfile {
  onboarded_at?: string | null;
  age_confirmed_at?: string | null;
  terms_version?: string | null;
  privacy_version?: string | null;
  health_disclaimer_version?: string | null;
  data_processing_consent_at?: string | null;
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

  const hasRequiredConsents = Boolean(
    profile?.age_confirmed_at &&
      profile?.terms_version &&
      profile?.privacy_version &&
      profile?.health_disclaimer_version &&
      profile?.data_processing_consent_at,
  );
  if (!hasRequiredConsents) {
    // A first-time signup confirmation fires the account-created celebration;
    // carried in the URL so it works cross-device.
    return type === 'signup' ? '/onboarding/privacy?welcome=1' : '/onboarding/privacy';
  }

  if (!profile?.onboarded_at) {
    return nextPathname && CALLBACK_ONBOARDING_PATHS.has(nextPathname) ? nextPath! : '/onboarding/privacy';
  }

  return nextPath ?? '/dashboard';
}

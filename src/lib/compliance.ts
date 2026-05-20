import type { UserProfile } from '@/types';

/** Mirrors web middleware consent gate. */
export function hasRequiredConsents(profile: UserProfile | null | undefined): boolean {
  return Boolean(
    profile?.ageConfirmedAt &&
      profile?.termsVersion &&
      profile?.privacyVersion &&
      profile?.healthDisclaimerVersion &&
      profile?.dataProcessingConsentAt,
  );
}

export function isOnboarded(profile: UserProfile | null | undefined): boolean {
  return Boolean(profile?.onboardedAt);
}

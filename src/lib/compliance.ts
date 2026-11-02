import type { UserProfile } from '@/types';

// One consent gate for every surface (web middleware, post-auth routing, the
// Expo layouts and redirects) — see src/lib/onboardingSteps.ts.
export { hasRequiredConsents } from '@/lib/onboardingSteps';

export function isOnboarded(profile: UserProfile | null | undefined): boolean {
  return Boolean(profile?.onboardedAt);
}

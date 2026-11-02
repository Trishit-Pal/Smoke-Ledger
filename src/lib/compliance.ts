import type { UserProfile } from '@/types';

// One consent gate for every surface (web middleware, post-auth routing, the
// Expo layouts and redirects) — see src/lib/onboardingSteps.ts.
export { hasRequiredConsents } from '@/lib/onboardingSteps';

export function isOnboarded(profile: UserProfile | null | undefined): boolean {
  return Boolean(profile?.onboardedAt);
}

/**
 * The web middleware's email-confirmation gate, shared with any route that
 * bypasses the middleware: an email account counts only once confirmed by
 * email or phone; phone-only accounts have no email to confirm.
 */
export function isEmailConfirmed(user: {
  email?: string | null;
  email_confirmed_at?: string | null;
  phone_confirmed_at?: string | null;
}): boolean {
  return !user.email || Boolean(user.email_confirmed_at) || Boolean(user.phone_confirmed_at);
}

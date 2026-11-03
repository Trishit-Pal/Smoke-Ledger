import type { UserProfile } from '@/types';
import { isOnboarded } from '@/lib/compliance';
import { consentGateRedirect, resumeOnboardingRoute } from '@/lib/onboardingSteps';

// Sign-in, sign-up, reset and the auth callbacks. Open to everyone, signed in or
// not (a re-auth before account deletion sends a signed-in reader to /login).
// Group names like (auth) are not part of the pathname.
const AUTH_PATHS = ['/login', '/signup', '/reset', '/auth'];

const isUnder = (pathname: string, base: string) => pathname === base || pathname.startsWith(`${base}/`);

export interface RouteGuardInput {
  pathname: string;
  hasSession: boolean;
  profile: UserProfile | null;
  /** Auth or profile not resolved yet: decide nothing, so nothing flashes or bounces. */
  loading: boolean;
}

export interface GuardReadiness {
  ready: boolean;
  fontsReady: boolean;
  hasError: boolean;
  authInitialized: boolean;
  hasSession: boolean;
  booted: boolean;
}

/**
 * True until the root layout is actually rendering its Stack with auth and
 * profile resolved. Fonts and the error screen count: they replace the Stack, so
 * a redirect fired meanwhile is dropped. A signed-out reader has no profile to wait for.
 */
export function isGuardLoading(r: GuardReadiness): boolean {
  return !r.ready || !r.fontsReady || r.hasError || !r.authInitialized || (r.hasSession && !r.booted);
}

/**
 * The one mobile route guard (app/_layout.tsx): where this reader must be sent
 * instead of `pathname`, or null to let them stay. Covers every route, modals
 * and deep links included, so no screen needs its own session/consent check.
 * Order matters: session, then onboarding, then re-consent. Each destination is
 * exempt from the rule that sends there (/login, /onboarding/*, /consent), so
 * the guard cannot loop.
 */
export function routeGuardRedirect({ pathname, hasSession, profile, loading }: RouteGuardInput): string | null {
  if (loading) return null;
  if (AUTH_PATHS.some((p) => isUnder(pathname, p))) return null;
  if (!hasSession) return '/login';
  // Mid-wizard sign-in resumes at the saved step (privacy until consented).
  if (!isOnboarded(profile)) return isUnder(pathname, '/onboarding') ? null : resumeOnboardingRoute(profile);
  // Settings stays reachable (export / withdraw live there) so "Not now" cannot loop.
  return consentGateRedirect(pathname, profile, true, '/(tabs)');
}

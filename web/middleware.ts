import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { isEmailConfirmed } from '@/lib/compliance';
import { isReauthRequest } from '@/lib/reauth';
import {
  canAccessOnboardingStep,
  CONSENT_ROUTE,
  consentGateRedirect,
  effectiveOnboardingStep,
  hasRequiredConsents,
  needsConsentRefresh,
  resumeOnboardingRoute,
  resumeProfileFromRow,
} from '@/lib/onboardingSteps';
import { serverLog } from '@web/lib/log';
import { buildCsp, generateNonce } from '@web/lib/security/csp';
import {
  applyAuthCookiePolicy,
  hardenCookieOptions,
  isRememberMeEnabled,
  isSupabaseAuthCookie,
  REMEMBER_ME_COOKIE,
  type AuthCookieOptions,
} from '@web/lib/supabase/cookieOptions';
import { readSupabaseAnonKey, readSupabaseUrl } from '@web/lib/supabase/env';

const AUTH_ROUTES = ['/login', '/signup', '/reset'];
const UNAVAILABLE_ROUTE = '/unavailable';
const PUBLIC_ROUTES = ['/', '/privacy', '/terms', '/support', UNAVAILABLE_ROUTE];

const IS_PROD = process.env.NODE_ENV === 'production';

function isAuthRoute(pathname: string): boolean {
  return AUTH_ROUTES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

function isOnboardingRoute(pathname: string): boolean {
  return pathname.startsWith('/onboarding');
}

// Reachable signed in or out, and exempt from the onboarding gates: the confirm
// page must be able to warn a signed-in visitor before an account switch.
function isCallbackRoute(pathname: string): boolean {
  return pathname === '/auth/callback' || pathname === '/auth/confirm';
}

function isRecoveryRoute(pathname: string): boolean {
  return pathname === '/reset-password';
}

// API routes answer for themselves: /api/audit checks same-origin and the session
// (it must work before consent: it records it); /api/ledger-chat its caller and
// its own consent and onboarding gate. Exempt from the onboarding redirects only,
// never from sign-in: a redirect turns the wizard's audit POST into an HTML 200
// that the caller would take for a recorded audit.
function isApiRoute(pathname: string): boolean {
  return pathname.startsWith('/api/');
}

type CookieOptions = {
  name: string;
  value: string;
  options?: AuthCookieOptions;
};

function resolveRememberMe(request: NextRequest): boolean {
  return isRememberMeEnabled(request.cookies.get(REMEMBER_ME_COOKIE)?.value);
}

function setAuthCookie(
  response: NextResponse,
  name: string,
  value: string,
  options: AuthCookieOptions | undefined,
  rememberMe: boolean,
): void {
  const policy = isSupabaseAuthCookie(name)
    ? applyAuthCookiePolicy(options, rememberMe)
    : hardenCookieOptions(options);
  response.cookies.set(name, value, policy);
}

function buildSecurityHeaders(nonce: string, requestHeaders: Headers) {
  const csp = buildCsp(nonce);
  // Next.js 14 reads the CSP from the forwarded *request* headers to extract
  // the nonce and stamp it onto every <script> it emits. Setting it only on
  // the response leaves framework scripts un-nonced and blocked by
  // 'strict-dynamic'. Both headers must carry the same value.
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', csp);
  return {
    'Content-Security-Policy': csp,
  };
}

export async function middleware(request: NextRequest) {
  const url = new URL(request.url);
  const pathname = url.pathname;

  const nonce = generateNonce();
  const requestHeaders = new Headers(request.headers);
  const securityHeaders = buildSecurityHeaders(nonce, requestHeaders);

  let response = NextResponse.next({ request: { headers: requestHeaders } });
  for (const [k, v] of Object.entries(securityHeaders)) response.headers.set(k, v);

  const finalize = (res: NextResponse) => {
    for (const [k, v] of Object.entries(securityHeaders)) res.headers.set(k, v);
    return res;
  };

  // The chat route does its own auth: a cookie session plus same-origin, or a
  // native Bearer token with no cookie at all. Every gate below would redirect
  // that native request to /login before the route ran, so it leaves here with
  // only the security headers. Exact match: no other path is carved out, and
  // the route re-applies the confirmed-email, consent and onboarded gates itself.
  if (pathname === '/api/ledger-chat') {
    return response;
  }

  const supabaseUrl = readSupabaseUrl();
  const supabaseAnonKey = readSupabaseAnonKey();
  if (!supabaseUrl || !supabaseAnonKey) {
    if (IS_PROD) {
      console.error('[middleware] Supabase env missing; refusing protected routes.');
    }
    if (isPublicRoute(pathname) || isAuthRoute(pathname)) {
      return response;
    }
    return finalize(NextResponse.redirect(new URL('/login', request.url)));
  }

  const rememberMe = resolveRememberMe(request);

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(toSet: CookieOptions[]) {
        toSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request: { headers: requestHeaders } });
        for (const [k, v] of Object.entries(securityHeaders)) response.headers.set(k, v);
        toSet.forEach(({ name, value, options }) =>
          setAuthCookie(response, name, value, options, rememberMe),
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Unauthenticated visitors can use public/legal/auth pages only.
  if (!user) {
    if (isPublicRoute(pathname) || isAuthRoute(pathname) || isCallbackRoute(pathname)) {
      return response;
    }
    const loginUrl = new URL('/login', request.url);
    const requestedPath = `${pathname}${url.search}`;
    loginUrl.searchParams.set('next', requestedPath);
    return finalize(NextResponse.redirect(loginUrl));
  }

  if (isCallbackRoute(pathname)) {
    return response;
  }

  // Signing in again before account deletion: let the signed-in user through.
  if (isReauthRequest(pathname, url.searchParams.get('reason'))) {
    return response;
  }

  if (isAuthRoute(pathname)) {
    return finalize(NextResponse.redirect(new URL('/dashboard', request.url)));
  }

  // Email confirmation gate: if Supabase project requires confirmation but the
  // user is somehow signed in without `email_confirmed_at`, bounce them out.
  if (!isEmailConfirmed(user)) {
    await supabase.auth.signOut();
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('error', 'email_not_confirmed');
    return finalize(NextResponse.redirect(loginUrl));
  }

  const { data: profile, error: profileError } = await supabase
    .from('user_profiles')
    .select(
      'onboarded_at, onboarding_step, age_confirmed_at, terms_version, privacy_version, health_disclaimer_version, data_processing_consent_at, health_data_consent_at',
    )
    .eq('id', user.id)
    .maybeSingle();

  // A failed read (a missing column, an outage) is not "no row": a null profile
  // would read as a new reader and send everyone to the wizard. Skip every
  // onboarding and consent gate and say so, instead of guessing.
  if (profileError) {
    serverLog('error', 'middleware.profile_read_failed', { code: profileError.code });
    // These answer for themselves (API handlers run their own checks) or must stay
    // readable: the legal pages, password recovery, the unavailable page itself.
    if (
      isApiRoute(pathname) ||
      (isPublicRoute(pathname) && pathname !== '/') ||
      isRecoveryRoute(pathname)
    ) {
      return response;
    }
    // The URL stays as the reader typed it, so "Try again" reloads the same page.
    const unavailable = NextResponse.rewrite(new URL(UNAVAILABLE_ROUTE, request.url), {
      status: 503,
      request: { headers: requestHeaders },
    });
    // Never cached: the page must go away as soon as the read works again.
    unavailable.headers.set('Cache-Control', 'no-store');
    // Keep any session cookies getUser() just refreshed.
    for (const cookie of response.cookies.getAll()) unavailable.cookies.set(cookie);
    return finalize(unavailable);
  }

  const onboarded = !!profile?.onboarded_at;
  // Step order + consent gate come from the shared helper so web, mobile and
  // the post-auth router agree (src/lib/onboardingSteps.ts).
  const steps = resumeProfileFromRow(profile);
  const consented = hasRequiredConsents(steps);
  // Where a not-yet-onboarded user resumes: privacy until consented, then the
  // saved step — so a re-login mid-wizard never re-asks for consent.
  const resume = resumeOnboardingRoute(steps);

  if (pathname === '/') {
    return finalize(
      NextResponse.redirect(
        new URL(
          onboarded ? (needsConsentRefresh(steps, true) ? CONSENT_ROUTE : '/dashboard') : resume,
          request.url,
        ),
      ),
    );
  }

  // The wizard's consent step is for readers who are not onboarded yet. An
  // onboarded reader missing a consent falls through to the re-consent gate:
  // sending them here would be bounced back by the onboarded redirect, a loop.
  // The public pages stay open so the Terms and Privacy Policy the step links to
  // can be read before agreeing to them.
  if (
    !onboarded &&
    !consented &&
    pathname !== '/onboarding' &&
    pathname !== '/onboarding/privacy' &&
    !isPublicRoute(pathname) &&
    !isRecoveryRoute(pathname) &&
    !isApiRoute(pathname)
  ) {
    return finalize(NextResponse.redirect(new URL(resume, request.url)));
  }

  if (
    !onboarded &&
    !isOnboardingRoute(pathname) &&
    !isPublicRoute(pathname) &&
    !isRecoveryRoute(pathname) &&
    !isApiRoute(pathname)
  ) {
    return finalize(NextResponse.redirect(new URL(resume, request.url)));
  }

  // Re-consent gate: an onboarded user missing a consent, or whose consents are
  // older than the current legal versions (or who never gave the health-data
  // consent), is sent to /consent before anything else, and a current user on
  // /consent goes home. Sits before
  // the onboarded bounce so /onboarding/* also lands on /consent, not /dashboard.
  // /consent and the legal, settings, auth and API paths are exempt, so no loop.
  const consentRedirect = consentGateRedirect(pathname, steps, onboarded);
  if (consentRedirect) {
    return finalize(NextResponse.redirect(new URL(consentRedirect, request.url)));
  }

  // Enforce funnel step order so a partially-onboarded user can't skip ahead
  // by typing a deeper URL. onboarding_step is the next page they should see.
  if (
    !onboarded &&
    isOnboardingRoute(pathname) &&
    !canAccessOnboardingStep(effectiveOnboardingStep(steps), pathname)
  ) {
    return finalize(NextResponse.redirect(new URL(resume, request.url)));
  }

  if (onboarded && isOnboardingRoute(pathname)) {
    // Done summary is the one onboarding route an onboarded user may still see.
    const isDonePath = pathname === '/onboarding/done';
    const stepIsDone = profile?.onboarding_step === 'done';
    if (!(isDonePath && stepIsDone)) {
      return finalize(NextResponse.redirect(new URL('/dashboard', request.url)));
    }
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|ico)$).*)'],
};

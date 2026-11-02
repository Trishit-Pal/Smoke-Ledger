import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { isEmailConfirmed } from '@/lib/compliance';
import { isReauthRequest } from '@/lib/reauth';
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
const PUBLIC_ROUTES = ['/', '/privacy', '/terms', '/support'];

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

  const { data: profile } = await supabase
    .from('user_profiles')
    .select(
      'onboarded_at, onboarding_step, age_confirmed_at, terms_version, privacy_version, health_disclaimer_version, data_processing_consent_at',
    )
    .eq('id', user.id)
    .maybeSingle();

  const onboarded = !!profile?.onboarded_at;
  const hasRequiredConsents = Boolean(
    profile?.age_confirmed_at &&
      profile?.terms_version &&
      profile?.privacy_version &&
      profile?.health_disclaimer_version &&
      profile?.data_processing_consent_at,
  );

  if (pathname === '/') {
    return finalize(
      NextResponse.redirect(
        new URL(onboarded && hasRequiredConsents ? '/dashboard' : '/onboarding/privacy', request.url),
      ),
    );
  }

  if (
    !hasRequiredConsents &&
    pathname !== '/onboarding' &&
    pathname !== '/onboarding/privacy' &&
    !isRecoveryRoute(pathname)
  ) {
    return finalize(NextResponse.redirect(new URL('/onboarding/privacy', request.url)));
  }

  if (
    !onboarded &&
    !isOnboardingRoute(pathname) &&
    !isPublicRoute(pathname) &&
    !isRecoveryRoute(pathname)
  ) {
    return finalize(NextResponse.redirect(new URL('/onboarding/privacy', request.url)));
  }

  // Enforce funnel step order so a partially-onboarded user can't skip ahead
  // by typing a deeper URL. The current step is whatever they have NOT yet
  // completed — i.e. the next page they should see.
  if (!onboarded && isOnboardingRoute(pathname)) {
    const ORDER: Record<string, number> = {
      '/onboarding': 0,
      '/onboarding/privacy': 0,
      '/onboarding/usage': 1,
      '/onboarding/setup': 1,
      '/onboarding/baseline': 1,
      '/onboarding/goal': 2,
      '/onboarding/brands': 3,
      '/onboarding/done': 4,
    };
    const stepIndex: Record<string, number> = {
      privacy: 0,
      usage: 1,
      setup: 1,
      baseline: 1,
      goal: 2,
      brands: 3,
      done: 4,
    };
    const requestedRoute = Object.keys(ORDER).find(
      (r) => pathname === r || pathname.startsWith(`${r}/`),
    );
    if (requestedRoute) {
      const requested = ORDER[requestedRoute];
      const current = stepIndex[(profile?.onboarding_step as string) ?? 'privacy'] ?? 0;
      // Allow moving forward to the next step but not skipping ahead.
      if (requested > current + 1) {
        const target = (Object.entries(ORDER).find(([, v]) => v === current) ?? ['/onboarding/privacy'])[0];
        return finalize(NextResponse.redirect(new URL(target, request.url)));
      }
    }
  }

  if (onboarded && isOnboardingRoute(pathname)) {
    // Done summary is the one onboarding route a freshly-onboarded user is
    // allowed to see, and only while their step is still 'done' (i.e. they
    // haven't visited the dashboard yet).
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

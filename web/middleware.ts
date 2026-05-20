import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { buildCsp, generateNonce } from '@web/lib/security/csp';

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

function isCallbackRoute(pathname: string): boolean {
  return pathname === '/auth/callback';
}

function isRecoveryRoute(pathname: string): boolean {
  return pathname === '/reset-password';
}

type CookieOptions = {
  name: string;
  value: string;
  options?: {
    domain?: string;
    expires?: Date;
    httpOnly?: boolean;
    maxAge?: number;
    path?: string;
    sameSite?: 'lax' | 'strict' | 'none' | boolean;
    secure?: boolean;
  };
};

function hardenCookieOptions<T extends CookieOptions['options']>(opts: T): T {
  return {
    ...(opts ?? {}),
    sameSite: opts?.sameSite ?? 'lax',
    secure: opts?.secure ?? IS_PROD,
    path: opts?.path ?? '/',
  } as T;
}

function buildSecurityHeaders(nonce: string, requestHeaders: Headers) {
  requestHeaders.set('x-nonce', nonce);
  return {
    'Content-Security-Policy': buildCsp(nonce),
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

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    if (IS_PROD) {
      console.error('[middleware] Supabase env missing; refusing protected routes.');
    }
    if (isPublicRoute(pathname) || isAuthRoute(pathname)) {
      return response;
    }
    return finalize(NextResponse.redirect(new URL('/login', request.url)));
  }

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
          response.cookies.set(name, value, hardenCookieOptions(options)),
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

  if (isAuthRoute(pathname)) {
    return finalize(NextResponse.redirect(new URL('/dashboard', request.url)));
  }

  // Email confirmation gate: if Supabase project requires confirmation but the
  // user is somehow signed in without `email_confirmed_at`, bounce them out.
  if (user.email && !user.email_confirmed_at && !user.phone_confirmed_at) {
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

  if (!hasRequiredConsents && pathname !== '/onboarding/privacy' && !isRecoveryRoute(pathname)) {
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
      '/onboarding/privacy': 0,
      '/onboarding/setup': 1,
      '/onboarding/baseline': 2,
      '/onboarding/goal': 3,
      '/onboarding/brands': 4,
    };
    const stepIndex: Record<string, number> = {
      privacy: 0,
      setup: 1,
      baseline: 2,
      goal: 3,
      brands: 4,
      done: 5,
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
    return finalize(NextResponse.redirect(new URL('/dashboard', request.url)));
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|ico)$).*)'],
};

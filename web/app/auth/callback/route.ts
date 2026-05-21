import { createServerClient } from '@supabase/ssr';
import type { EmailOtpType } from '@supabase/supabase-js';
import { NextResponse, type NextRequest } from 'next/server';
import {
  applyAuthCookiePolicy,
  hardenCookieOptions,
  isRememberMeEnabled,
  isSupabaseAuthCookie,
  REMEMBER_ME_COOKIE,
  type AuthCookieOptions,
} from '@web/lib/supabase/cookieOptions';
import { ALLOWED_NEXT_PATHS } from '@web/lib/auth/redirect';

// Paths that are also permitted as ?next= destinations in server-side
// callback routing. These extend (not replace) the client-side allowlist
// with routes that are only reachable after a Supabase callback, never
// from a user-supplied ?next= on a page navigation.
const CALLBACK_ONLY_PATHS = new Set<string>(['/reset-password']);

// Onboarding routes are allowed as ?next= targets within the callback so
// the server can hop to the correct onboarding step after email verification.
// They are intentionally excluded from the client-side ALLOWED_NEXT_PATHS.
const NEXT_ALLOWLIST_PREFIX = ['/onboarding/'];

function sanitizeNextPath(raw: string | null): string | null {
  if (!raw) return null;
  if (!raw.startsWith('/')) return null;
  if (raw.startsWith('//')) return null;
  // eslint-disable-next-line no-control-regex
  if (/[\x00-\x1f\x7f]/.test(raw)) return null;
  // Normalise path traversal sequences via URL parsing.
  let pathname: string;
  try {
    pathname = new URL(raw, 'https://x').pathname;
  } catch {
    return null;
  }
  // Check shared client-side allowlist first.
  if (ALLOWED_NEXT_PATHS.has(pathname)) return pathname;
  // Then check callback-only exact paths (e.g. /reset-password).
  if (CALLBACK_ONLY_PATHS.has(pathname)) return pathname;
  // Finally allow onboarding prefix for internal server-side hops.
  if (NEXT_ALLOWLIST_PREFIX.some((p) => pathname.startsWith(p))) return pathname;
  return null;
}

type CookieOptions = AuthCookieOptions;

function setAuthCookie(
  response: NextResponse,
  name: string,
  value: string,
  options: CookieOptions | undefined,
  rememberMe: boolean,
): void {
  const policy = isSupabaseAuthCookie(name)
    ? applyAuthCookiePolicy(options, rememberMe)
    : hardenCookieOptions(options);
  response.cookies.set(name, value, policy);
}

function redirectWithCookies(source: NextResponse, target: URL): NextResponse {
  const redirected = NextResponse.redirect(target);
  source.cookies.getAll().forEach((cookie) => redirected.cookies.set(cookie));
  // Suppress Referer leakage of the recovery token to the next page.
  redirected.headers.set('Referrer-Policy', 'no-referrer');
  return redirected;
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const tokenHash = requestUrl.searchParams.get('token_hash');
  const type = requestUrl.searchParams.get('type') as EmailOtpType | null;
  let nextPath = sanitizeNextPath(requestUrl.searchParams.get('next'));

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.redirect(new URL('/login', requestUrl.origin));
  }

  const response = NextResponse.next();
  const rememberMe = isRememberMeEnabled(request.cookies.get(REMEMBER_ME_COOKIE)?.value);

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(
        toSet: {
          name: string;
          value: string;
          options?: CookieOptions;
        }[],
      ) {
        toSet.forEach(({ name, value, options }) =>
          setAuthCookie(response, name, value, options, rememberMe),
        );
      },
    },
  });

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return redirectWithCookies(
        response,
        new URL('/login?error=invalid_or_expired_link', requestUrl.origin),
      );
    }
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type,
    });
    if (error) {
      return redirectWithCookies(
        response,
        new URL('/login?error=invalid_or_expired_link', requestUrl.origin),
      );
    }
    if (type === 'recovery' && !nextPath) {
      nextPath = '/reset-password';
    }
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return redirectWithCookies(response, new URL('/login?error=session_missing', requestUrl.origin));
  }

  // Honor ?next= only if it matches our allowlist AND the user has completed
  // the gates middleware enforces. Otherwise route to the appropriate funnel
  // step so a freshly verified user lands in onboarding, not deep in the app.
  const { data: profile } = await supabase
    .from('user_profiles')
    .select(
      'onboarded_at, age_confirmed_at, terms_version, privacy_version, health_disclaimer_version, data_processing_consent_at',
    )
    .eq('id', user.id)
    .maybeSingle();

  const hasRequiredConsents = Boolean(
    profile?.age_confirmed_at &&
      profile?.terms_version &&
      profile?.privacy_version &&
      profile?.health_disclaimer_version &&
      profile?.data_processing_consent_at,
  );
  const onboarded = !!profile?.onboarded_at;

  // Recovery flow always wins so the user can finish setting a new password.
  if (nextPath === '/reset-password') {
    return redirectWithCookies(response, new URL('/reset-password', requestUrl.origin));
  }

  if (!hasRequiredConsents) {
    return redirectWithCookies(response, new URL('/onboarding/privacy', requestUrl.origin));
  }

  if (!onboarded) {
    // Allow explicit onboarding hops; otherwise start at privacy.
    if (nextPath && nextPath.startsWith('/onboarding/')) {
      return redirectWithCookies(response, new URL(nextPath, requestUrl.origin));
    }
    return redirectWithCookies(response, new URL('/onboarding/privacy', requestUrl.origin));
  }

  const destination = nextPath ?? '/dashboard';
  return redirectWithCookies(response, new URL(destination, requestUrl.origin));
}

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
import { sanitizeCallbackNextPath, CALLBACK_ONBOARDING_PATHS } from '@web/lib/auth/callbackNextPath';
import { readSupabaseAnonKey, readSupabaseUrl } from '@web/lib/supabase/env';

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
  let nextPath = sanitizeCallbackNextPath(requestUrl.searchParams.get('next'));

  const supabaseUrl = readSupabaseUrl();
  const supabaseAnonKey = readSupabaseAnonKey();
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

  // Routing decisions use the normalised pathname to avoid issues with query
  // strings (e.g. `/reset-password?hint=x` must still trigger the recovery
  // flow). The actual redirect target uses `nextPath` (the original raw value)
  // so query strings like `?ref=widget` are preserved in the final URL.
  const nextPathname = nextPath ? new URL(nextPath, 'https://x').pathname : null;

  // Recovery flow always wins so the user can finish setting a new password.
  if (nextPathname === '/reset-password') {
    return redirectWithCookies(response, new URL(nextPath!, requestUrl.origin));
  }

  if (!hasRequiredConsents) {
    const target = new URL('/onboarding/privacy', requestUrl.origin);
    // First-time signup confirmation → flag the first onboarding screen to fire
    // the account-created celebration. Cross-device-safe (carried in the URL, not
    // device-local storage).
    if (type === 'signup') {
      target.searchParams.set('welcome', '1');
    }
    return redirectWithCookies(response, target);
  }

  if (!onboarded) {
    // Allow explicit onboarding hops; otherwise start at privacy.
    if (nextPathname && CALLBACK_ONBOARDING_PATHS.has(nextPathname)) {
      return redirectWithCookies(response, new URL(nextPath!, requestUrl.origin));
    }
    return redirectWithCookies(response, new URL('/onboarding/privacy', requestUrl.origin));
  }

  const destination = nextPath ?? '/dashboard';
  return redirectWithCookies(response, new URL(destination, requestUrl.origin));
}

import { createServerClient } from '@supabase/ssr';
import { confirmLinkPath, readAuthLink } from '@/lib/authLink';
import { parseEmailOtpType } from '@/lib/emailOtpType';
import { NextResponse, type NextRequest } from 'next/server';
import {
  applyAuthCookiePolicy,
  hardenCookieOptions,
  isRememberMeEnabled,
  isSupabaseAuthCookie,
  REMEMBER_ME_COOKIE,
  type AuthCookieOptions,
} from '@web/lib/supabase/cookieOptions';
import { sanitizeCallbackNextPath } from '@web/lib/auth/callbackNextPath';
import { POST_AUTH_PROFILE_COLUMNS, postAuthDestination } from '@web/lib/auth/postAuthDestination';
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
  const link = readAuthLink(requestUrl.searchParams);
  const type = parseEmailOtpType(requestUrl.searchParams.get('type'));
  const nextPath = sanitizeCallbackNextPath(requestUrl.searchParams.get('next'));

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

  // A token_hash link is not bound to the browser that asked for it, so opening
  // one must not sign this browser in (security scan F6). Hand it to the confirm
  // page, where the person on this device redeems it with a POST.
  if (link.kind === 'confirm') {
    return redirectWithCookies(
      response,
      new URL(confirmLinkPath(link, nextPath), requestUrl.origin),
    );
  }

  // A PKCE code only works with this browser's code_verifier: exchange it now.
  if (link.kind === 'exchange') {
    const { error } = await supabase.auth.exchangeCodeForSession(link.code);
    if (error) {
      return redirectWithCookies(
        response,
        new URL('/login?error=invalid_or_expired_link', requestUrl.origin),
      );
    }
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return redirectWithCookies(response, new URL('/login?error=session_missing', requestUrl.origin));
  }

  const { data: profile } = await supabase
    .from('user_profiles')
    .select(POST_AUTH_PROFILE_COLUMNS)
    .eq('id', user.id)
    .maybeSingle();

  return redirectWithCookies(
    response,
    new URL(postAuthDestination(profile, type, nextPath), requestUrl.origin),
  );
}

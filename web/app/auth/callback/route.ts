import { createServerClient } from '@supabase/ssr';
import type { EmailOtpType } from '@supabase/supabase-js';
import { NextResponse, type NextRequest } from 'next/server';

const IS_PROD = process.env.NODE_ENV === 'production';

// Explicit allowlist of internal destinations for the ?next= parameter.
// Anything not on this list (or matching a wildcard tail) falls back to the
// default destination computed from profile state below.
const NEXT_ALLOWLIST_EXACT = new Set<string>([
  '/dashboard',
  '/settings',
  '/log',
  '/log/new',
  '/history',
  '/trends',
  '/reset-password',
]);
const NEXT_ALLOWLIST_PREFIX = ['/onboarding/'];

function sanitizeNextPath(raw: string | null): string | null {
  if (!raw) return null;
  if (!raw.startsWith('/')) return null;
  if (raw.startsWith('//')) return null;
  // Reject any path with a query/hash that could chain another redirect.
  if (raw.includes('//') || raw.includes('@')) return null;
  // Strip any query/fragment to keep the destination simple.
  const cleaned = raw.split(/[?#]/)[0];
  if (NEXT_ALLOWLIST_EXACT.has(cleaned)) return cleaned;
  if (NEXT_ALLOWLIST_PREFIX.some((p) => cleaned.startsWith(p))) return cleaned;
  return null;
}

type CookieOptions = {
  domain?: string;
  expires?: Date;
  httpOnly?: boolean;
  maxAge?: number;
  path?: string;
  sameSite?: 'lax' | 'strict' | 'none' | boolean;
  secure?: boolean;
};

function hardenCookieOptions(opts: CookieOptions | undefined): CookieOptions {
  return {
    ...(opts ?? {}),
    sameSite: opts?.sameSite ?? 'lax',
    secure: opts?.secure ?? IS_PROD,
    path: opts?.path ?? '/',
  };
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
          response.cookies.set(name, value, hardenCookieOptions(options)),
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

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
const CALLBACK_ONLY_PATHS: ReadonlySet<string> = new Set(['/reset-password']);

// Onboarding routes are allowed as ?next= targets within the callback so the
// server can hop to the correct onboarding step after email verification. They
// are intentionally excluded from the client-side ALLOWED_NEXT_PATHS.
//
// F2 audit: this was previously a `startsWith('/onboarding/')` prefix match,
// which let any string under /onboarding/ through (including unrecognised paths
// that don't correspond to a real page). Switched to an explicit Set so adding
// a future onboarding route requires an explicit allowlist update — defense in
// depth against latent chained-redirect vectors if an onboarding page ever
// consumes `?next=` itself. Must stay in sync with web/app/onboarding/**/page.tsx.
const ONBOARDING_PATHS: ReadonlySet<string> = new Set([
  '/onboarding',
  '/onboarding/baseline',
  '/onboarding/brands',
  '/onboarding/goal',
  '/onboarding/privacy',
  '/onboarding/setup',
  '/onboarding/usage',
]);

/**
 * Validates `raw` against all three callback-side allowlists and returns the
 * normalised pathname if permitted, or null if not.
 *
 * Returning the pathname (not `raw`) allows callers to make routing decisions
 * (e.g. `startsWith('/onboarding/')`) without re-parsing. The redirect itself
 * uses the original `raw` so query strings are preserved.
 */
function extractAllowedCallbackPathname(raw: string | null): string | null {
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
  // Finally allow explicit onboarding paths for internal server-side hops.
  if (ONBOARDING_PATHS.has(pathname)) return pathname;
  return null;
}

/**
 * Returns the original `raw` value (preserving query string and hash) when
 * the path is on the callback-side allowlist, or null otherwise.
 *
 * Using `raw` rather than the normalised pathname ensures that legitimate
 * deep-links such as `/log?ref=widget` survive the redirect intact.
 *
 * @internal Exported only for unit-testing — not part of the public route API.
 */
export function _sanitizeCallbackNextPath(raw: string | null): string | null {
  const pathname = extractAllowedCallbackPathname(raw);
  if (pathname === null) return null;
  // Safe: extractAllowedCallbackPathname only returns non-null when raw is non-null.
  return raw!;
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
  let nextPath = _sanitizeCallbackNextPath(requestUrl.searchParams.get('next'));

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
    return redirectWithCookies(response, new URL('/onboarding/privacy', requestUrl.origin));
  }

  if (!onboarded) {
    // Allow explicit onboarding hops; otherwise start at privacy.
    if (nextPathname && ONBOARDING_PATHS.has(nextPathname)) {
      return redirectWithCookies(response, new URL(nextPath!, requestUrl.origin));
    }
    return redirectWithCookies(response, new URL('/onboarding/privacy', requestUrl.origin));
  }

  const destination = nextPath ?? '/dashboard';
  return redirectWithCookies(response, new URL(destination, requestUrl.origin));
}

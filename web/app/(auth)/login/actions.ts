'use server';

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { getAuthErrorCode, toAuthErrorMessage } from '@/lib/auth-errors';
import { sanitizeNextPath } from '@web/lib/auth/redirect';
import { resolvePostSignInPath } from '@web/lib/auth/signInDestination';
import { emailZodStrict } from '@web/lib/auth/email';
import { checkRateLimits, getClientIp } from '@web/lib/auth/rateLimit';
import { loginRateLimitKeys } from '@web/lib/auth/authRateLimitKeys';
import { isNextRedirectError, safeAuthCatchState } from '@web/lib/auth/authCatch';
import { withTimeout, DEFAULT_AUTH_TIMEOUT_MS } from '@web/lib/auth/withTimeout';
import { readSupabaseAnonKey, readSupabaseUrl } from '@web/lib/supabase/env';
import {
  REMEMBER_ME_COOKIE,
  applyAuthCookiePolicy,
  hardenCookieOptions,
  isSupabaseAuthCookie,
  type AuthCookieOptions,
} from '@web/lib/supabase/cookieOptions';
import type { LoginActionState } from './loginActionState';

const ONE_YEAR_SEC = 60 * 60 * 24 * 365;
const IS_PROD = process.env.NODE_ENV === 'production';

const schema = z.object({
  email: emailZodStrict,
  password: z.string().min(1).max(128),
  rememberMe: z.boolean().optional(),
  captchaToken: z.string().min(1).optional(),
  next: z.string().optional().nullable(),
});

export async function signInWithPasswordAction(
  _prev: LoginActionState,
  formData: FormData,
): Promise<LoginActionState> {
  let destination: string | null = null;

  try {
    const supabaseUrl = readSupabaseUrl();
    const supabaseAnonKey = readSupabaseAnonKey();
    if (!supabaseUrl || !supabaseAnonKey) {
      return { code: 'server_misconfigured', message: 'Sign-in is temporarily unavailable.' };
    }

    const rememberMeRaw = formData.get('rememberMe');
    const parsed = schema.safeParse({
      email: formData.get('email'),
      password: formData.get('password'),
      rememberMe: rememberMeRaw === '1' || rememberMeRaw === 'on' || rememberMeRaw === 'true',
      captchaToken: formData.get('captchaToken') || undefined,
      next: formData.get('next'),
    });
    if (!parsed.success) {
      return {
        code: 'validation_error',
        message: 'Check your email and password and try again.',
      };
    }

    const { email, password, rememberMe = false, captchaToken } = parsed.data;
    // '' fallback: "no usable next" stays distinct from the /dashboard default.
    const requestedNext = sanitizeNextPath(parsed.data.next ?? null, '') || null;

    // DB-backed token bucket (same `consume_rate_limit` RPC as OTP). Fail-open
    // so a missing service-role key can't lock everyone out of sign-in —
    // Supabase's native auth limits remain as a backstop. See SCALING_PLAN.md §2a.
    const rateOk = await checkRateLimits(loginRateLimitKeys(await getClientIp(), email), {
      failOpen: true,
    });
    if (!rateOk) {
      return {
        code: 'rate_limited',
        message: 'Too many sign-in attempts. Please wait a few minutes and try again.',
      };
    }

    const cookieStore = await cookies();
    try {
      cookieStore.set(REMEMBER_ME_COOKIE, rememberMe ? '1' : '', {
        path: '/',
        maxAge: rememberMe ? ONE_YEAR_SEC : 0,
        sameSite: 'lax',
        secure: IS_PROD,
      });
    } catch {
      // cookieStore.set() can throw in read-only contexts. Sign-in cookies
      // are persisted via Supabase's setAll callback below, which also
      // tolerates read-only contexts.
    }

    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(toSet: { name: string; value: string; options?: AuthCookieOptions }[]) {
          try {
            toSet.forEach(({ name, value, options }) => {
              const policy = isSupabaseAuthCookie(name)
                ? applyAuthCookiePolicy(options, rememberMe)
                : hardenCookieOptions(options);
              cookieStore.set(name, value, policy);
            });
          } catch {
            // Same as above — read-only context tolerated; the middleware
            // refreshes session cookies on the next request.
          }
        },
      },
    });

    const { data, error } = await withTimeout(
      supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
        options: captchaToken ? { captchaToken } : undefined,
      }),
      DEFAULT_AUTH_TIMEOUT_MS,
    );

    if (error) {
      // One message for "no such email" and "wrong password": see
      // web-auth-no-enumeration.test.ts.
      const code = getAuthErrorCode(error) || 'authentication_error';
      return { code, message: toAuthErrorMessage(error) };
    }

    // Land where the consent/onboarding gate says, not on a page the middleware
    // would bounce (see resolvePostSignInPath).
    destination = await resolvePostSignInPath(supabase, data.user.id, requestedNext);
  } catch (err) {
    if (isNextRedirectError(err)) throw err;
    // Log the real error server-side (Vercel logs); return a GENERIC message so
    // raw internal error text never reaches the client. A withTimeout deadline
    // also lands here as a dependency_failure rather than a hung spinner.
    console.error('[login] unexpected sign-in error', err);
    return safeAuthCatchState(err);
  }

  // redirect() throws NEXT_REDIRECT so the client receives a 303 with the
  // session cookies attached on the same response. Calling it OUTSIDE the
  // try/catch above guarantees the redirect signal is not swallowed.
  if (destination) redirect(destination);
  return { code: 'internal_error', message: 'Sign-in completed but no redirect target.' };
}

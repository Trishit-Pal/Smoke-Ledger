'use server';

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { getAuthErrorCode, toAuthErrorMessage } from '@/lib/auth-errors';
import { sanitizeNextPath } from '@web/lib/auth/redirect';
import { emailZodStrict } from '@web/lib/auth/email';
import { checkRateLimits, getClientIp } from '@web/lib/auth/rateLimit';
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

function isNextRedirectError(err: unknown): boolean {
  // next/navigation's redirect() throws an Error whose digest starts with
  // 'NEXT_REDIRECT'. This is the framework's signal — never swallow it.
  return (
    typeof err === 'object' &&
    err !== null &&
    'digest' in err &&
    typeof (err as { digest?: unknown }).digest === 'string' &&
    (err as { digest: string }).digest.startsWith('NEXT_REDIRECT')
  );
}

export async function signInWithPasswordAction(
  _prev: LoginActionState,
  formData: FormData,
): Promise<LoginActionState> {
  let nextPathToRedirect: string | null = null;

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
    nextPathToRedirect = sanitizeNextPath(parsed.data.next ?? null);

    // DB-backed token bucket (same `consume_rate_limit` RPC as OTP). Fail-open
    // so a missing service-role key can't lock everyone out of sign-in —
    // Supabase's native auth limits remain as a backstop. See SCALING_PLAN.md §2a.
    const rateOk = await checkRateLimits(
      [
        { kind: 'pw_login_ip', key: getClientIp(), max: 10, windowSec: 600 },
        { kind: 'pw_login_email', key: email.trim().toLowerCase(), max: 5, windowSec: 900 },
      ],
      { failOpen: true },
    );
    if (!rateOk) {
      return {
        code: 'rate_limited',
        message: 'Too many sign-in attempts. Please wait a few minutes and try again.',
      };
    }

    const cookieStore = cookies();
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

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
      options: captchaToken ? { captchaToken } : undefined,
    });

    if (error) {
      return {
        code: getAuthErrorCode(error) || 'authentication_error',
        message: toAuthErrorMessage(error),
      };
    }
  } catch (err) {
    if (isNextRedirectError(err)) throw err;
    const msg = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    // TEMPORARY: surface the actual error in the action state so production
    // can be diagnosed without runtime-log access. Replace with a generic
    // message once the underlying throw is identified and fixed.
    return { code: 'diagnostic_error', message: `Sign-in failed: ${msg.slice(0, 300)}` };
  }

  // redirect() throws NEXT_REDIRECT so the client receives a 303 with the
  // session cookies attached on the same response. Calling it OUTSIDE the
  // try/catch above guarantees the redirect signal is not swallowed.
  if (nextPathToRedirect) redirect(nextPathToRedirect);
  return { code: 'internal_error', message: 'Sign-in completed but no redirect target.' };
}

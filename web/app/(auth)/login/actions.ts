'use server';

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { getAuthErrorCode, toAuthErrorMessage } from '@/lib/auth-errors';
import { sanitizeNextPath } from '@web/lib/auth/redirect';
import {
  REMEMBER_ME_COOKIE,
  applyAuthCookiePolicy,
  hardenCookieOptions,
  isSupabaseAuthCookie,
  type AuthCookieOptions,
} from '@web/lib/supabase/cookieOptions';

const ONE_YEAR_SEC = 60 * 60 * 24 * 365;
const IS_PROD = process.env.NODE_ENV === 'production';

const schema = z.object({
  email: z.string().email().max(320),
  password: z.string().min(1).max(128),
  rememberMe: z.boolean().optional(),
  captchaToken: z.string().min(1).optional(),
  next: z.string().optional().nullable(),
});

export type LoginActionState = {
  code: string | null;
  message: string | null;
};

export const initialLoginActionState: LoginActionState = { code: null, message: null };

export async function signInWithPasswordAction(
  _prev: LoginActionState,
  formData: FormData,
): Promise<LoginActionState> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
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
  const nextPath = sanitizeNextPath(parsed.data.next ?? null);

  const cookieStore = cookies();
  cookieStore.set(REMEMBER_ME_COOKIE, rememberMe ? '1' : '', {
    path: '/',
    maxAge: rememberMe ? ONE_YEAR_SEC : 0,
    sameSite: 'lax',
    secure: IS_PROD,
  });

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(toSet: { name: string; value: string; options?: AuthCookieOptions }[]) {
        toSet.forEach(({ name, value, options }) => {
          const policy = isSupabaseAuthCookie(name)
            ? applyAuthCookiePolicy(options, rememberMe)
            : hardenCookieOptions(options);
          cookieStore.set(name, value, policy);
        });
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

  // redirect() throws NEXT_REDIRECT so the client receives a 303 with the
  // session cookies attached on the same response.
  redirect(nextPath);
}

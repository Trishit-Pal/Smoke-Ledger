import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { getAuthErrorCode, toAuthErrorMessage } from '@/lib/auth-errors';
import {
  applyAuthCookiePolicy,
  hardenCookieOptions,
  isSupabaseAuthCookie,
  REMEMBER_ME_COOKIE,
  type AuthCookieOptions,
} from '@web/lib/supabase/cookieOptions';

const ONE_YEAR_SEC = 60 * 60 * 24 * 365;

const bodySchema = z.object({
  email: z.string().email().max(320),
  password: z.string().min(1).max(128),
  rememberMe: z.boolean().optional(),
  captchaToken: z.string().min(1).optional(),
});

function setRememberMePreferenceCookie(response: NextResponse, rememberMe: boolean): void {
  if (rememberMe) {
    response.cookies.set(REMEMBER_ME_COOKIE, '1', {
      path: '/',
      maxAge: ONE_YEAR_SEC,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    });
  } else {
    response.cookies.set(REMEMBER_ME_COOKIE, '', {
      path: '/',
      maxAge: 0,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    });
  }
}

export async function POST(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json({ code: 'server_misconfigured' }, { status: 503 });
  }

  let parsedBody: z.infer<typeof bodySchema>;
  try {
    const raw = await request.json();
    const parsed = bodySchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ code: 'validation_error' }, { status: 400 });
    }
    parsedBody = parsed.data;
  } catch {
    return NextResponse.json({ code: 'validation_error' }, { status: 400 });
  }

  const rememberMe = parsedBody.rememberMe ?? false;
  let response = NextResponse.json({ ok: true });
  setRememberMePreferenceCookie(response, rememberMe);

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(
        cookiesToSet: {
          name: string;
          value: string;
          options?: AuthCookieOptions;
        }[],
      ) {
        cookiesToSet.forEach(({ name, value, options }) => {
          const policy = isSupabaseAuthCookie(name)
            ? applyAuthCookiePolicy(options, rememberMe)
            : hardenCookieOptions(options);
          response.cookies.set(name, value, policy);
        });
      },
    },
  });

  const { error } = await supabase.auth.signInWithPassword({
    email: parsedBody.email.trim(),
    password: parsedBody.password,
    options: parsedBody.captchaToken ? { captchaToken: parsedBody.captchaToken } : undefined,
  });

  if (error) {
    const code = getAuthErrorCode(error);
    return NextResponse.json(
      {
        code: code || 'authentication_error',
        message: toAuthErrorMessage(error),
      },
      { status: 401 },
    );
  }

  return response;
}

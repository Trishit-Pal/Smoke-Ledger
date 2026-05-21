const IS_PROD = process.env.NODE_ENV === 'production';

/** Long-lived preference: when set to "1", auth cookies may use persistent maxAge. */
export const REMEMBER_ME_COOKIE = 'sl_remember_me';

export type AuthCookieOptions = {
  domain?: string;
  expires?: Date;
  httpOnly?: boolean;
  maxAge?: number;
  path?: string;
  sameSite?: 'lax' | 'strict' | 'none' | boolean;
  secure?: boolean;
};

export function isRememberMeEnabled(value: string | undefined | null): boolean {
  return value === '1';
}

export function hardenCookieOptions(opts?: AuthCookieOptions): AuthCookieOptions {
  return {
    ...(opts ?? {}),
    sameSite: opts?.sameSite ?? 'lax',
    secure: opts?.secure ?? IS_PROD,
    path: opts?.path ?? '/',
  };
}

export function applyAuthCookiePolicy(
  options: AuthCookieOptions | undefined,
  rememberMe: boolean,
): AuthCookieOptions {
  const base = hardenCookieOptions(options ?? {});
  if (rememberMe) return base;
  const { maxAge: _maxAge, expires: _expires, ...sessionOnly } = base;
  return sessionOnly;
}

export function isSupabaseAuthCookie(name: string): boolean {
  return name.includes('-auth-token');
}

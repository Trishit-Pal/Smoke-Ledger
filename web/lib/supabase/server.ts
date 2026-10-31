import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import {
  applyAuthCookiePolicy,
  hardenCookieOptions,
  isRememberMeEnabled,
  isSupabaseAuthCookie,
  REMEMBER_ME_COOKIE,
  type AuthCookieOptions,
} from '@web/lib/supabase/cookieOptions';
import { readSupabaseAnonKey, readSupabaseUrl } from '@web/lib/supabase/env';

type CookieOptions = AuthCookieOptions;

export async function createClient() {
  const cookieStore = await cookies();
  const supabaseUrl = readSupabaseUrl();
  const supabaseAnonKey = readSupabaseAnonKey();
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase env is not configured');
  }

  const rememberMe = isRememberMeEnabled(cookieStore.get(REMEMBER_ME_COOKIE)?.value);

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(
        toSet: {
          name: string;
          value: string;
          options?: CookieOptions;
        }[],
      ) {
        try {
          toSet.forEach(({ name, value, options }) => {
            const policy = isSupabaseAuthCookie(name)
              ? applyAuthCookiePolicy(options, rememberMe)
              : hardenCookieOptions(options);
            cookieStore.set(name, value, policy);
          });
        } catch {
          // Called from a Server Component — cookies cannot be written there.
        }
      },
    },
  });
}

export function isSupabaseServerConfigured(): boolean {
  return !!(readSupabaseUrl() && readSupabaseAnonKey());
}

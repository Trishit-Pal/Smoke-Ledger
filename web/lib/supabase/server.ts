import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

const IS_PROD = process.env.NODE_ENV === 'production';

type CookieOptions = Parameters<ReturnType<typeof cookies>['set']>[2];

function hardenCookieOptions(opts: CookieOptions): CookieOptions {
  return {
    ...(opts ?? {}),
    sameSite: opts?.sameSite ?? 'lax',
    secure: opts?.secure ?? IS_PROD,
    path: opts?.path ?? '/',
  };
}

export function createClient() {
  const cookieStore = cookies();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase env is not configured');
  }
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
          toSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, hardenCookieOptions(options)),
          );
        } catch {
          // Called from a Server Component — cookies cannot be written there.
          // Middleware will refresh on the next request.
        }
      },
    },
  });
}

export function isSupabaseServerConfigured(): boolean {
  return !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

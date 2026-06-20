import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import { readRememberMePreference } from '@web/lib/auth/rememberMe';
import {
  applyAuthCookiePolicy,
  isSupabaseAuthCookie,
  type AuthCookieOptions,
} from '@web/lib/supabase/cookieOptions';
import { readSupabaseAnonKey, readSupabaseUrl } from '@web/lib/supabase/env';

let client: SupabaseClient | null = null;

function parseDocumentCookies(): { name: string; value: string }[] {
  if (typeof document === 'undefined') return [];
  if (!document.cookie) return [];
  return document.cookie.split(';').map((chunk) => {
    const trimmed = chunk.trim();
    const eq = trimmed.indexOf('=');
    if (eq <= 0) return { name: trimmed, value: '' };
    return {
      name: trimmed.slice(0, eq),
      value: decodeURIComponent(trimmed.slice(eq + 1)),
    };
  });
}

function serializeBrowserCookie(name: string, value: string, options?: AuthCookieOptions): string {
  const encoded = `${name}=${encodeURIComponent(value)}`;
  const parts = [encoded];
  if (options?.path) parts.push(`Path=${options.path}`);
  if (options?.maxAge != null) parts.push(`Max-Age=${options.maxAge}`);
  if (options?.expires) parts.push(`Expires=${options.expires.toUTCString()}`);
  if (options?.sameSite) {
    const sameSite =
      typeof options.sameSite === 'string'
        ? options.sameSite.charAt(0).toUpperCase() + options.sameSite.slice(1)
        : 'Lax';
    parts.push(`SameSite=${sameSite}`);
  }
  if (options?.secure) parts.push('Secure');
  return parts.join('; ');
}

export function isSupabaseConfigured(): boolean {
  return !!(readSupabaseUrl() && readSupabaseAnonKey());
}

export function getSupabase(): SupabaseClient {
  // This is the browser cookie client; it reads the session from `document.cookie`
  // and has no auth context on the server. Calling it from a server component or
  // server action silently returns empty data (the original /onboarding/done bug),
  // so fail loudly instead. Server code must use @web/lib/supabase/server
  // (createClient) or the @web/lib/server/data helpers.
  if (typeof window === 'undefined') {
    throw new Error(
      'getSupabase() (browser Supabase client) was called in a server context. ' +
        'Use @web/lib/supabase/server (createClient) or @web/lib/server/data instead.',
    );
  }
  if (client) return client;
  const url = readSupabaseUrl();
  const key = readSupabaseAnonKey();
  if (!url || !key) {
    throw new Error(
      'Supabase env is missing. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.',
    );
  }

  client = createBrowserClient(url, key, {
    cookies: {
      getAll() {
        return parseDocumentCookies();
      },
      setAll(cookiesToSet: { name: string; value: string; options?: AuthCookieOptions }[]) {
        const rememberMe = readRememberMePreference();
        cookiesToSet.forEach(({ name, value, options }) => {
          if (options?.httpOnly) return;
          const policy = isSupabaseAuthCookie(name)
            ? applyAuthCookiePolicy(options, rememberMe)
            : options;
          document.cookie = serializeBrowserCookie(name, value, policy);
        });
      },
    },
  });
  return client;
}

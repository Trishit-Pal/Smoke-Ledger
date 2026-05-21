import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import { readRememberMePreference } from '@web/lib/auth/rememberMe';
import {
  applyAuthCookiePolicy,
  isSupabaseAuthCookie,
  type AuthCookieOptions,
} from '@web/lib/supabase/cookieOptions';

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
  return !!(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

export function getSupabase(): SupabaseClient {
  if (client) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
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

/**
 * Shared, whitespace-safe readers for Supabase environment values.
 *
 * Supabase URLs and JWTs never legitimately contain whitespace. Stripping ALL
 * whitespace (not just the ends, as `.trim()` does) makes env reads resilient
 * to values that arrive newline-wrapped from a copy/paste into a hosting env
 * UI — an embedded `\n` in a key otherwise yields an illegal `Authorization`
 * header and a "Failed to execute 'fetch': Invalid value" error in the browser.
 *
 * The `process.env.NEXT_PUBLIC_*` references are kept textual so Next.js
 * build-time inlining still works in client bundles. This module has no
 * Node-only dependencies, so it is safe to import from the Edge runtime
 * (middleware, CSP). The server-only `SUPABASE_SERVICE_ROLE_KEY` is
 * intentionally not referenced here; callers in server code reuse
 * `cleanEnvValue` on that literal directly.
 */
export function cleanEnvValue(value: string | undefined): string | undefined {
  return value?.replace(/\s+/g, '') || undefined;
}

export function readSupabaseUrl(): string | undefined {
  return cleanEnvValue(process.env.NEXT_PUBLIC_SUPABASE_URL);
}

export function readSupabaseAnonKey(): string | undefined {
  return cleanEnvValue(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

// Shared CORS allowlist for Supabase Edge Functions.
//
// Sources of truth, in order:
//   1. ALLOWED_ORIGINS env var (comma-separated). Operator override; trims and
//      filters empty values. Setting this on the function takes precedence over
//      everything else and lets us tighten or broaden without redeploy.
//   2. DEFAULT_PROD_ORIGINS — hardcoded list of canonical production frontends
//      that should always work even if the env var is unset. Prevents the
//      single-point-of-failure where a forgotten env var (or a freshly-cloned
//      function with no env wired) silently 403s the prod site.
//   3. This project's Vercel preview deployments (see originPatterns.ts). Each PR
//      ships under a unique subdomain; the auth header is the real isolation, the
//      origin allowlist is just a CORS courtesy, but it must not admit every
//      *.vercel.app site.
//
// Disallowed-origin handling: omit the `Access-Control-Allow-Origin` header
// entirely. The previous helper emitted the literal string `'null'`, which
// browsers display as a confusing `'null' is not equal to the supplied origin`
// error and pollutes log triage. Omission is the canonical CORS denial.

import { PREVIEW_ORIGIN_REGEX } from './originPatterns.ts';

const ENV = (Deno.env.get('ENVIRONMENT') ?? Deno.env.get('ENV') ?? 'production').toLowerCase();
const IS_PROD = ENV === 'production';

export const DEFAULT_PROD_ORIGINS: readonly string[] = [
  'https://smoke-ledger.vercel.app',
  'https://smoke-ledger-beige.vercel.app', // canonical Vercel production alias
  'https://smokeledger.app',
];

function readEnvAllowedOrigins(): string[] {
  return (Deno.env.get('ALLOWED_ORIGINS') ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
}

export function originAllowed(origin: string | null): boolean {
  // Non-browser clients (mobile native, curl, server-to-server): no Origin
  // header is sent at all — we accept them. The bearer token is the real gate.
  if (!origin) return true;

  const envOrigins = readEnvAllowedOrigins();
  if (envOrigins.includes('*') && !IS_PROD) return true;
  if (envOrigins.includes(origin)) return true;
  if (DEFAULT_PROD_ORIGINS.includes(origin)) return true;
  if (PREVIEW_ORIGIN_REGEX.test(origin)) return true;
  return false;
}

export function corsHeaders(origin: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '600',
    Vary: 'Origin',
  };
  if (origin && originAllowed(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
  }
  return headers;
}

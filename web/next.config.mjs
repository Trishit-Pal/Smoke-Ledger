import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isProd = process.env.NODE_ENV === 'production';

// Per-route base headers. CSP is emitted from middleware so it can include a
// per-request nonce; we only set the static directives here for routes the
// middleware does not run on (e.g. some asset paths).
const baseSecurityHeaders = [
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
  },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
];

const callbackSecurityHeaders = [
  // Recovery / verification token can otherwise leak via Referer to next-page chrome.
  { key: 'Referrer-Policy', value: 'no-referrer' },
];

/** @type {import('next').NextConfig} */
const config = {
  poweredByHeader: false,
  reactStrictMode: true,
  experimental: {
    outputFileTracingRoot: path.join(__dirname, '..'),
  },
  async headers() {
    return [
      { source: '/(.*)', headers: baseSecurityHeaders },
      { source: '/auth/callback', headers: callbackSecurityHeaders },
      { source: '/reset-password', headers: callbackSecurityHeaders },
    ];
  },
  webpack(webpackConfig) {
    // Shared `../src` imports resolve modules from their file path upward, so on
    // Vercel (install only in web/) packages like dayjs/zod in web/node_modules
    // are missed unless we prefer web/node_modules explicitly.
    webpackConfig.resolve.modules = [
      path.resolve(__dirname, 'node_modules'),
      ...(webpackConfig.resolve.modules ?? ['node_modules']),
    ];
    webpackConfig.resolve.alias = {
      ...webpackConfig.resolve.alias,
      // Shim RN-only modules with web equivalents so the shared `src/`
      // domain/repository code runs unmodified inside Next.js.
      [path.resolve(__dirname, '../src/lib/supabase')]: path.resolve(
        __dirname,
        './lib/supabase/client',
      ),
      [path.resolve(__dirname, '../src/lib/secureStore')]: path.resolve(__dirname, './lib/storage'),
      [path.resolve(__dirname, '../src/lib/haptics')]: path.resolve(__dirname, './lib/haptics'),
      [path.resolve(__dirname, '../src/hooks/useTheme')]: path.resolve(
        __dirname,
        './hooks/useTheme',
      ),
      [path.resolve(__dirname, '../src/hooks/useReduceMotion')]: path.resolve(
        __dirname,
        './hooks/useReduceMotion',
      ),
    };
    return webpackConfig;
  },
};

void isProd;

export default config;

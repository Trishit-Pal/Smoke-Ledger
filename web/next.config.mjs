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
  // Cross-origin isolation: no opener handle for other origins, and other sites
  // cannot embed our responses. The app has no OAuth popup or cross-site embeds.
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  { key: 'Cross-Origin-Resource-Policy', value: 'same-origin' },
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

// The confirm page carries a token in its URL but also POSTs a server action.
// no-referrer would make a pre-hydration form POST send `Origin: null`, which
// Next 14.2 answers with a 500; same-origin still hides the URL from other sites.
const confirmSecurityHeaders = [{ key: 'Referrer-Policy', value: 'same-origin' }];

/** @type {import('next').NextConfig} */
const config = {
  poweredByHeader: false,
  reactStrictMode: true,
  // Vercel Skew Protection: stamp client asset / RSC / server-action requests
  // with the build's deployment id so a browser running an older build routes
  // to the deployment its code came from — eliminating the server-action /
  // chunk version-mismatch that made post-write revalidation throw (surfacing
  // a false "log not saved" error and leaving the router cache stale).
  // Enable "Skew Protection" in the Vercel project settings to complete this.
  deploymentId: process.env.VERCEL_DEPLOYMENT_ID,
  // Stable (top-level) since Next 15; was experimental.outputFileTracingRoot in 14.
  outputFileTracingRoot: path.join(__dirname, '..'),
  eslint: {
    dirs: ['app', 'components', 'hooks', 'lib'],
  },
  // `next dev` only (ignored by builds). By default dev keeps 5 compiled pages for
  // 60 s, so a 20-minute e2e run recompiles each route on every revisit and client
  // navigations stall for seconds. The Playwright web server sets this flag to keep
  // every page warm; ordinary local dev keeps the lighter default.
  ...(process.env.NEXT_DEV_KEEP_PAGES === '1'
    ? { onDemandEntries: { maxInactiveAge: 60 * 60 * 1000, pagesBufferLength: 100 } }
    : {}),
  async headers() {
    return [
      { source: '/(.*)', headers: baseSecurityHeaders },
      { source: '/auth/callback', headers: callbackSecurityHeaders },
      { source: '/auth/confirm', headers: confirmSecurityHeaders },
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
      dayjs: path.resolve(__dirname, 'node_modules/dayjs'),
      zod: path.resolve(__dirname, 'node_modules/zod'),
      // Shim RN-only modules with web equivalents so the shared `src/`
      // domain/repository code runs unmodified inside Next.js.
      [path.resolve(__dirname, '../src/lib/supabase')]: path.resolve(
        __dirname,
        './lib/supabase/client',
      ),
      [path.resolve(__dirname, '../src/lib/secureStore')]: path.resolve(__dirname, './lib/storage'),
      [path.resolve(__dirname, '../src/lib/catalogStorageNative')]: path.resolve(
        __dirname,
        './lib/catalogStorageNative',
      ),
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

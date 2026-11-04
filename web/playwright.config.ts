import { defineConfig, devices } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Load web/.env.e2e (gitignored) if present — dependency-free KEY=VALUE parser so
// authenticated/functional E2E can pick up the prod Supabase target + service role
// without committing secrets or adding a dotenv dependency. Existing env wins.
try {
  const raw = readFileSync(resolve(__dirname, '.env.e2e'), 'utf8');
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = val;
  }
} catch {
  // No .env.e2e — fine; smoke runs against the local-stack defaults below.
}

const port = 4173;

// Functional E2E targets whatever Supabase the E2E_* / NEXT_PUBLIC_* env points at
// (prod for the authenticated suite). Falls back to local-stack placeholders so the
// unauthenticated smoke suite runs with no configuration.
const supabaseUrl =
  process.env.E2E_SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321';
const supabaseAnonKey =
  process.env.E2E_SUPABASE_ANON_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  'playwright-anon-key';

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  retries: process.env.CI ? 1 : 0,
  // Functional run only: compile the app's routes once up front. The responsive
  // matrix warms per worker inside responsive.spec.ts.
  globalSetup: process.env.E2E_RESPONSIVE ? undefined : './e2e/_helpers/global-setup.ts',
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    trace: 'on-first-retry',
  },
  webServer: {
    // Dev server, not `next start`: production CSP sends upgrade-insecure-requests,
    // and WebKit then rewrites every http://127.0.0.1 asset to https and renders
    // the page unstyled (verified 2026-11-01). The responsive spec warms routes first.
    command: `npm run dev -- --port ${port}`,
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      ...process.env,
      NEXT_PUBLIC_SUPABASE_URL: supabaseUrl,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: supabaseAnonKey,
    },
  },
  // Default: one desktop Chromium project runs the functional specs. E2E_RESPONSIVE=1
  // swaps in the cross-browser/device matrix that runs only the responsive spec,
  // so the 10 functional specs never multiply across browsers (CI minutes) —
  // see the `responsive-e2e` CI job.
  projects: process.env.E2E_RESPONSIVE
    ? [
        { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'] } }, // + Edge (Chromium)
        { name: 'desktop-firefox', use: { ...devices['Desktop Firefox'] } },
        { name: 'mobile-chrome', use: { ...devices['Pixel 7'] } },
        { name: 'mobile-safari', use: { ...devices['iPhone 14'] } },
        { name: 'tablet-safari', use: { ...devices['iPad Pro 11'] } },
      ].map((p) => ({ ...p, testMatch: /responsive\.spec\.ts/ }))
    : [{ name: 'chromium', use: { ...devices['Desktop Chrome'] }, testIgnore: /responsive\.spec\.ts/ }],
});

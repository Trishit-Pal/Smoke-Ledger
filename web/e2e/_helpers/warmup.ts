/**
 * Route warm-up for the e2e dev server. `next dev` compiles each route on its first
 * request, and a cold compile inside a spec shows up as `page.goto: net::ERR_ABORTED`
 * or a missed 5s `toBeVisible`. Warm once, before the specs.
 *
 * Two halves, because middleware redirects a signed-out request to /login before the
 * page module is ever built:
 *  - `warmSignedOut`: plain GETs; compiles middleware and the public pages.
 *  - `warmSignedIn`: signs a throwaway seeded user in and visits the app pages, so
 *    they really compile. Local Supabase stack only, never a hosted project.
 */
import { chromium, request } from '@playwright/test';
import { login } from './fixtures';
import {
  canSeed,
  createConfirmedUser,
  deleteUser,
  isLocalStack,
  istYmdDaysAgo,
  markConsentOutdated,
  markOnboarded,
} from './seed';

const WARM_TIMEOUT_MS = 120_000;

/** Pages the functional specs open as an onboarded reader (D4). */
const SIGNED_IN_ROUTES = ['/dashboard', '/trends', '/history', '/goals', '/settings', '/log/new', '/privacy'];

/** Signed-out GETs. A redirect or error is fine: the compile is what we want. */
export async function warmSignedOut(baseURL: string, routes: readonly string[]): Promise<void> {
  const ctx = await request.newContext({ baseURL });
  try {
    for (const route of routes) {
      await ctx.get(route, { timeout: WARM_TIMEOUT_MS, maxRedirects: 0 }).catch(() => undefined);
    }
  } finally {
    await ctx.dispose();
  }
}

/**
 * Compile the app pages a signed-in reader sees. No-op unless the stack is local and
 * seedable. /consent only renders for a reader with stale consents (a current reader
 * is bounced home), so the same user is made stale for the last visit.
 */
export async function warmSignedIn(baseURL: string): Promise<void> {
  if (!canSeed() || !isLocalStack()) return;
  const user = await createConfirmedUser('warm');
  const browser = await chromium.launch();
  try {
    await markOnboarded(user.id, { onboardedAt: istYmdDaysAgo(400), baselinePerDay: 10 });
    const page = await browser.newPage({ baseURL });
    await login(page, user);
    for (const route of SIGNED_IN_ROUTES) {
      await page.goto(route, { timeout: WARM_TIMEOUT_MS }).catch(() => undefined);
    }
    await markConsentOutdated(user.id);
    await page.goto('/consent', { timeout: WARM_TIMEOUT_MS }).catch(() => undefined);
  } finally {
    await browser.close();
    await deleteUser(user.id);
  }
}

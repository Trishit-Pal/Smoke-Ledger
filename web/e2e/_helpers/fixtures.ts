/**
 * Playwright fixtures for authenticated, auto-cleaned E2E (functional suite → prod).
 *
 * - `seeded`: a FRESH, confirmed, un-onboarded user with one brand pre-favorited
 *   (the onboarding wizard's "Finish setup" is disabled at 0 favorites). Use for
 *   the onboarding walkthrough.
 * - `onboarded`: a confirmed user already past onboarding (consents + onboarded_at
 *   stamped ~400 days back so the dashboard summary covers the full 365-day window)
 *   that lands on /dashboard after login. Specs seed their own logs via `seedLogs`.
 *
 * Both tear the user down (CASCADE) afterwards. Specs must gate with
 * `test.skip(!canSeed(), …)` at the describe top so fixtures never run unconfigured.
 */
import { test as base, expect, type Page } from '@playwright/test';
import {
  createConfirmedUser,
  deleteUser,
  markOnboarded,
  seedFavoriteBrand,
  istYmdDaysAgo,
  type SeededUser,
} from './seed';

export interface FreshUser extends SeededUser {
  favoriteBrand: string | null;
}

interface Fixtures {
  seeded: FreshUser;
  onboarded: SeededUser;
}

export const test = base.extend<Fixtures>({
  seeded: async ({}, use) => {
    const user = await createConfirmedUser('fresh');
    const favoriteBrand = await seedFavoriteBrand(user.id);
    try {
      await use({ ...user, favoriteBrand });
    } finally {
      await deleteUser(user.id);
    }
  },
  onboarded: async ({}, use) => {
    const user = await createConfirmedUser('onb');
    // Onboarded far in the past so summarySinceYmd = the 365-day floor → seeded
    // history (within a year) shows on the dashboard.
    await markOnboarded(user.id, { onboardedAt: istYmdDaysAgo(400), baselinePerDay: 10 });
    try {
      await use(user);
    } finally {
      await deleteUser(user.id);
    }
  },
});

export { expect };

/** Sign in through the real login form and wait for the post-login route. */
export async function login(page: Page, user: { email: string; password: string }): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Email').fill(user.email);
  await page.getByLabel('Password').fill(user.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL(/\/(dashboard|onboarding)/, { timeout: 30_000 });
}

/**
 * Walk the current onboarding wizard (privacy → usage → goal → brands → done) for a
 * fresh user. Requires a brand to already be favorited (the `seeded` fixture does
 * this) since "Finish setup" is disabled at 0 favorites. Uses the "Stamp all
 * consents" shortcut so it's robust to consent-copy changes. Leaves on /onboarding/done.
 */
export async function completeOnboarding(page: Page, opts: { baseline?: string } = {}): Promise<void> {
  await expect(page).toHaveURL(/\/onboarding\/privacy/);
  await page.getByRole('button', { name: 'Stamp all consents' }).click();
  await page.getByRole('button', { name: /Continue/ }).click();

  await expect(page).toHaveURL(/\/onboarding\/usage/);
  await page.getByLabel('Sticks per day').fill(opts.baseline ?? '8');
  await page.getByRole('button', { name: /Continue/ }).click();

  await expect(page).toHaveURL(/\/onboarding\/goal/);
  await page.getByRole('button', { name: /Skip for now/ }).click();

  await expect(page).toHaveURL(/\/onboarding\/brands/);
  await page.getByRole('button', { name: /Finish setup/ }).click();

  await expect(page).toHaveURL(/\/onboarding\/done/);
}

/**
 * Playwright fixtures for authenticated, auto-cleaned E2E.
 *
 * The `seeded` fixture creates a fresh confirmed throwaway user before the test
 * and deletes it (CASCADE) afterwards. Specs that use it must gate themselves
 * with `test.skip(!canSeed(), …)` at the describe top so the fixture never runs
 * (and never touches prod) when service-role creds are absent.
 */
import { test as base, expect, type Page } from '@playwright/test';
import { createConfirmedUser, deleteUser, type SeededUser } from './seed';

interface Fixtures {
  /** A fresh, confirmed, UN-onboarded throwaway user, torn down after the test. */
  seeded: SeededUser;
}

export const test = base.extend<Fixtures>({
  seeded: async ({}, use) => {
    const user = await createConfirmedUser('flow');
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
 * Walk the current onboarding wizard (privacy → usage → goal → brands → done)
 * for a fresh user. Uses the "Stamp all consents" shortcut so it is robust to
 * consent-copy changes. Leaves the page on /onboarding/done.
 */
export async function completeOnboarding(page: Page, opts: { baseline?: string } = {}): Promise<void> {
  // privacy
  await expect(page).toHaveURL(/\/onboarding\/privacy/);
  await page.getByRole('button', { name: 'Stamp all consents' }).click();
  await page.getByRole('button', { name: /Continue/ }).click();

  // usage
  await expect(page).toHaveURL(/\/onboarding\/usage/);
  await page.getByLabel('Sticks per day').fill(opts.baseline ?? '8');
  await page.getByRole('button', { name: /Continue/ }).click();

  // goal — skip for now (keeps the wizard fast; onboarding.spec covers a real goal)
  await expect(page).toHaveURL(/\/onboarding\/goal/);
  await page.getByRole('button', { name: /Skip for now/ }).click();

  // brands
  await expect(page).toHaveURL(/\/onboarding\/brands/);
  await page.getByRole('button', { name: /Finish setup/ }).click();

  await expect(page).toHaveURL(/\/onboarding\/done/);
}

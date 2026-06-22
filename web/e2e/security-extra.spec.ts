import { test, expect } from '@playwright/test';

// Web hardening (unauthenticated — runs in smoke, no creds): every protected app
// route must bounce a signed-out visitor to /login, and a bad login must not
// create a session. Complements security.spec.ts.
const PROTECTED_ROUTES = ['/dashboard', '/trends', '/settings', '/log/new', '/history'];

test.describe('web hardening — protected routes & auth errors', () => {
  for (const route of PROTECTED_ROUTES) {
    test(`unauthenticated ${route} redirects to /login`, async ({ page }) => {
      await page.goto(route);
      await expect(page).toHaveURL(/\/login/);
    });
  }

  test('wrong password keeps the user on /login and creates no session', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill('nobody-e2e@smoke-ledger-e2e.test');
    await page.getByLabel('Password').fill('definitely-wrong-password');
    await page.getByRole('button', { name: 'Sign in' }).click();

    await expect(page).toHaveURL(/\/login/);
    // No session was created — a protected route still redirects.
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/);
  });
});

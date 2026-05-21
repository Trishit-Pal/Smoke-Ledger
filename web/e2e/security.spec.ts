import { test, expect } from '@playwright/test';

const loginEmail = process.env.E2E_LOGIN_EMAIL;
const loginPassword = process.env.E2E_LOGIN_PASSWORD;

test('protected routes redirect unauthenticated users to login', async ({ page }) => {
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/login/);
});

test('auth callback rejects open redirect', async ({ page }) => {
  await page.goto('/auth/callback?next=//evil.com');
  await expect(page).not.toHaveURL(/evil\.com/);
});

test('security headers include CSP and frame denial', async ({ page }) => {
  const res = await page.goto('/');
  expect(res?.headers()['content-security-policy']).toBeTruthy();
  expect(res?.headers()['x-frame-options']).toBe('DENY');
});

test('signup page shows age acknowledgment', async ({ page }) => {
  await page.goto('/signup');
  await expect(page.getByText(/18 or older/i)).toBeVisible();
});

test('login page shows keep me signed in option', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByText(/keep me signed in/i)).toBeVisible();
});

test('password login without remember-me sets session-only auth cookies', async ({
  page,
  context,
}) => {
  test.skip(
    !loginEmail || !loginPassword,
    'Set E2E_LOGIN_EMAIL and E2E_LOGIN_PASSWORD to run.',
  );

  await page.goto('/login');
  await page.getByLabel('Email').fill(loginEmail!);
  await page.getByLabel('Password').fill(loginPassword!);
  await page.getByRole('checkbox', { name: /keep me signed in/i }).uncheck();
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL(/\/(dashboard|onboarding)/);

  const cookies = await context.cookies();
  const authCookies = cookies.filter((c) => c.name.includes('-auth-token'));
  expect(authCookies.length).toBeGreaterThan(0);
  for (const cookie of authCookies) {
    expect(cookie.expires, `${cookie.name} should be session cookie`).toBe(-1);
  }
});

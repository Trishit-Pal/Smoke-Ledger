import { test, expect } from '@playwright/test';

const loginEmail = process.env.E2E_LOGIN_EMAIL;
const loginPassword = process.env.E2E_LOGIN_PASSWORD;

test('password sign-in submits via server action and lands on a post-auth route', async ({
  page,
  context,
}) => {
  test.skip(
    !loginEmail || !loginPassword,
    'Set E2E_LOGIN_EMAIL and E2E_LOGIN_PASSWORD to run.',
  );

  await page.goto('/login?next=%2Fdashboard');
  await page.getByLabel('Email').fill(loginEmail!);
  await page.getByLabel('Password').fill(loginPassword!);

  // The form must POST to the same /login URL (Next.js server action target).
  // If the page ever regresses to a client fetch, this expectation fails
  // because no document-level request fires.
  const [response] = await Promise.all([
    page.waitForResponse(
      (res) => res.request().method() === 'POST' && /\/login(\?|$)/.test(res.url()),
      { timeout: 10_000 },
    ),
    page.getByRole('button', { name: /sign in/i }).click(),
  ]);
  expect([200, 303, 302]).toContain(response.status());

  await page.waitForURL(/\/(dashboard|onboarding)/, { timeout: 15_000 });

  const cookies = await context.cookies();
  expect(
    cookies.some((c) => /-auth-token($|\.)/.test(c.name)),
    'expected an sb-…-auth-token cookie to be set after sign-in',
  ).toBe(true);
});

test('landing page links are visible', async ({ page }) => {
  await page.goto('/');
  await expect(
    page.getByRole('heading', {
      name: 'Know every stick. Spend less. Quit on your terms.',
    }),
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: 'What you get, in four plates.' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Begin the ledger' }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: 'Sign in' }).first()).toBeVisible();
});

test('auth pages render expected fields', async ({ page }) => {
  await page.goto('/signup');
  await expect(page.getByLabel('Email')).toBeVisible();
  await expect(page.getByLabel('Password', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Confirm password', { exact: true })).toBeVisible();
  await expect(page.getByText(/I am 18 or older/i)).toBeVisible();
  await expect(page.locator('form').getByRole('link', { name: 'Terms' })).toBeVisible();
  await expect(page.locator('form').getByRole('link', { name: 'Privacy Policy' })).toBeVisible();

  await page.goto('/login');
  await expect(page.getByLabel('Email')).toBeVisible();
  await expect(page.getByLabel('Password', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();

  await page.goto('/reset');
  await expect(page.getByRole('button', { name: 'Send reset link' })).toBeVisible();
});

test('legal and support pages are publicly reachable', async ({ page }) => {
  await page.goto('/privacy');
  await expect(page.getByRole('heading', { name: 'Privacy Policy' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Our data promises' })).toBeVisible();

  await page.goto('/terms', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Terms of Service' })).toBeVisible();

  await page.goto('/support');
  await expect(page.getByRole('heading', { name: 'How can we help?' })).toBeVisible();
});

test('go to homepage link navigates from public pages', async ({ page }) => {
  const homeLink = page.getByRole('link', { name: 'Go to Smoke Ledger homepage' });

  await page.goto('/privacy');
  await expect(homeLink).toBeVisible();
  await homeLink.click();
  await expect(page).toHaveURL('/');
  await expect(
    page.getByRole('heading', {
      name: 'Know every stick. Spend less. Quit on your terms.',
    }),
  ).toBeVisible();

  await page.goto('/support');
  await homeLink.click();
  await expect(page).toHaveURL('/');
});

test('go to homepage link is hidden on landing page', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('link', { name: 'Go to Smoke Ledger homepage' })).toHaveCount(0);
});

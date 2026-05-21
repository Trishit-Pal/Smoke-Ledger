import { test, expect } from '@playwright/test';

test('landing page links are visible', async ({ page }) => {
  await page.goto('/');
  await expect(
    page.getByRole('heading', {
      name: 'Know every stick. Spend less. Quit on your terms.',
    }),
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: 'What you get for free' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Create free account' }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: 'Sign in' }).first()).toBeVisible();
  await expect(
    page.getByRole('button', { name: /switch to (light|dark) mode/i }),
  ).toBeVisible();
});

test('auth pages render expected fields', async ({ page }) => {
  await page.goto('/signup');
  await expect(page.getByLabel('Email')).toBeVisible();
  await expect(page.getByLabel('Password', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Confirm password', { exact: true })).toBeVisible();
  await expect(page.getByText(/18 or older/i)).toBeVisible();
  await expect(page.locator('form').getByRole('link', { name: 'Terms' })).toBeVisible();
  await expect(page.locator('form').getByRole('link', { name: 'Privacy Policy' })).toBeVisible();

  await page.goto('/login');
  await expect(page.getByLabel('Email')).toBeVisible();
  await expect(page.getByLabel('Password')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
  await expect(
    page.getByRole('button', { name: /switch to (light|dark) mode/i }),
  ).toBeVisible();

  await page.goto('/reset');
  await expect(page.getByRole('button', { name: 'Send reset link' })).toBeVisible();
});

test('legal and support pages are publicly reachable', async ({ page }) => {
  await page.goto('/privacy');
  await expect(page.getByRole('heading', { name: 'Privacy Policy' })).toBeVisible();

  await page.goto('/terms', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Terms of Service' })).toBeVisible();

  await page.goto('/support');
  await expect(page.getByRole('heading', { name: 'Contact Smoke Ledger' })).toBeVisible();
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

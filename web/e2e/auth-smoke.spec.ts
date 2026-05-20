import { test, expect } from '@playwright/test';

test('landing page links are visible', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Reduce smoking with consistent, private tracking.' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Create account' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Sign in' })).toBeVisible();
});

test('auth pages render expected fields', async ({ page }) => {
  await page.goto('/signup');
  await expect(page.getByLabel('Email')).toBeVisible();
  await expect(page.getByLabel('Password', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Confirm password', { exact: true })).toBeVisible();
  await expect(page.getByText(/I confirm I am 18/)).toBeVisible();
  await expect(page.getByRole('link', { name: 'Terms of Service' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Privacy Policy' })).toBeVisible();

  await page.goto('/login');
  await expect(page.getByLabel('Email')).toBeVisible();
  await expect(page.getByLabel('Password')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();

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

import { test, expect, Page } from '@playwright/test';

const loginEmail = process.env.E2E_LOGIN_EMAIL;
const loginPassword = process.env.E2E_LOGIN_PASSWORD;

async function completeOnboarding(page: Page) {
  await page.getByLabel('I confirm I am 18 or older.').check();
  await page.getByLabel(/I agree to the/).check();
  await page.getByLabel(/I acknowledge the/).check();
  await page.getByLabel(/I understand this app does not provide medical advice/).check();
  await page.getByLabel(/I consent to processing my data/).check();
  await page.getByRole('button', { name: 'Continue' }).click();

  await expect(page).toHaveURL(/\/onboarding\/setup/);
  await page.getByRole('button', { name: '10–15' }).click();
  await page.getByRole('button', { name: 'Mix of both' }).click();
  await page.getByRole('button', { name: 'Continue' }).click();

  await expect(page).toHaveURL(/\/onboarding\/baseline/);
  await page.getByLabel('Baseline - sticks per day').fill('8');
  await page.getByRole('button', { name: 'Continue' }).click();

  await expect(page).toHaveURL(/\/onboarding\/goal/);
  await page.getByRole('button', { name: 'Skip' }).click();

  await expect(page).toHaveURL(/\/onboarding\/brands/);
  await page.getByRole('button', { name: 'Finish onboarding' }).click();
}

test.describe('authenticated flows', () => {
  test('signup/login onboarding and product flows', async ({ page }) => {
    test.skip(!loginEmail || !loginPassword, 'Set E2E_LOGIN_EMAIL and E2E_LOGIN_PASSWORD to run.');

    await page.goto('/login');
    await page.getByLabel('Email').fill(loginEmail!);
    await page.getByLabel('Password').fill(loginPassword!);
    await page.getByRole('button', { name: 'Sign in' }).click();

    await page.waitForLoadState('networkidle');

    if (page.url().includes('/onboarding/privacy')) {
      await completeOnboarding(page);
      await expect(page).toHaveURL(/\/dashboard/);
    }

    await page.goto('/log/new');
    await expect(page.getByRole('heading', { name: 'Log smoke' })).toBeVisible();
    await page.getByRole('button', { name: 'Save log' }).click();
    await expect(page).not.toHaveURL(/\/log\/new/);

    await page.goto('/trends');
    await expect(page.getByRole('heading', { name: 'Trends' })).toBeVisible();

    await page.goto('/settings');
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();

    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: /Export data \(JSON\)/ }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toContain('smoke-ledger-export');

    page.once('dialog', async (dialog) => {
      expect(dialog.message()).toContain('Erase all app data');
      await dialog.dismiss();
    });
    await page.getByRole('button', { name: 'Erase all app data' }).click();

    page.once('dialog', async (dialog) => {
      expect(dialog.message()).toContain('Delete your account permanently');
      await dialog.dismiss();
    });
    await page.getByRole('button', { name: 'Delete account' }).click();
  });
});

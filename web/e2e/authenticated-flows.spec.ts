import { test, expect, login, completeOnboarding } from './_helpers/fixtures';
import { canSeed } from './_helpers/seed';

// End-to-end happy path on a fresh, auto-torn-down throwaway user:
//   login → onboarding wizard → dashboard → log entry → trends → settings export.
// Skips unless the service-role seeding env is configured (see web/.env.e2e.example).

test.describe('authenticated flows', () => {
  test.skip(!canSeed(), 'Set SUPABASE_SERVICE_ROLE_KEY + E2E_SUPABASE_URL/ANON_KEY to run.');

  test('onboarding → dashboard → log → trends → settings', async ({ page, seeded }) => {
    // A fresh confirmed user routes into onboarding on first sign-in.
    await login(page, seeded);
    await expect(page).toHaveURL(/\/onboarding\/privacy/);

    await completeOnboarding(page, { baseline: '8' });

    // Land on the dashboard and confirm the timeframe hub rendered.
    await page.goto('/dashboard');
    await expect(page.getByRole('tablist', { name: 'Time frame' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Week' })).toBeVisible();

    // Log a multi-quantity entry — Save is disabled until a brand is chosen.
    await page.goto('/log/new');
    await page.getByRole('group', { name: 'Brand' }).getByRole('button').first().click();
    await page.getByLabel('Quantity').fill('3');
    await page.getByRole('button', { name: 'Save log' }).click();
    await expect(page).not.toHaveURL(/\/log\/new/);

    // Trends renders.
    await page.goto('/trends');
    await expect(page.getByRole('tab', { name: 'Week' })).toBeVisible();

    // Settings export downloads a file.
    await page.goto('/settings');
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: /Export data \(JSON\)/ }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toContain('smoke-ledger-export');
  });
});

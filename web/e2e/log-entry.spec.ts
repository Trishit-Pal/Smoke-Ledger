import { test, expect, login } from './_helpers/fixtures';
import { canSeed } from './_helpers/seed';

test.describe('log entry', () => {
  test.skip(!canSeed(), 'Set SUPABASE_SERVICE_ROLE_KEY + E2E_SUPABASE_URL/ANON_KEY to run.');

  test('a multi-quantity log appears in today\'s dashboard total', async ({ page, onboarded }) => {
    await login(page, onboarded);

    await page.goto('/log/new');
    // Save is disabled until a brand is chosen.
    await page.getByRole('group', { name: 'Brand' }).getByRole('button').first().click();
    await page.getByLabel('Quantity').fill('3');
    await page.getByRole('button', { name: 'Save log' }).click();
    await expect(page).not.toHaveURL(/\/log\/new/);

    // The onboarded fixture seeds no logs, so today is exactly the 3 just logged.
    await page.goto('/dashboard');
    await expect(page.getByLabel('3 cigarettes today', { exact: true })).toBeVisible();
  });
});

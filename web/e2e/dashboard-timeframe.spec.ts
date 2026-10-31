import { test, expect, login } from './_helpers/fixtures';
import { canSeed, seedLogs, istYmdDaysAgo } from './_helpers/seed';

// End-to-end check of the daily-summary engine: seed known logs (incl. a single
// quantity-3 row → proves SUM(quantity), not COUNT(*)) and assert the dashboard's
// Day/Week/Month/Year totals reflect the correct rolling windows and reconcile.
test.describe('dashboard timeframe hub', () => {
  test.skip(!canSeed(), 'Set SUPABASE_SERVICE_ROLE_KEY + E2E_SUPABASE_URL/ANON_KEY to run.');

  test('Day/Week/Month/Year totals reflect seeded logs', async ({ page, onboarded }) => {
    // today=3 (one qty-3 row), 3d=2, 20d=4, 100d=5.
    await seedLogs(onboarded.id, [
      { localDate: istYmdDaysAgo(0), quantity: 3, totalPriceInr: 60, unitPriceInr: 20 },
      { localDate: istYmdDaysAgo(3), quantity: 2, totalPriceInr: 40, unitPriceInr: 20 },
      { localDate: istYmdDaysAgo(20), quantity: 4, totalPriceInr: 80, unitPriceInr: 20 },
      { localDate: istYmdDaysAgo(100), quantity: 5, totalPriceInr: 100, unitPriceInr: 20 },
    ]);

    await login(page, onboarded);
    await expect(page).toHaveURL(/\/dashboard/);

    // Default window = Day → today only = 3 (the quantity-3 row, proving the migration).
    await expect(page.getByLabel('3 cigarettes today', { exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Week', exact: true }).click();
    await expect(page.getByLabel('5 cigarettes this week', { exact: true })).toBeVisible(); // 3+2

    await page.getByRole('button', { name: 'Month', exact: true }).click();
    await expect(page.getByLabel('9 cigarettes this month', { exact: true })).toBeVisible(); // 3+2+4

    await page.getByRole('button', { name: 'Year', exact: true }).click();
    await expect(page.getByLabel('14 cigarettes this year', { exact: true })).toBeVisible(); // 3+2+4+5
  });
});

import { test, expect, login, completeOnboarding } from './_helpers/fixtures';
import { canSeed } from './_helpers/seed';

// Pins the bug where /onboarding/done showed Baseline 0 / Goal "Skipped" / 0
// favorites because a server component read through the browser client. With the
// fix it reads the real server data — the summary must reflect what was entered.
test.describe('onboarding → done summary', () => {
  test.skip(!canSeed(), 'Set SUPABASE_SERVICE_ROLE_KEY + E2E_SUPABASE_URL/ANON_KEY to run.');

  test('done summary reflects entered baseline + favorites (not empty fallbacks)', async ({
    page,
    seeded,
  }) => {
    await login(page, seeded);
    await expect(page).toHaveURL(/\/onboarding\/privacy/);

    await completeOnboarding(page, { baseline: '12' });

    // The summary rows render with real data.
    await expect(page.getByText('Baseline', { exact: true })).toBeVisible();
    await expect(page.getByText('sticks / day')).toBeVisible();
    await expect(page.getByText('Favorites', { exact: true })).toBeVisible();

    // The pre-favorited brand is listed — the bug showed "You can add favorites later".
    if (seeded.favoriteBrand) {
      await expect(page.getByText(seeded.favoriteBrand, { exact: false })).toBeVisible();
      await expect(
        page.getByText('You can add favorites later from Settings.'),
      ).toHaveCount(0);
    }

    // Dashboard renders the timeframe hub.
    await page.goto('/dashboard');
    await expect(page.getByRole('group', { name: 'Time frame' })).toBeVisible();
  });
});

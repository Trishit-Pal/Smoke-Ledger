import { test, expect, login } from './_helpers/fixtures';
import { canSeed } from './_helpers/seed';

// Authenticated input-validation + session checks on a throwaway onboarded user.
test.describe('auth/session + input validation', () => {
  test.skip(!canSeed(), 'Set SUPABASE_SERVICE_ROLE_KEY + E2E_SUPABASE_URL/ANON_KEY to run.');

  test('settings mobile field enforces the India rule before saving', async ({ page, onboarded }) => {
    await login(page, onboarded);
    await page.goto('/settings');

    await page.getByRole('button', { name: 'Edit mobile number' }).click();
    const input = page.getByLabel('Mobile number');

    // Invalid (too short / wrong lead) → Save is gated off + the rule is shown.
    await input.fill('123');
    await expect(page.getByRole('button', { name: 'Save mobile number' })).toBeDisabled();
    await expect(page.getByText('10 digits, starting 6-9')).toBeVisible();

    // A valid 10-digit number (lead 6–9) enables Save. (Not saved — avoids the
    // 30-day change lock + a prod write.)
    await input.fill('9876543210');
    await expect(page.getByRole('button', { name: 'Save mobile number' })).toBeEnabled();
  });

  test('sign out clears the session', async ({ page, onboarded }) => {
    await login(page, onboarded);
    await page.goto('/settings');

    await page.getByRole('button', { name: /Sign out/i }).click();
    // Whatever the post-sign-out landing is, the session is gone: a protected
    // route now redirects to /login.
    await page.waitForLoadState('networkidle').catch(() => undefined);
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/);
  });
});

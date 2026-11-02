/**
 * The account-deletion contract, end to end, on throwaway accounts:
 *
 *   1. Confirming deletion with a fresh sign-in really deletes the account —
 *      the same email + password no longer sign in afterwards.
 *   2. The re-auth resume (`/settings?action=delete`, where the login detour
 *      returns) re-confirms with distinct copy, and cancelling says plainly
 *      that nothing was deleted. A sign-in alone never deletes an account.
 *
 * The `reauth_required` branch itself cannot be aged here (15-minute `amr`
 * window); it is covered by src/tests/edge-recent-auth.test.ts and the source
 * guards in src/tests/reauth-route.test.ts.
 *
 * Hits the live delete-account edge function: run against the e2e/staging
 * project only. Skipped without the seed env (service role + url + anon).
 */
import { test, expect, login } from './_helpers/fixtures';
import { canSeed } from './_helpers/seed';

test.describe('account deletion', () => {
  test.skip(!canSeed(), 'Set SUPABASE_SERVICE_ROLE_KEY + E2E_SUPABASE_URL/ANON_KEY to run.');
  // Each run writes a real compliance.delete audit row for the throwaway user,
  // so this suite is opt-in: it must not hit production by accident.
  test.skip(
    process.env.E2E_ALLOW_ACCOUNT_DELETION !== '1',
    'Set E2E_ALLOW_ACCOUNT_DELETION=1 against the e2e/staging project to run.',
  );

  test('confirming deletion removes the account; the old credentials no longer sign in', async ({
    page,
    onboarded,
  }) => {
    // A fresh password sign-in puts this session inside the re-auth window.
    await login(page, onboarded);
    await page.goto('/settings');
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();

    await page.getByRole('button', { name: 'Delete account — permanent' }).click();
    const dialog = page.getByRole('dialog', { name: /Delete your account permanently/ });
    await dialog.getByRole('button', { name: 'Delete account' }).click();

    // Landing banner confirms; the ?deleted=1 flag is stripped client-side.
    await expect(page.getByText(/Your account and all its data have been deleted/)).toBeVisible({
      timeout: 30_000,
    });

    await page.goto('/login');
    await page.getByLabel('Email').fill(onboarded.email);
    await page.getByLabel('Password', { exact: true }).fill(onboarded.password);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByText(/incorrect/i)).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
    // Fixture teardown tolerates the already-deleted user (deleteUser swallows errors).
  });

  test('the re-auth resume re-confirms, and cancelling says nothing was deleted', async ({
    page,
    onboarded,
  }) => {
    await login(page, onboarded);
    await page.goto('/settings?action=delete');

    const resume = page.getByRole('dialog', { name: /Signed in again/ });
    await expect(resume).toBeVisible();
    await expect(resume).toContainText('Delete the account you just signed in to.');
    // The param is consumed so a reload does not re-open the prompt.
    await expect(page).toHaveURL(/\/settings$/);

    await resume.getByRole('button', { name: 'Cancel' }).click();
    await expect(resume).toHaveCount(0);
    await expect(page.getByText('Your account has not been deleted.')).toBeVisible();

    // Still signed in: the account is intact.
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/dashboard/);
  });
});

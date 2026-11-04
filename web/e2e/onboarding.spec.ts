import type { Page } from '@playwright/test';
import { test, expect, login, completeOnboarding } from './_helpers/fixtures';
import { canSeed, countAuditEvents, listGoalStatuses, readOnboardingStep } from './_helpers/seed';

/* ---------- step helpers (the wizard's own buttons, no shortcuts) ---------- */

async function stampAndContinue(page: Page): Promise<void> {
  await expect(page).toHaveURL(/\/onboarding\/privacy/);
  await page.getByRole('button', { name: 'Stamp all consents' }).click();
  await page.getByRole('checkbox', { name: /explicitly consent/ }).check();
  const noThanks = page.getByRole('button', { name: 'No, thanks' });
  if (await noThanks.isVisible()) await noThanks.click();
  const cont = page.getByRole('button', { name: /Continue/ });
  await expect(cont).toBeEnabled();
  await cont.click();
  await expect(page).toHaveURL(/\/onboarding\/usage/);
}

async function fillUsageAndContinue(page: Page, baseline: string): Promise<void> {
  await expect(page).toHaveURL(/\/onboarding\/usage/);
  await page.getByLabel('Sticks per day').fill(baseline);
  await page.getByRole('button', { name: 'Mostly packs' }).click();
  await page.getByRole('button', { name: /Continue/ }).click();
  await expect(page).toHaveURL(/\/onboarding\/goal/);
}

async function setGoalAndContinue(page: Page, label: string, target?: string): Promise<void> {
  await expect(page).toHaveURL(/\/onboarding\/goal/);
  await page.getByRole('button', { name: `Choose ${label}` }).click();
  if (target) await page.getByRole('spinbutton').fill(target);
  await page.getByRole('button', { name: /Continue/ }).click();
  await expect(page).toHaveURL(/\/onboarding\/brands/);
}

const back = (page: Page) => page.getByRole('button', { name: '← Back' });

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

// Re-entering a step after it was saved: Back, refresh, deep link, re-login.
// Server is the source of truth; the step pointer only moves forward; each
// step's Continue is idempotent.
test.describe('onboarding re-entry keeps saved data in sync', () => {
  test.skip(!canSeed(), 'Set SUPABASE_SERVICE_ROLE_KEY + E2E_SUPABASE_URL/ANON_KEY to run.');

  test('Back through every step and Continue again is idempotent', async ({ page, seeded }) => {
    await login(page, seeded);
    await stampAndContinue(page);
    await fillUsageAndContinue(page, '12');
    await setGoalAndContinue(page, 'Daily cap', '8');
    expect(await readOnboardingStep(seeded.id)).toBe('brands');

    // Brands → Goal: the saved goal is pre-selected and Continue edits it in
    // place (previously: "A goal of this type is already active").
    await back(page).click();
    await expect(page).toHaveURL(/\/onboarding\/goal/);
    await expect(page.getByRole('spinbutton')).toHaveValue('8');
    await expect(page.getByRole('button', { name: 'Keep and continue' })).toBeVisible();
    await page.getByRole('spinbutton').fill('6');
    await page.getByRole('button', { name: /Continue/ }).click();
    await expect(page).toHaveURL(/\/onboarding\/brands/);
    await expect(page.getByRole('alert')).toHaveCount(0);

    // Goal → Usage: the saved baseline is shown, not the default 10.
    await back(page).click();
    await expect(page).toHaveURL(/\/onboarding\/goal/);
    await back(page).click();
    await expect(page).toHaveURL(/\/onboarding\/usage/);
    await expect(page.getByLabel('Sticks per day')).toHaveValue('12');

    // Usage → Privacy: consent is a fresh decision (boxes empty) but re-ticking
    // must not rewrite the consent columns, duplicate the audit, or move the
    // step backwards.
    await back(page).click();
    await expect(page).toHaveURL(/\/onboarding\/privacy/);
    await expect(page.getByRole('checkbox').first()).not.toBeChecked();
    await stampAndContinue(page);
    expect(await readOnboardingStep(seeded.id)).toBe('brands');
    expect(await countAuditEvents(seeded.id, 'consent_accepted')).toBe(1);

    // Forward again through already-saved steps.
    await page.getByRole('button', { name: /Continue/ }).click();
    await expect(page).toHaveURL(/\/onboarding\/goal/);
    await page.getByRole('button', { name: /Continue/ }).click();
    await expect(page).toHaveURL(/\/onboarding\/brands/);

    expect(await readOnboardingStep(seeded.id)).toBe('brands');
    const goals = await listGoalStatuses(seeded.id);
    expect(goals.filter((g) => g.status === 'active')).toEqual([
      { type: 'daily_cap', status: 'active' },
    ]);

    await page.getByRole('button', { name: /Finish setup/ }).click();
    await expect(page).toHaveURL(/\/onboarding\/done/);
    await expect(page.getByText('Daily cap')).toBeVisible();
    expect(await readOnboardingStep(seeded.id)).toBe('done');
  });

  test('refresh on a saved step restores the saved values', async ({ page, seeded }) => {
    await login(page, seeded);
    await stampAndContinue(page);
    await fillUsageAndContinue(page, '12');

    // Direct navigation back to usage (allowed: at or before the saved step).
    await page.goto('/onboarding/usage');
    await expect(page.getByLabel('Sticks per day')).toHaveValue('12');
    // Purchase preference hydrated too: Continue is enabled only once it is set.
    await expect(page.getByRole('button', { name: /Continue/ })).toBeEnabled();

    await page.reload();
    await expect(page.getByLabel('Sticks per day')).toHaveValue('12');
    await expect(page.getByRole('button', { name: /Continue/ })).toBeEnabled();
  });

  test('signing in again mid-wizard resumes at the saved step', async ({ page, seeded }) => {
    await login(page, seeded);
    await stampAndContinue(page);
    await fillUsageAndContinue(page, '9');

    await page.context().clearCookies();
    await login(page, seeded);
    await expect(page).toHaveURL(/\/onboarding\/goal/);
  });

  test('a deep link cannot skip the step that has not been saved', async ({ page, seeded }) => {
    await login(page, seeded);
    await stampAndContinue(page);

    // Step is 'usage': goal is one past it and must bounce back.
    await page.goto('/onboarding/goal');
    await expect(page).toHaveURL(/\/onboarding\/usage/);

    await fillUsageAndContinue(page, '10');
    await page.getByRole('button', { name: /Skip for now/ }).click();
    await expect(page).toHaveURL(/\/onboarding\/brands/);

    // Step is 'brands': done requires Finish.
    await page.goto('/onboarding/done');
    await expect(page).toHaveURL(/\/onboarding\/brands/);
  });

  test('changing the goal type replaces the earlier goal instead of stacking', async ({
    page,
    seeded,
  }) => {
    await login(page, seeded);
    await stampAndContinue(page);
    await fillUsageAndContinue(page, '10');
    await setGoalAndContinue(page, 'Daily cap', '8');

    await back(page).click();
    await setGoalAndContinue(page, 'Spend cap');

    const goals = await listGoalStatuses(seeded.id);
    expect(goals).toEqual([
      { type: 'spend_cap_daily', status: 'active' },
      { type: 'daily_cap', status: 'abandoned' },
    ]);
  });
});

import { test, expect, login } from './_helpers/fixtures';
import {
  canSeed,
  clearConsentStamps,
  countAuditEvents,
  markConsentOutdated,
  readConsentState,
  readOnboardingStep,
} from './_helpers/seed';

// The re-consent gate: an onboarded user whose consents are older than the current
// terms (or who never gave the health-data consent) is asked once, never loops, and
// the answer never moves the onboarding step.

test.describe('re-consent gate', () => {
  test.skip(!canSeed(), 'Set SUPABASE_SERVICE_ROLE_KEY + E2E_SUPABASE_URL/ANON_KEY to run.');

  test('outdated consents land on /consent from any app page, then accepting goes home once', async ({
    page,
    onboarded,
  }) => {
    await markConsentOutdated(onboarded.id);
    const stepBefore = await readOnboardingStep(onboarded.id);
    const auditBefore = await countAuditEvents(onboarded.id, 'consent_accepted');

    await login(page, onboarded);
    await expect(page).toHaveURL(/\/consent$/);

    // A deep link into the app is bounced to the same screen, not to a loop.
    await page.goto('/trends');
    await expect(page).toHaveURL(/\/consent$/);

    // Legal pages stay readable while consents are outdated.
    await page.goto('/privacy');
    await expect(page).toHaveURL(/\/privacy$/);
    await page.goto('/consent');

    // Nothing is pre-ticked, and Accept stays off until every row is answered.
    const accept = page.getByRole('button', { name: /Accept and continue/ });
    await expect(accept).toBeDisabled();
    await page.getByRole('checkbox', { name: /Terms of Service/ }).check();
    await page.getByRole('checkbox', { name: /Privacy Policy/ }).check();
    await page.getByRole('checkbox', { name: /does not provide medical advice/ }).check();
    await expect(accept).toBeDisabled();
    await page.getByRole('checkbox', { name: /explicitly consent/ }).check();
    await expect(accept).toBeEnabled();
    await accept.click();

    await expect(page).toHaveURL(/\/dashboard/);
    const state = await readConsentState(onboarded.id);
    expect(state.terms_version).not.toBe('2020-01-01');
    expect(state.health_data_consent_at).not.toBeNull();
    expect(await countAuditEvents(onboarded.id, 'consent_accepted')).toBe(auditBefore + 1);
    // Asking again never touches the wizard pointer.
    expect(await readOnboardingStep(onboarded.id)).toBe(stepBefore);

    // Current now: /consent sends the reader home instead of asking again.
    await page.goto('/consent');
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('Not now leads to Settings (export and withdraw) and stays reachable, with no loop', async ({
    page,
    onboarded,
  }) => {
    await markConsentOutdated(onboarded.id);
    await login(page, onboarded);
    await expect(page).toHaveURL(/\/consent$/);

    await page.getByRole('link', { name: /Not now/ }).click();
    await expect(page).toHaveURL(/\/settings/);
    await expect(page.getByRole('button', { name: /Export data \(JSON\)/ })).toBeVisible();

    // The rest of the app is still closed.
    await page.goto('/history');
    await expect(page).toHaveURL(/\/consent$/);
  });

  test('an onboarded reader missing age and data-processing stamps is asked on /consent, never in the wizard', async ({
    page,
    onboarded,
  }) => {
    await clearConsentStamps(onboarded.id);
    const stepBefore = await readOnboardingStep(onboarded.id);
    const auditBefore = await countAuditEvents(onboarded.id, 'consent_accepted');

    await login(page, onboarded);
    await expect(page).toHaveURL(/\/consent$/);
    // Their documents are current, so they are not told the terms changed.
    await expect(page.getByRole('heading', { name: 'Before you continue.' })).toBeVisible();
    // The wizard's own pages send them to the same screen, not into a loop.
    await page.goto('/onboarding/privacy');
    await expect(page).toHaveURL(/\/consent$/);

    const accept = page.getByRole('button', { name: /Accept and continue/ });
    await page.getByRole('checkbox', { name: /Terms of Service/ }).check();
    await page.getByRole('checkbox', { name: /Privacy Policy/ }).check();
    await page.getByRole('checkbox', { name: /does not provide medical advice/ }).check();
    // The missing rows are asked, and Accept waits for them.
    await expect(accept).toBeDisabled();
    await page.getByRole('checkbox', { name: /18 or older/ }).check();
    await page.getByRole('checkbox', { name: /processing my data/ }).check();
    await expect(accept).toBeEnabled();
    await accept.click();

    await expect(page).toHaveURL(/\/dashboard/);
    const state = await readConsentState(onboarded.id);
    expect(state.age_confirmed_at).not.toBeNull();
    expect(state.data_processing_consent_at).not.toBeNull();
    expect(await countAuditEvents(onboarded.id, 'consent_accepted')).toBe(auditBefore + 1);
    expect(await readOnboardingStep(onboarded.id)).toBe(stepBefore);
  });

  test('a current user never sees /consent', async ({ page, onboarded }) => {
    await login(page, onboarded);
    await expect(page).toHaveURL(/\/dashboard/);
    await page.goto('/consent');
    await expect(page).toHaveURL(/\/dashboard/);
  });
});

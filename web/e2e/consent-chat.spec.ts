import type { Route } from '@playwright/test';
import { test, expect, login } from './_helpers/fixtures';
import { canSeed, getAdmin } from './_helpers/seed';
import { LEDGER_CHAT_NOTICE_VERSION } from '../../src/domain/ledgerChat/notice';

// Sign-up asks two ticks and the Ask the ledger Yes / No. This is the "Yes" path: the answer is
// saved with the notice version, so the dock panel opens already consented, with no first-ask card.
// The chat route is mocked as in ask-dock.spec.ts; its GET reports the consent the sign-up really stored.
const CHAT_ROUTE = '**/api/ledger-chat';
const QUESTION = 'How did this week compare?';
const ANSWER = { answer: 'A little lighter than the week before.', rows: [], toolsUsed: ['compare_periods'] };

function json(status: number, body: unknown) {
  return { status, contentType: 'application/json', body: JSON.stringify(body) };
}

test.describe('sign-up consent: Ask the ledger', () => {
  test.skip(!canSeed(), 'Set SUPABASE_SERVICE_ROLE_KEY + E2E_SUPABASE_URL/ANON_KEY to run.');
  test.skip(process.env.LEDGER_CHAT_ENABLED !== 'true', 'Set LEDGER_CHAT_ENABLED=true for the e2e web server.');

  test('answering Yes at sign-up opens the dock panel consented, with no first-ask card', async ({ page, seeded }) => {
    await login(page, seeded);

    // Step 01: the agreement, the health tick, then an explicit Yes. Continue waits on all three.
    await expect(page).toHaveURL(/\/onboarding\/privacy/);
    const privacyContinue = page.getByRole('button', { name: /Continue/ });
    await expect(privacyContinue).toBeDisabled();
    await page.getByRole('button', { name: 'Stamp all consents' }).click();
    await page.getByRole('checkbox', { name: /explicitly consent/ }).check();
    await expect(privacyContinue).toBeDisabled();
    await page.getByRole('button', { name: 'Yes, turn it on' }).click();
    await expect(privacyContinue).toBeEnabled();
    await privacyContinue.click();

    await expect(page).toHaveURL(/\/onboarding\/usage/);
    await page.getByLabel('Sticks per day').fill('8');
    await page.getByRole('button', { name: 'Mostly packs' }).click();
    await page.getByRole('button', { name: /Continue/ }).click();
    await expect(page).toHaveURL(/\/onboarding\/goal/);
    await page.getByRole('button', { name: /Skip for now/ }).click();
    await expect(page).toHaveURL(/\/onboarding\/brands/);
    await page.getByRole('button', { name: /Finish setup/ }).click();
    await expect(page).toHaveURL(/\/onboarding\/done/);

    // The sign-up stored the notice version under the key the route checks.
    const { data } = await getAdmin()!
      .from('settings_kv')
      .select('value_json')
      .eq('user_id', seeded.id)
      .eq('key', 'consent.ledgerChatOptIn')
      .maybeSingle();
    expect(data?.value_json).toBe(LEDGER_CHAT_NOTICE_VERSION);

    await page.route(CHAT_ROUTE, (route: Route) =>
      route.fulfill(
        route.request().method() === 'GET'
          ? json(200, {
              consented: data?.value_json === LEDGER_CHAT_NOTICE_VERSION,
              discreet: false,
              hideTotals: false,
              currency: 'INR',
              locale: 'en-IN',
              starters: [],
            })
          : json(200, ANSWER),
      ),
    );
    await page.goto('/dashboard');

    const dockBox = page.getByRole('textbox', { name: 'Ask the ledger', exact: true });
    await dockBox.fill(QUESTION);
    await dockBox.press('Enter');
    const dialog = page.getByRole('dialog', { name: 'Ask the ledger' });
    await expect(dialog.locator('article').getByText(ANSWER.answer)).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Turn on and ask' })).toHaveCount(0);
  });
});

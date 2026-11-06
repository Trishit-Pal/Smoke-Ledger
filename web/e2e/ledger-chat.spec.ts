import type { Route } from '@playwright/test';
import { test, expect, login } from './_helpers/fixtures';
import { canSeed, getAdmin, seedLogs, istYmdDaysAgo } from './_helpers/seed';
import { LEDGER_CHAT_NOTICE_VERSION } from '../../src/domain/ledgerChat/notice';

// Ask the ledger, end to end on the real UI with the model route mocked:
// the route is a network boundary, so page.route stands in for the model vendors and
// the server (GET state and POST answers), and the spec proves the panel, the
// consent flow, the row rendering, the limit message, and discreet masking.
const CHAT_ROUTE = '**/api/ledger-chat';
const STARTER = 'What does my ledger say so far?';

const ANSWER = {
  answer: 'Fewer than the week before, and the spend followed.',
  rows: [
    { id: 'compare.current.sticks', label: 'This week', value: 8, unit: 'sticks' },
    { id: 'compare.previous.sticks', label: 'Last week', value: 12, unit: 'sticks' },
    { id: 'compare.delta', label: 'Change', value: -33.3, unit: 'percent', tone: 'accent' },
    { id: 'compare.current.spend', label: 'Spend, this week', value: 160, unit: 'money' },
  ],
  toolsUsed: ['compare_periods'],
};

function json(status: number, body: unknown) {
  return { status, contentType: 'application/json', body: JSON.stringify(body) };
}

function chatState(over: Record<string, unknown> = {}) {
  return { consented: true, discreet: false, hideTotals: false, currency: 'INR', locale: 'en-IN', starters: [STARTER], ...over };
}

test.describe('ask the ledger', () => {
  test.skip(!canSeed(), 'Set SUPABASE_SERVICE_ROLE_KEY + E2E_SUPABASE_URL/ANON_KEY to run.');
  test.skip(process.env.LEDGER_CHAT_ENABLED !== 'true', 'Set LEDGER_CHAT_ENABLED=true for the e2e web server.');

  test('consent on first ask, rows and narration, then the daily limit message', async ({ page, onboarded }) => {
    await seedLogs(onboarded.id, [
      { localDate: istYmdDaysAgo(0), quantity: 3, totalPriceInr: 60, unitPriceInr: 20 },
      { localDate: istYmdDaysAgo(1), quantity: 2, totalPriceInr: 40, unitPriceInr: 20 },
      { localDate: istYmdDaysAgo(3), quantity: 3, totalPriceInr: 60, unitPriceInr: 20 },
    ]);

    let posts = 0;
    await page.route(CHAT_ROUTE, async (route: Route) => {
      if (route.request().method() === 'GET') return route.fulfill(json(200, chatState({ consented: false, starters: [] })));
      posts += 1;
      if (posts === 1) return route.fulfill(json(200, ANSWER));
      return route.fulfill(json(429, { error: 'rate_limited' }));
    });

    await login(page, onboarded);
    await expect(page).toHaveURL(/\/dashboard/);

    // Not opted in: the dock's question waits behind the consent notice.
    await page.getByLabel('Ask the ledger', { exact: true }).fill('How was my week?');
    await page.getByLabel('Ask the ledger', { exact: true }).press('Enter');
    const dialog = page.getByRole('dialog', { name: 'Ask the ledger' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('How was my week?').first()).toBeVisible();
    expect(posts).toBe(0);
    await dialog.getByRole('button', { name: 'Turn on and ask' }).click();

    await expect(dialog.locator('article').getByText(ANSWER.answer)).toBeVisible();
    await expect(dialog.getByRole('definition').filter({ hasText: /^8$/ })).toBeVisible();
    await expect(dialog.getByText('₹160')).toBeVisible();

    // Consent persisted as the settings key the route checks, holding the notice version.
    const admin = getAdmin();
    const { data } = await admin!
      .from('settings_kv')
      .select('value_json')
      .eq('user_id', onboarded.id)
      .eq('key', 'consent.ledgerChatOptIn')
      .maybeSingle();
    expect(data?.value_json).toBe(LEDGER_CHAT_NOTICE_VERSION);

    await dialog.getByLabel('Ask your ledger').fill('And the month before?');
    await dialog.getByRole('button', { name: 'Ask', exact: true }).click();
    await expect(dialog.getByText(/questions are used up/)).toBeVisible();
  });

  test('masks figures for a discreet reader and fits a 320px viewport', async ({ page, onboarded }) => {
    const admin = getAdmin();
    await admin!.from('user_profiles').update({ discreet_mode: true }).eq('id', onboarded.id);
    await admin!
      .from('settings_kv')
      .upsert(
        { user_id: onboarded.id, key: 'consent.ledgerChatOptIn', value_json: LEDGER_CHAT_NOTICE_VERSION },
        { onConflict: 'user_id,key' },
      );
    await seedLogs(onboarded.id, [{ localDate: istYmdDaysAgo(0), quantity: 2, totalPriceInr: 40, unitPriceInr: 20 }]);
    await page.route(CHAT_ROUTE, (route: Route) =>
      route.fulfill(
        route.request().method() === 'GET' ? json(200, chatState({ discreet: true, hideTotals: true })) : json(200, ANSWER),
      ),
    );

    await page.setViewportSize({ width: 320, height: 640 });
    await login(page, onboarded);
    await page.getByRole('button', { name: 'Ask', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Ask the ledger' });
    await dialog.getByRole('button', { name: STARTER }).click();
    await expect(dialog.locator('article').getByText(ANSWER.answer)).toBeVisible();

    // Money and stick rows are masked at the render site; the percent row is not.
    await expect(dialog.getByLabel('Spend, this week hidden, tap to reveal')).toBeVisible();
    await expect(dialog.getByText('₹160')).toHaveCount(0);
    await expect(dialog.getByText('-33.3%')).toBeVisible();

    const fits = await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth);
    expect(fits).toBe(true);
  });

  test('outdated agreements get a calm note and a link to review them', async ({ page, onboarded }) => {
    await page.route(CHAT_ROUTE, (route: Route) => route.fulfill(json(403, { error: 'consent_outdated' })));

    await login(page, onboarded);
    await page.getByLabel('Ask the ledger', { exact: true }).press('Enter');
    const dialog = page.getByRole('dialog', { name: 'Ask the ledger' });
    await expect(dialog.getByText('Your agreements changed. Review them to keep asking.')).toBeVisible();
    await expect(dialog.getByRole('link', { name: 'Review agreements' })).toHaveAttribute('href', '/consent');
  });
});

import { test, expect, login } from './_helpers/fixtures';
import { canSeed, getAdmin, seedLogs, istYmdDaysAgo } from './_helpers/seed';

// Ask the ledger, end to end on the real UI with the model route mocked:
// the route is a network boundary, so page.route stands in for Anthropic and
// the server, and the spec proves the panel, the consent flow, the row
// rendering, the limit message, and discreet masking.
const CHAT_ROUTE = '**/api/ledger-chat';

const ANSWER = {
  answer: 'Fewer than the week before, and the spend followed.',
  rows: [
    { id: 'compare.week.current.sticks', label: 'This week', value: 8, unit: 'sticks' },
    { id: 'compare.week.previous.sticks', label: 'Last week', value: 12, unit: 'sticks' },
    { id: 'compare.week.delta', label: 'Change, this week', value: -33.3, unit: 'percent', tone: 'accent' },
    { id: 'compare.week.current.spend', label: 'Spend, this week', value: 160, unit: 'money' },
  ],
  toolsUsed: ['compare_periods'],
};

function json(status: number, body: unknown) {
  return { status, contentType: 'application/json', body: JSON.stringify(body) };
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

    let calls = 0;
    await page.route(CHAT_ROUTE, async (route) => {
      calls += 1;
      if (calls === 1) return route.fulfill(json(403, { error: 'consent_required' }));
      if (calls === 2) return route.fulfill(json(200, ANSWER));
      return route.fulfill(json(429, { error: 'rate_limited' }));
    });

    await login(page, onboarded);
    await expect(page).toHaveURL(/\/dashboard/);

    await page.getByRole('button', { name: /^Ask the ledger/ }).click();
    const dialog = page.getByRole('dialog', { name: 'Ask the ledger' });
    await expect(dialog).toBeVisible();

    // Three priced days, no goal, no moods: the single open starter.
    await dialog.getByRole('button', { name: 'What does my ledger say so far?' }).click();
    await expect(dialog.getByRole('button', { name: 'Turn on and ask' })).toBeVisible();
    await dialog.getByRole('button', { name: 'Turn on and ask' }).click();

    // exact: the screen-reader announcement repeats the answer and the figures.
    await expect(dialog.getByText(ANSWER.answer, { exact: true })).toBeVisible();
    await expect(dialog.getByRole('definition').filter({ hasText: /^8$/ })).toBeVisible();
    await expect(dialog.getByText('₹160', { exact: true })).toBeVisible();
    await expect(dialog.locator('[aria-live="polite"]')).toContainText('Spend, this week ₹160');

    // Consent persisted as the settings key the route checks.
    const admin = getAdmin();
    const { data } = await admin!
      .from('settings_kv')
      .select('value_json')
      .eq('user_id', onboarded.id)
      .eq('key', 'consent.ledgerChatOptIn')
      .maybeSingle();
    expect(data?.value_json).toBe(true);

    await dialog.getByLabel('Ask your ledger').fill('And the month before?');
    await dialog.getByRole('button', { name: 'Ask', exact: true }).click();
    await expect(dialog.getByText(/reached today/)).toBeVisible();
  });

  test('masks figures for a discreet reader and fits a 320px viewport', async ({ page, onboarded }) => {
    const admin = getAdmin();
    await admin!.from('user_profiles').update({ discreet_mode: true }).eq('id', onboarded.id);
    await admin!
      .from('settings_kv')
      .upsert({ user_id: onboarded.id, key: 'consent.ledgerChatOptIn', value_json: true }, { onConflict: 'user_id,key' });
    await seedLogs(onboarded.id, [{ localDate: istYmdDaysAgo(0), quantity: 2, totalPriceInr: 40, unitPriceInr: 20 }]);
    await page.route(CHAT_ROUTE, (route) => route.fulfill(json(200, ANSWER)));

    await page.setViewportSize({ width: 320, height: 640 });
    await login(page, onboarded);
    await page.getByRole('button', { name: /^Ask the ledger/ }).click();
    const dialog = page.getByRole('dialog', { name: 'Ask the ledger' });
    await dialog.getByRole('button', { name: 'What does my ledger say so far?' }).click();
    await expect(dialog.getByText(ANSWER.answer, { exact: true })).toBeVisible();

    // Money and stick rows are masked at the render site; the percent row is not.
    // Not exact on purpose: no element, the announcement included, may show ₹160.
    await expect(dialog.getByLabel('Spend, this week hidden, tap to reveal')).toBeVisible();
    await expect(dialog.getByText('₹160')).toHaveCount(0);
    await expect(dialog.getByText('-33.3%', { exact: true })).toBeVisible();
    await expect(dialog.locator('[aria-live="polite"]')).toContainText('Spend, this week hidden');

    const fits = await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth);
    expect(fits).toBe(true);
  });

  test('with reduced motion the panel fades in without sliding or rising', async ({ page, onboarded }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await seedLogs(onboarded.id, [{ localDate: istYmdDaysAgo(0), quantity: 2, totalPriceInr: 40, unitPriceInr: 20 }]);

    await login(page, onboarded);
    await page.getByRole('button', { name: /^Ask the ledger/ }).click();
    const dialog = page.getByRole('dialog', { name: 'Ask the ledger' });
    await expect(dialog).toBeVisible();

    // The reduced-motion override swaps the slide/rise keyframes for an opacity-only fade.
    const animation = await dialog.evaluate((el) => getComputedStyle(el).animationName);
    expect(animation).toBe('ask-sheet-fade');
  });
});

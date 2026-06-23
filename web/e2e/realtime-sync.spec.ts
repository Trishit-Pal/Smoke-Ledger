import { test, expect, login } from './_helpers/fixtures';
import { canSeed } from './_helpers/seed';

// Cross-device realtime: a write in one context surfaces in another without a
// manual reload (RealtimeRefresher → router.refresh). Inherently timing-sensitive,
// so it gets extra retries and a generous timeout.
test.describe('cross-device realtime sync @slow', () => {
  test.skip(!canSeed(), 'Set SUPABASE_SERVICE_ROLE_KEY + E2E_SUPABASE_URL/ANON_KEY to run.');
  test.describe.configure({ retries: 2 });

  test('a log in context A appears on the dashboard in context B', async ({ browser, onboarded }) => {
    const ctxA = await browser.newContext();
    const ctxB = await browser.newContext();
    const a = await ctxA.newPage();
    const b = await ctxB.newPage();
    try {
      await login(a, onboarded);
      await login(b, onboarded);

      await b.goto('/dashboard');
      await expect(b.getByLabel('0 cigarettes today', { exact: true })).toBeVisible();

      // postgres_changes are NOT replayed on subscribe — give B's channel a moment
      // to reach SUBSCRIBED before A writes, or the INSERT is missed (the page being
      // rendered does not imply the WebSocket has joined yet).
      await b.waitForTimeout(2500);

      // Log 2 in context A.
      await a.goto('/log/new');
      await a.getByRole('group', { name: 'Brand' }).getByRole('button').first().click();
      await a.getByLabel('Quantity').fill('2');
      await a.getByRole('button', { name: 'Save log' }).click();
      await expect(a).not.toHaveURL(/\/log\/new/);

      // Context B reconciles via realtime, no manual reload.
      await expect(b.getByLabel('2 cigarettes today', { exact: true })).toBeVisible({
        timeout: 20_000,
      });
    } finally {
      await ctxA.close();
      await ctxB.close();
    }
  });
});

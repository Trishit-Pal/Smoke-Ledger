import type { Page, Route } from '@playwright/test';
import { test, expect, login } from './_helpers/fixtures';
import { canSeed } from './_helpers/seed';

// The floating Ask dock: on every reading page, never on Log; Enter opens the
// panel with the question; minimise is remembered on the device; on a phone
// the pill replaces the box without widening the page. The chat route is
// mocked (GET state and POST answer), as in ledger-chat.spec.ts.
const CHAT_ROUTE = '**/api/ledger-chat';
const QUESTION = 'How did this week compare?';
const ANSWER = { answer: 'A little lighter than the week before.', rows: [], toolsUsed: ['compare_periods'] };

function json(status: number, body: unknown) {
  return { status, contentType: 'application/json', body: JSON.stringify(body) };
}

async function mockChat(page: Page, consented: boolean) {
  await page.route(CHAT_ROUTE, (route: Route) =>
    route.fulfill(
      route.request().method() === 'GET'
        ? json(200, { consented, discreet: false, hideTotals: false, currency: 'INR', locale: 'en-IN', starters: [] })
        : json(200, ANSWER),
    ),
  );
}

const dockBox = (page: Page) => page.getByLabel('Ask the ledger', { exact: true });

test.describe('ask dock', () => {
  test.skip(!canSeed(), 'Set SUPABASE_SERVICE_ROLE_KEY + E2E_SUPABASE_URL/ANON_KEY to run.');
  test.skip(process.env.LEDGER_CHAT_ENABLED !== 'true', 'Set LEDGER_CHAT_ENABLED=true for the e2e web server.');

  test('shows on the reading pages and not on Log', async ({ page, onboarded }) => {
    await login(page, onboarded);
    for (const path of ['/dashboard', '/trends', '/history', '/goals', '/settings']) {
      await page.goto(path);
      await expect(dockBox(page), path).toBeVisible();
    }
    await page.goto('/log');
    await expect(page).toHaveURL(/\/log/);
    await page.waitForLoadState('networkidle');
    await expect(dockBox(page)).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Show Ask the ledger' })).toHaveCount(0);
  });

  test('Enter opens the panel with the question, and the answer follows consent', async ({ page, onboarded }) => {
    await mockChat(page, false);
    await login(page, onboarded);

    await dockBox(page).fill(QUESTION);
    await dockBox(page).press('Enter');
    const dialog = page.getByRole('dialog', { name: 'Ask the ledger' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(QUESTION).first()).toBeVisible();
    await dialog.getByRole('button', { name: 'Turn on and ask' }).click();
    await expect(dialog.getByText(ANSWER.answer)).toBeVisible();
    await expect(dialog.getByText('Written by AI')).toBeVisible();
  });

  test('reopening re-reads the state: a figure shown on the first open is masked once Hide totals is on', async ({ page, onboarded }) => {
    // Settings only router.refresh()es, so the mounted panel must not keep its first reading.
    // The mock stands in for the reader flipping Hide totals between the two opens.
    const answer = { ...ANSWER, rows: [{ id: 'compare.current.sticks', label: 'This week', value: 8, unit: 'sticks' }] };
    let gets = 0;
    await page.route(CHAT_ROUTE, (route: Route) => {
      if (route.request().method() !== 'GET') return route.fulfill(json(200, answer));
      gets += 1;
      return route.fulfill(
        json(200, { consented: true, discreet: false, hideTotals: gets > 1, currency: 'INR', locale: 'en-IN', starters: [] }),
      );
    });
    await login(page, onboarded);

    await dockBox(page).fill(QUESTION);
    await dockBox(page).press('Enter');
    const dialog = page.getByRole('dialog', { name: 'Ask the ledger' });
    await expect(dialog.getByLabel('This week 8', { exact: true })).toBeVisible();
    expect(gets).toBe(1);

    await dialog.getByRole('button', { name: 'Close' }).click();
    await expect(dialog).toBeHidden();
    await dockBox(page).press('Enter');
    await expect(dialog.getByLabel('This week hidden, tap to reveal')).toBeVisible();
    await expect(dialog.getByLabel('This week 8', { exact: true })).toHaveCount(0);
    await expect.poll(() => gets).toBe(2);
  });

  test('reopening after the agreements were reviewed clears the outdated notice and sends the question', async ({ page, onboarded }) => {
    // The dock stays mounted while the reader visits /consent, so a block from one open must not outlive it.
    let gets = 0;
    await page.route(CHAT_ROUTE, (route: Route) => {
      if (route.request().method() !== 'GET') return route.fulfill(json(200, ANSWER));
      gets += 1;
      return route.fulfill(
        gets === 1
          ? json(403, { error: 'consent_outdated' })
          : json(200, { consented: true, discreet: false, hideTotals: false, currency: 'INR', locale: 'en-IN', starters: [] }),
      );
    });
    await login(page, onboarded);

    await dockBox(page).press('Enter');
    const dialog = page.getByRole('dialog', { name: 'Ask the ledger' });
    await expect(dialog.getByText('Your agreements changed. Review them to keep asking.')).toBeVisible();

    await dialog.getByRole('button', { name: 'Close' }).click();
    await expect(dialog).toBeHidden();
    await dockBox(page).fill(QUESTION);
    await dockBox(page).press('Enter');
    await expect(dialog.getByText(ANSWER.answer)).toBeVisible();
    await expect(dialog.getByText('Your agreements changed. Review them to keep asking.')).toHaveCount(0);
    expect(gets).toBe(2);
  });

  test('reopening after a failed answer clears the error notice once the state reads clean', async ({ page, onboarded }) => {
    let failPost = true;
    await page.route(CHAT_ROUTE, (route: Route) => {
      if (route.request().method() === 'GET') {
        return route.fulfill(json(200, { consented: true, discreet: false, hideTotals: false, currency: 'INR', locale: 'en-IN', starters: [] }));
      }
      return route.fulfill(failPost ? json(500, { error: 'upstream_failed' }) : json(200, ANSWER));
    });
    await login(page, onboarded);

    await dockBox(page).fill(QUESTION);
    await dockBox(page).press('Enter');
    const dialog = page.getByRole('dialog', { name: 'Ask the ledger' });
    const errorNotice = dialog.getByText("The ledger couldn't be read just now.", { exact: false });
    await expect(errorNotice).toBeVisible();

    failPost = false;
    await dialog.getByRole('button', { name: 'Close' }).click();
    await expect(dialog).toBeHidden();
    await dockBox(page).press('Enter');
    await expect(dialog).toBeVisible();
    await expect(errorNotice).toHaveCount(0);
  });

  test('an answer that lands after Clear conversation is dropped, never saved back', async ({ page, onboarded }) => {
    // The dock outlives navigation, so the answer can land while the reader is on Settings clearing the device.
    let releaseAnswer: () => void = () => {};
    const answerHeld = new Promise<void>((resolve) => {
      releaseAnswer = resolve;
    });
    let answerSent = false;
    await page.route(CHAT_ROUTE, async (route: Route) => {
      if (route.request().method() === 'GET') {
        return route.fulfill(json(200, { consented: true, discreet: false, hideTotals: false, currency: 'INR', locale: 'en-IN', starters: [] }));
      }
      await answerHeld;
      answerSent = true;
      return route.fulfill(json(200, ANSWER));
    });
    await login(page, onboarded);

    await dockBox(page).fill(QUESTION);
    await dockBox(page).press('Enter');
    const dialog = page.getByRole('dialog', { name: 'Ask the ledger' });
    await expect(dialog.getByRole('status')).toBeVisible();
    await dialog.getByRole('button', { name: 'Close' }).click();
    await expect(dialog).toBeHidden();

    await page.getByRole('link', { name: 'Settings' }).first().click();
    await expect(page).toHaveURL(/\/settings/);
    await page.getByText('Clear conversation', { exact: true }).click();

    releaseAnswer();
    await expect.poll(() => answerSent).toBe(true);
    // Let the panel handle the response before looking at the device.
    await page.waitForTimeout(500);
    const saved = await page.evaluate(() =>
      Object.keys(window.localStorage)
        .filter((k) => k.startsWith('ledger-chat:v1:'))
        .map((k) => window.localStorage.getItem(k)),
    );
    expect(saved.filter((v) => v && v !== '[]')).toEqual([]);

    await dockBox(page).press('Enter');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(ANSWER.answer)).toHaveCount(0);
  });

  test('never covers History’s New log button, on a phone or a desktop', async ({ page, onboarded }) => {
    await login(page, onboarded);
    for (const viewport of [{ width: 390, height: 844 }, { width: 1440, height: 900 }]) {
      await page.setViewportSize(viewport);
      await page.goto('/history');
      const newLog = page.getByRole('link', { name: 'New log' });
      // The whole visible dock: the desktop form, or the phone pill row (pill + minimise).
      const dock =
        viewport.width < 768
          ? page.getByRole('button', { name: 'Ask', exact: true }).locator('..')
          : page.locator('form', { has: dockBox(page) });
      await expect(newLog).toBeVisible();
      await expect(dock).toBeVisible();
      const a = await newLog.boundingBox();
      const b = await dock.boundingBox();
      expect(a && b, `${viewport.width}px`).toBeTruthy();
      const intersects = a!.x < b!.x + b!.width && b!.x < a!.x + a!.width && a!.y < b!.y + b!.height && b!.y < a!.y + a!.height;
      expect(intersects, `${viewport.width}px: New log ${JSON.stringify(a)} vs dock ${JSON.stringify(b)}`).toBe(false);
    }
  });

  test('is not on public pages outside the app shell', async ({ page, onboarded }) => {
    // Structural: the dock mounts only in (app)/layout.tsx; /consent, onboarding and legal pages sit outside it.
    await login(page, onboarded);
    await page.goto('/privacy');
    await page.waitForLoadState('networkidle');
    await expect(dockBox(page)).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Show Ask the ledger' })).toHaveCount(0);
  });

  test('Escape in the box clears it', async ({ page, onboarded }) => {
    await login(page, onboarded);
    await dockBox(page).fill(QUESTION);
    await dockBox(page).press('Escape');
    await expect(dockBox(page)).toHaveValue('');
  });

  test('minimise is remembered across a reload', async ({ page, onboarded }) => {
    await login(page, onboarded);
    await page.getByRole('button', { name: 'Minimise Ask the ledger' }).click();
    await expect(dockBox(page)).toHaveCount(0);

    await page.reload();
    await expect(page.getByRole('button', { name: 'Show Ask the ledger' })).toBeVisible();
    await expect(dockBox(page)).toHaveCount(0);

    await page.getByRole('button', { name: 'Show Ask the ledger' }).click();
    await expect(dockBox(page)).toBeVisible();
  });

  test('a 390px phone shows the pill, not the box, above the nav and without overflow', async ({ page, onboarded }) => {
    await mockChat(page, true);
    await page.setViewportSize({ width: 390, height: 844 });
    await login(page, onboarded);

    const pill = page.getByRole('button', { name: 'Ask', exact: true });
    await expect(pill).toBeVisible();
    await expect(dockBox(page)).toBeHidden();

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);

    // The pill sits wholly above the bottom nav, so no nav target is covered.
    const pillBox = await pill.boundingBox();
    const navBox = await page.getByRole('navigation', { name: 'Primary' }).last().boundingBox();
    expect(pillBox && navBox && pillBox.y + pillBox.height <= navBox.y).toBe(true);

    await pill.click();
    await expect(page.getByRole('dialog', { name: 'Ask the ledger' })).toBeVisible();
  });
});

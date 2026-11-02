import { test, expect, login } from './_helpers/fixtures';
import {
  canSeed,
  istYmdDaysAgo,
  listGoalStatuses,
  seedGoal,
  seedLogs,
  type LogSpec,
} from './_helpers/seed';

/** One log per day (quantity `perDay`) for each IST day whose "days ago" offset is in `offsets`. */
const logsOn = (offsets: number[], perDay: number): LogSpec[] =>
  offsets.map((n) => ({ localDate: istYmdDaysAgo(n), quantity: perDay }));
const range = (from: number, to: number): number[] =>
  Array.from({ length: to - from + 1 }, (_, i) => from + i);

test.describe('adaptive goals', () => {
  test.skip(!canSeed(), 'Set SUPABASE_SERVICE_ROLE_KEY + E2E_SUPABASE_URL/ANON_KEY to run.');

  test('a new daily cap is proposed from the last 14 days and created with one tap', async ({
    page,
    onboarded,
  }) => {
    // 14 days ending yesterday at 9/day → the ledger proposes 8.
    await seedLogs(onboarded.id, logsOn(range(1, 14), 9));
    await login(page, onboarded);
    await page.goto('/goals');

    await page.getByRole('button', { name: 'New goal' }).click();
    await page.getByRole('button', { name: 'Daily cap' }).click();
    await page.getByRole('button', { name: 'Use 8 / day' }).click();
    await page.getByRole('button', { name: 'Create goal' }).click();

    await expect(page.getByText('Daily cap: 8/day')).toBeVisible();
  });

  test('a quit date that has arrived completes on its own', async ({ page, onboarded }) => {
    await seedGoal(onboarded.id, {
      type: 'quit_date',
      targetValue: 10,
      startDate: istYmdDaysAgo(10),
      endDate: istYmdDaysAgo(0),
    });
    await login(page, onboarded);
    await page.goto('/goals');

    await expect(page.getByText('Quit day.', { exact: true })).toBeVisible();
    await expect
      .poll(async () => (await listGoalStatuses(onboarded.id)).map((g) => g.status))
      .toEqual(['completed']);
  });

  test('one day over the cap in the last 7 reads as at risk', async ({ page, onboarded }) => {
    await seedGoal(onboarded.id, { type: 'daily_cap', targetValue: 5, startDate: istYmdDaysAgo(10) });
    // Three days ago was 7 (over 5); every other day stayed at 3.
    await seedLogs(onboarded.id, [
      ...logsOn(range(1, 9).filter((n) => n !== 3), 3),
      ...logsOn([3], 7),
    ]);
    await login(page, onboarded);
    await page.goto('/goals');

    await expect(page.getByText('At risk · over once in the last 7 days')).toBeVisible();
  });

  test('an off-track cap offers to re-anchor, and Accept moves the cap', async ({
    page,
    onboarded,
  }) => {
    await seedGoal(onboarded.id, { type: 'daily_cap', targetValue: 5, startDate: istYmdDaysAgo(10) });
    // Every one of the last 7 days (today included) at 9 against a cap of 5.
    await seedLogs(onboarded.id, logsOn(range(0, 6), 9));
    await login(page, onboarded);
    await page.goto('/goals');

    await expect(page.getByText(/Off track/)).toBeVisible();
    await page.getByRole('button', { name: 'Accept' }).click();

    await expect(page.getByText('Daily cap: 9/day')).toBeVisible();
  });
});

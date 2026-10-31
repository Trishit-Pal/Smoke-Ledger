/**
 * EU ledger: money on screens a euro reader reaches must come from the
 * profile's currency, never a hard-coded ₹.
 */
import * as fs from 'fs';
import * as path from 'path';

const read = (rel: string): string =>
  fs.readFileSync(path.resolve(__dirname, '../..', rel), 'utf8');

describe('no hard-coded rupees on euro-reachable screens', () => {
  it('the mood/trigger matrix formats with the money formatter it is given', () => {
    const matrix = read('web/components/charts/MoodTriggerMatrix.tsx');
    expect(matrix).not.toContain('₹');
    // The formatter rounds to cents; rounding first turned €0.55 into €1.00.
    expect(matrix).not.toMatch(/money\(Math\.round\(/);
    expect(read('web/app/(app)/trends/TrendsClient.tsx')).toMatch(/<MoodTriggerMatrix[^>]*money=\{/);
  });

  it('the dashboard passes its money formatter to generateInsights', () => {
    expect(read('web/app/(app)/dashboard/DashboardClient.tsx')).toMatch(/generateInsights\(logs, today, /);
  });

  it('the log edit modal states the price limit in the profile currency', () => {
    const modal = read('web/components/modals/LogEditModal.tsx');
    expect(modal).not.toMatch(/between ₹0 and ₹/);
    expect(read('web/app/(app)/history/HistoryClient.tsx')).toMatch(/<LogEditModal[\s\S]{0,300}money=\{/);
  });
});

describe('no hard-coded rupees on native screens', () => {
  it('the native mood/trigger matrix formats with the money formatter it is given', () => {
    expect(read('src/components/charts/MoodTriggerMatrix.tsx')).not.toContain('₹');
    expect(read('app/(tabs)/trends.tsx')).toMatch(/<MoodTriggerMatrixView[^>]*money=\{/);
  });

  it('Home passes the ledger money to generateInsights and evaluateGoal', () => {
    const home = read('app/(tabs)/index.tsx');
    expect(home).toMatch(/generateInsights\(logs, today, /);
    expect(home).toMatch(/evaluateGoal\(activeGoal, logs, today, /);
  });

  it('Goals passes the ledger money to evaluateGoal', () => {
    expect(read('app/(tabs)/goals.tsx')).toMatch(/evaluateGoal\(goal, logs, today, /);
  });
});

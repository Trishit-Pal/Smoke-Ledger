import {
  type DailySummaryRow,
  totalsForWindow,
  periodWithTrend,
  savedForWindow,
  savedAllTime,
  streakFromRows,
  weightedAvgUnitPrice,
} from '@/domain/periodSummary';

// Canonical per-day rows (as returned by get_daily_summary): only days WITH logs
// appear. sticks is SUM(quantity), so values > 1 exercise the quantity path.
const rows: DailySummaryRow[] = [
  { date: '2026-06-21', sticks: 3, spendInr: 60, avgUnitPriceInr: 20 }, // today
  { date: '2026-06-20', sticks: 5, spendInr: 100, avgUnitPriceInr: 20 },
  { date: '2026-06-14', sticks: 7, spendInr: 140, avgUnitPriceInr: 20 },
];
const TODAY = '2026-06-21';

describe('totalsForWindow', () => {
  it('sums sticks (quantity) and spend for the daily window (today only)', () => {
    expect(totalsForWindow(rows, 1, TODAY)).toEqual({ sticks: 3, spendInr: 60 });
  });

  it('sums only the trailing N days for the weekly window', () => {
    // 06-15..06-21 → 06-21(3) + 06-20(5); 06-14 is outside the 7-day window
    expect(totalsForWindow(rows, 7, TODAY)).toEqual({ sticks: 8, spendInr: 160 });
  });

  it('includes older multi-quantity days for the monthly window', () => {
    // 05-23..06-21 → 3 + 5 + 7
    expect(totalsForWindow(rows, 30, TODAY)).toEqual({ sticks: 15, spendInr: 300 });
  });

  it('reconciles: weekly total equals the sum of its 7 daily totals', () => {
    let daily = 0;
    let cur = TODAY;
    for (let i = 0; i < 7; i++) {
      daily += totalsForWindow(rows, 1, cur).sticks;
      const [y, m, d] = cur.split('-').map(Number);
      const dt = new Date(Date.UTC(y, m - 1, d));
      dt.setUTCDate(dt.getUTCDate() - 1);
      cur = dt.toISOString().slice(0, 10);
    }
    expect(daily).toBe(totalsForWindow(rows, 7, TODAY).sticks);
  });
});

describe('periodWithTrend', () => {
  it('compares the current window to the immediately previous window of equal length', () => {
    const t = periodWithTrend(rows, 7, TODAY);
    expect(t.current.sticks).toBe(8); // 06-15..06-21
    expect(t.previous.sticks).toBe(7); // 06-08..06-14 → 06-14(7)
    expect(t.stickDeltaPct).toBeCloseTo(((8 - 7) / 7) * 100, 5);
  });

  it('reports +100% when previous period had nothing and current has data', () => {
    const t = periodWithTrend(rows, 1, TODAY); // today 3 vs yesterday-of-window empty? 06-20 has 5
    expect(t.current.sticks).toBe(3);
  });
});

describe('savedForWindow', () => {
  const baseline = 10;
  const fallback = 20;

  it('counts avoided sticks per day (incl. absent zero-stick days) at the fallback price', () => {
    // weekly 06-15..06-21: 06-21 avoided 7, 06-20 avoided 5, five absent days avoided 10 each
    const out = savedForWindow(rows, baseline, fallback, 7, TODAY);
    expect(out.sticksAvoided).toBe(7 + 5 + 50);
    expect(out.totalInr).toBe((7 + 5 + 50) * 20);
  });

  it("uses a day's own avg unit price when present, fallback otherwise", () => {
    const r: DailySummaryRow[] = [{ date: '2026-06-21', sticks: 2, spendInr: 50, avgUnitPriceInr: 25 }];
    // daily window, baseline 10 → avoided 8 at the day's own price 25 = 200
    const out = savedForWindow(r, 10, 99, 1, TODAY);
    expect(out.totalInr).toBe(200);
  });
});

describe('savedAllTime', () => {
  it('sums avoided spend across every day since the given start', () => {
    const r: DailySummaryRow[] = [
      { date: '2026-06-19', sticks: 2, spendInr: 40, avgUnitPriceInr: 20 },
      { date: '2026-06-20', sticks: 5, spendInr: 100, avgUnitPriceInr: 20 },
      { date: '2026-06-21', sticks: 3, spendInr: 60, avgUnitPriceInr: 20 },
    ];
    const out = savedAllTime(r, 10, 20, '2026-06-19', TODAY);
    // avoided: 8 + 5 + 7 = 20 sticks at 20 = 400
    expect(out.sticksAvoided).toBe(20);
    expect(out.totalInr).toBe(400);
  });
});

describe('streakFromRows', () => {
  it('counts consecutive smoke-free (absent) days ending today', () => {
    const r: DailySummaryRow[] = [{ date: '2026-06-18', sticks: 2, spendInr: 40, avgUnitPriceInr: 20 }];
    // 06-21, 06-20, 06-19 absent; 06-18 present → streak 3
    expect(streakFromRows(r, TODAY)).toBe(3);
  });

  it('is zero when today itself has logs', () => {
    expect(streakFromRows(rows, TODAY)).toBe(0);
  });

  it('is zero when there are no rows at all', () => {
    expect(streakFromRows([], TODAY)).toBe(0);
  });
});

describe('weightedAvgUnitPrice', () => {
  it('weights each day price by its stick count', () => {
    const r: DailySummaryRow[] = [
      { date: '2026-06-20', sticks: 3, spendInr: 60, avgUnitPriceInr: 20 },
      { date: '2026-06-21', sticks: 1, spendInr: 30, avgUnitPriceInr: 30 },
    ];
    expect(weightedAvgUnitPrice(r)).toBeCloseTo((20 * 3 + 30 * 1) / 4, 5);
  });

  it('returns null when no day has a known price', () => {
    const r: DailySummaryRow[] = [{ date: '2026-06-21', sticks: 2, spendInr: 0, avgUnitPriceInr: null }];
    expect(weightedAvgUnitPrice(r)).toBeNull();
  });
});

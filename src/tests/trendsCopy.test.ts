import { avgLine, headlineDeck } from '@/domain/trendsCopy';

const base = { sticks: 12, windowDays: 7 as const, avg: 1.7, deltaPct: 10, discreet: false };

describe('headlineDeck', () => {
  it('reads empty windows', () => {
    expect(headlineDeck({ ...base, sticks: 0, windowDays: 1 })).toBe('Nothing logged today.');
    expect(headlineDeck({ ...base, sticks: 0 })).toBe('Nothing logged across the last 7 days.');
  });

  it('reads a single day with singular and plural nouns', () => {
    expect(headlineDeck({ ...base, sticks: 1, windowDays: 1, deltaPct: 0 })).toMatch(/^1 cigarette today, /);
    expect(headlineDeck({ ...base, sticks: 3, windowDays: 1 })).toMatch(/^3 cigarettes today, .* vs the day before\.$/);
  });

  it('reads a multi-day window with the average', () => {
    expect(headlineDeck(base)).toMatch(
      /^12 cigarettes across 7 days\. Average 1\.7 per day, .* vs the period before\.$/,
    );
  });

  it('is exactly the hidden line, with no digits, when discreet', () => {
    for (const sticks of [0, 1, 12]) {
      for (const windowDays of [1, 7, 30] as const) {
        expect(headlineDeck({ ...base, sticks, windowDays, discreet: true })).toBe('Period totals — hidden.');
      }
    }
  });
});

describe('avgLine', () => {
  it('reads flat, sparse and typical windows', () => {
    expect(avgLine({ sticks: 0, avg: 0, discreet: false })).toBe('A flat line. Nothing logged in this window.');
    expect(avgLine({ sticks: 3, avg: 0.4, discreet: false })).toBe('A sparse window — most days quiet.');
    expect(avgLine({ sticks: 12, avg: 1.7, discreet: false })).toBe('Around 1.7 a day, on average.');
  });

  it('masks the average and carries no digits when discreet', () => {
    const line = avgLine({ sticks: 12, avg: 1.7, discreet: true });
    expect(line).toBe('Around ••• a day, on average.');
    expect(line).not.toMatch(/\d/);
  });
});

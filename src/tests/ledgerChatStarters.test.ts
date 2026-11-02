import { buildToolContext } from '@/domain/ledgerChat/context';
import { starterQuestions } from '@/domain/ledgerChat/starters';
import type { DailySummaryRow } from '@/domain/periodSummary';
import type { CigaretteLog, Goal, UserProfile } from '@/types';

const TODAY = '2026-06-21';

const profile: UserProfile = {
  baselinePerDay: 10,
  baselineWindowDays: 7,
  currency: 'INR',
  discreetMode: false,
  appLockEnabled: false,
  hideTotalsOnHome: false,
  onboardedAt: '2026-01-01T00:00:00.000Z',
  country: null,
};

function dayRows(count: number, spend = 20): DailySummaryRow[] {
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(Date.UTC(2026, 5, 21 - i));
    return { date: d.toISOString().slice(0, 10), sticks: 1, spendInr: spend, avgUnitPriceInr: spend };
  });
}

function entry(over: Partial<CigaretteLog>): CigaretteLog {
  return {
    id: 'x',
    tsUtc: '2026-06-21T03:30:00.000Z',
    localDate: '2026-06-21',
    localHour: 9,
    brandId: null,
    brandNameSnap: null,
    variantSnap: null,
    quantity: 1,
    purchaseMode: 'single',
    packSize: null,
    totalPriceInr: null,
    unitPriceInr: null,
    priceSource: 'unknown',
    triggerTag: null,
    moodBefore: null,
    moodAfter: null,
    craving: null,
    contextTag: null,
    notes: null,
    createdAt: '',
    updatedAt: '',
    ...over,
  };
}

const goal: Goal = {
  id: 'g1',
  type: 'daily_cap',
  targetValue: 5,
  currentBaseline: 10,
  startDate: '2026-06-01',
  endDate: null,
  status: 'active',
  meta: null,
  createdAt: '',
  completedAt: null,
};

function starters(input: { rows: DailySummaryRow[]; logs?: CigaretteLog[]; goals?: Goal[] }) {
  return starterQuestions(
    buildToolContext({
      profile,
      logs: input.logs ?? [],
      rows: input.rows,
      goals: input.goals ?? [],
      today: TODAY,
      summarySinceYmd: '2025-06-22',
    }),
  ).map((s) => s.id);
}

describe('starterQuestions', () => {
  it('offers nothing for an empty ledger', () => {
    expect(starters({ rows: [] })).toEqual([]);
  });

  it('puts the goal question first when a goal is active', () => {
    expect(starters({ rows: dayRows(20), goals: [goal] })[0]).toBe('goal');
  });

  it('unlocks the week comparison at fourteen days and the yearly cost at seven priced days', () => {
    expect(starters({ rows: dayRows(7) })).toEqual(['cost']);
    expect(starters({ rows: dayRows(14) })).toEqual(['compare', 'cost']);
  });

  it('offers the when-and-why question once a mood or trigger exists', () => {
    const ids = starters({ rows: dayRows(3), logs: [entry({ triggerTag: 'stress' })] });
    expect(ids).toEqual(['when']);
  });

  it('falls back to a single open question when nothing else applies', () => {
    expect(starters({ rows: dayRows(1, 0) })).toEqual(['so_far']);
  });

  it('never offers more than four', () => {
    const ids = starters({ rows: dayRows(30), logs: [entry({ moodBefore: 'bored' })], goals: [goal] });
    expect(ids.length).toBeLessThanOrEqual(4);
    expect(ids).toEqual(['goal', 'compare', 'cost', 'when']);
  });
});

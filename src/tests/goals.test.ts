import type { Goal } from '@/types';
import { evaluateGoal } from '@/domain/goals';

const baseGoal = (overrides: Partial<Goal>): Goal => ({
  id: 'g1',
  type: 'daily_cap',
  targetValue: 5,
  currentBaseline: null,
  startDate: '2025-04-01',
  endDate: null,
  status: 'active',
  meta: null,
  createdAt: '2025-04-01T00:00:00.000Z',
  ...overrides,
});

describe('evaluateGoal', () => {
  it('daily_cap tracks sticks on today', () => {
    const goal = baseGoal({ type: 'daily_cap', targetValue: 5 });
    const logs = [
      {
        id: 'l1',
        tsUtc: '2025-04-18T10:00:00.000Z',
        localDate: '2025-04-18',
        localHour: 10,
        brandId: null,
        brandNameSnap: null,
        variantSnap: null,
        quantity: 3,
        purchaseMode: 'single' as const,
        packSize: null,
        totalPriceInr: 60,
        unitPriceInr: 20,
        priceSource: 'exact' as const,
        triggerTag: null,
        moodBefore: null,
        moodAfter: null,
        craving: null,
        contextTag: null,
        notes: null,
        createdAt: '',
        updatedAt: '',
      },
    ];
    const p = evaluateGoal(goal, logs, '2025-04-18');
    expect(p.valueCurrent).toBe(3);
    expect(p.isOnTrack).toBe(true);
  });

  it('no_smoke_window handles overnight windows', () => {
    const goal = baseGoal({
      type: 'no_smoke_window',
      targetValue: 0,
      meta: { startHour: 22, endHour: 6 },
    });
    const logs = [
      {
        id: 'l1',
        tsUtc: '2025-04-18T23:00:00.000Z',
        localDate: '2025-04-18',
        localHour: 23,
        brandId: null,
        brandNameSnap: null,
        variantSnap: null,
        quantity: 1,
        purchaseMode: 'single' as const,
        packSize: null,
        totalPriceInr: null,
        unitPriceInr: null,
        priceSource: 'unknown' as const,
        triggerTag: null,
        moodBefore: null,
        moodAfter: null,
        craving: null,
        contextTag: null,
        notes: null,
        createdAt: '',
        updatedAt: '',
      },
    ];
    const p = evaluateGoal(goal, logs, '2025-04-18');
    expect(p.isOnTrack).toBe(false);
    expect(p.valueCurrent).toBe(1);
  });

  it('weekly_target sums the calendar week', () => {
    const goal = baseGoal({ type: 'weekly_target', targetValue: 10, startDate: '2025-04-14' });
    const mk = (date: string, qty: number) => ({
      id: `l-${date}`,
      tsUtc: `${date}T12:00:00.000Z`,
      localDate: date,
      localHour: 12,
      brandId: null,
      brandNameSnap: null,
      variantSnap: null,
      quantity: qty,
      purchaseMode: 'single' as const,
      packSize: null,
      totalPriceInr: null,
      unitPriceInr: null,
      priceSource: 'unknown' as const,
      triggerTag: null,
      moodBefore: null,
      moodAfter: null,
      craving: null,
      contextTag: null,
      notes: null,
      createdAt: '',
      updatedAt: '',
    });
    const logs = [mk('2025-04-14', 2), mk('2025-04-15', 3), mk('2025-04-18', 4)];
    const p = evaluateGoal(goal, logs, '2025-04-18');
    expect(p.valueCurrent).toBe(9);
    expect(p.isOnTrack).toBe(true);
  });

  it('reduction_target compares rolling average to baseline', () => {
    const goal = baseGoal({
      type: 'reduction_target',
      targetValue: 5,
      currentBaseline: 10,
      startDate: '2025-04-01',
    });
    const mk = (date: string, qty: number) => ({
      id: `l-${date}`,
      tsUtc: `${date}T12:00:00.000Z`,
      localDate: date,
      localHour: 12,
      brandId: null,
      brandNameSnap: null,
      variantSnap: null,
      quantity: qty,
      purchaseMode: 'single' as const,
      packSize: null,
      totalPriceInr: null,
      unitPriceInr: null,
      priceSource: 'unknown' as const,
      triggerTag: null,
      moodBefore: null,
      moodAfter: null,
      craving: null,
      contextTag: null,
      notes: null,
      createdAt: '',
      updatedAt: '',
    });
    const logs = Array.from({ length: 7 }, (_, i) => mk(`2025-04-${12 + i}`, 6));
    const p = evaluateGoal(goal, logs, '2025-04-18');
    expect(p.valueCurrent).toBeGreaterThan(0);
    expect(p.unit).toBe('sticks');
  });

  it('quit_date tracks elapsed days toward end date', () => {
    const goal = baseGoal({
      type: 'quit_date',
      targetValue: 30,
      currentBaseline: 10,
      startDate: '2025-04-01',
      endDate: '2025-04-30',
    });
    const p = evaluateGoal(goal, [], '2025-04-15');
    expect(p.valueTarget).toBeGreaterThan(0);
    expect(p.unit).toBe('days');
    expect(p.label).toContain('2025-04-30');
  });
});

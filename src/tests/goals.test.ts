import type { Goal } from '@/types';
import { evaluateGoal } from '@/domain/goals';
import { formatMoney } from '@/lib/format';

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
  completedAt: null,
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

  it('labels a spend cap in the profile currency', () => {
    const goal = baseGoal({ type: 'spend_cap_daily', targetValue: 13.5 });
    const eur = evaluateGoal(goal, [], '2025-04-18', { currency: 'EUR', locale: 'fr-FR' });
    expect(eur.label).toBe(`Daily spend cap: ${formatMoney(13.5, 'EUR', { locale: 'fr-FR' })}`);
    expect(eur.explanation).not.toContain('₹');
    expect(evaluateGoal(goal, [], '2025-04-18').label).toContain('₹');
  });

  describe('spend periods and taper', () => {
    const spendLog = (date: string, price: number) => ({
      id: `s-${date}`,
      tsUtc: `${date}T10:00:00.000Z`,
      localDate: date,
      localHour: 10,
      brandId: null,
      brandNameSnap: null,
      variantSnap: null,
      quantity: 1,
      purchaseMode: 'single' as const,
      packSize: null,
      totalPriceInr: price,
      unitPriceInr: price,
      priceSource: 'exact' as const,
      triggerTag: null,
      moodBefore: null,
      moodAfter: null,
      craving: null,
      contextTag: null,
      notes: null,
      createdAt: '',
      updatedAt: '',
    });
    // 2025-04-18 is a Friday: week starts Mon 2025-04-14, month starts 2025-04-01.
    const logs = [
      spendLog('2025-03-31', 1000),
      spendLog('2025-04-01', 100),
      spendLog('2025-04-13', 200),
      spendLog('2025-04-14', 10),
      spendLog('2025-04-17', 20),
      spendLog('2025-04-18', 30),
    ];
    const inr = (n: number) => formatMoney(n, 'INR');

    it('weekly spend sums Monday..today only', () => {
      const g = baseGoal({ type: 'spend_cap_daily', targetValue: 500, meta: { period: 'week' } });
      const p = evaluateGoal(g, logs, '2025-04-18');
      expect(p.valueCurrent).toBe(60);
      expect(p.label).toBe(`Weekly spend cap: ${inr(500)}`);
      expect(p.explanation).toBe(`You have spent ${inr(60)} of ${inr(500)} this week.`);
    });

    it('monthly spend sums 1st..today', () => {
      const g = baseGoal({ type: 'spend_cap_daily', targetValue: 500, meta: { period: 'month' } });
      const p = evaluateGoal(g, logs, '2025-04-18');
      expect(p.valueCurrent).toBe(360);
      expect(p.label).toBe(`Monthly spend cap: ${inr(500)}`);
      expect(p.explanation).toBe(`You have spent ${inr(360)} of ${inr(500)} this month.`);
    });

    it('a spend goal without a period is still daily', () => {
      const g = baseGoal({ type: 'spend_cap_daily', targetValue: 50 });
      const p = evaluateGoal(g, logs, '2025-04-18');
      expect(p.valueCurrent).toBe(30);
      expect(p.label).toBe(`Daily spend cap: ${inr(50)}`);
      expect(p.explanation).toBe(`You have spent ${inr(30)} of ${inr(50)} today.`);
    });

    it('taper labels the step cap and final target', () => {
      const g = baseGoal({ type: 'taper', targetValue: 8, meta: { finalTarget: 3 } });
      const p = evaluateGoal(g, [], '2025-04-18');
      expect(p.label).toBe('Taper: 8/day → 3');
      expect(p.explanation).toBe('Step 1: 0 of 8 today.');
      expect(p.valueTarget).toBe(8);
      expect(p.unit).toBe('sticks');
    });

    it('taper omits the arrow without a final target and counts steps', () => {
      const steps = [
        { cap: 10, from: '2025-04-01', reason: 'start' as const },
        { cap: 8, from: '2025-04-10', reason: 'next' as const },
      ];
      const g = baseGoal({ type: 'taper', targetValue: 8, meta: { steps } });
      const p = evaluateGoal(g, [], '2025-04-18');
      expect(p.label).toBe('Taper: 8/day');
      expect(p.explanation).toBe('Step 2: 0 of 8 today.');
    });
  });
});

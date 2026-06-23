import {
  deriveUnitPrice,
  resolveLogUnitPrice,
  dailyStats,
  rollingAvgSticks,
  dayShift,
  brandSpendMix,
  trendVsBaseline,
  smokeFreeStreak,
  forecastMonthlySpend,
} from '@/domain/calc';
import { potentialSavings, actualSavings, deriveBaselinePerDay } from '@/domain/savings';
import type { CigaretteLog } from '@/types';

function mkLog(overrides: Partial<CigaretteLog>): CigaretteLog {
  return {
    id: overrides.id ?? Math.random().toString(36).slice(2),
    tsUtc: overrides.tsUtc ?? '2025-03-01T10:00:00.000Z',
    localDate: overrides.localDate ?? '2025-03-01',
    localHour: overrides.localHour ?? 15,
    brandId: overrides.brandId ?? 'b1',
    brandNameSnap: overrides.brandNameSnap ?? 'Gold Flake',
    variantSnap: overrides.variantSnap ?? 'Kings',
    quantity: overrides.quantity ?? 1,
    purchaseMode: overrides.purchaseMode ?? 'single',
    packSize: overrides.packSize ?? null,
    totalPriceInr: overrides.totalPriceInr ?? 20,
    unitPriceInr: overrides.unitPriceInr ?? 20,
    priceSource: overrides.priceSource ?? 'exact',
    triggerTag: overrides.triggerTag ?? null,
    moodBefore: overrides.moodBefore ?? null,
    moodAfter: overrides.moodAfter ?? null,
    craving: overrides.craving ?? null,
    contextTag: overrides.contextTag ?? null,
    notes: overrides.notes ?? null,
    createdAt: overrides.createdAt ?? '2025-03-01T10:00:00.000Z',
    updatedAt: overrides.updatedAt ?? '2025-03-01T10:00:00.000Z',
  };
}

describe('resolveLogUnitPrice (per-stick authority)', () => {
  it('honours a typed per-stick price regardless of quantity', () => {
    const r = resolveLogUnitPrice({ perStickInr: 25, quantity: 4 });
    expect(r.unitPriceInr).toBe(25);
    expect(r.totalPriceInr).toBe(100);
    expect(r.source).toBe('exact');
  });

  it('typed per-stick price always wins over an inferred default', () => {
    const r = resolveLogUnitPrice({ perStickInr: 30, quantity: 1, inferredUnitInr: 12 });
    expect(r.unitPriceInr).toBe(30);
    expect(r.source).toBe('exact');
  });

  it('falls back to inferred only when nothing is typed', () => {
    const r = resolveLogUnitPrice({ perStickInr: null, quantity: 3, inferredUnitInr: 18.5 });
    expect(r.unitPriceInr).toBe(18.5);
    expect(r.totalPriceInr).toBe(55.5);
    expect(r.source).toBe('inferred');
  });

  it('returns unknown when nothing typed and nothing inferred', () => {
    const r = resolveLogUnitPrice({ perStickInr: null, quantity: 2 });
    expect(r.unitPriceInr).toBeNull();
    expect(r.totalPriceInr).toBeNull();
    expect(r.source).toBe('unknown');
  });

  it('accepts a free stick (₹0) as an exact typed price', () => {
    const r = resolveLogUnitPrice({ perStickInr: 0, quantity: 2, inferredUnitInr: 20 });
    expect(r.unitPriceInr).toBe(0);
    expect(r.totalPriceInr).toBe(0);
    expect(r.source).toBe('exact');
  });
});

describe('deriveUnitPrice', () => {
  it('computes single-stick price from explicit total', () => {
    const r = deriveUnitPrice({
      quantity: 1,
      purchaseMode: 'single',
      packSize: null,
      totalPriceInr: 20,
    });
    expect(r.unitPriceInr).toBe(20);
    expect(r.totalPriceInr).toBe(20);
    expect(r.source).toBe('exact');
  });

  it('divides pack price by pack size', () => {
    const r = deriveUnitPrice({
      quantity: 2,
      purchaseMode: 'pack',
      packSize: 10,
      totalPriceInr: 200,
    });
    expect(r.unitPriceInr).toBe(20);
    expect(r.totalPriceInr).toBe(40);
    expect(r.source).toBe('exact');
  });

  it('uses inferred price when total is missing', () => {
    const r = deriveUnitPrice({
      quantity: 1,
      purchaseMode: 'single',
      packSize: null,
      totalPriceInr: null,
      inferredUnitInr: 18.5,
    });
    expect(r.unitPriceInr).toBe(18.5);
    expect(r.source).toBe('inferred');
  });

  it('returns unknown source when no data available', () => {
    const r = deriveUnitPrice({
      quantity: 1,
      purchaseMode: 'single',
      packSize: null,
      totalPriceInr: null,
    });
    expect(r.source).toBe('unknown');
    expect(r.unitPriceInr).toBeNull();
  });

  it('handles carton pricing with pack size', () => {
    const r = deriveUnitPrice({
      quantity: 1,
      purchaseMode: 'carton',
      packSize: 10,
      totalPriceInr: 1800, // 10 packs of 10 sticks
    });
    expect(r.unitPriceInr).toBe(18);
  });
});

describe('dailyStats + rollingAvgSticks', () => {
  const logs: CigaretteLog[] = [
    mkLog({ localDate: '2025-03-01', quantity: 3 }),
    mkLog({ localDate: '2025-03-02', quantity: 5 }),
    mkLog({ localDate: '2025-03-02', quantity: 2 }),
    mkLog({ localDate: '2025-03-03', quantity: 0 }),
  ];

  it('bucket counts per day, filling zero days', () => {
    const stats = dailyStats(logs, '2025-03-01', '2025-03-04');
    expect(stats.map((s) => s.sticks)).toEqual([3, 7, 0, 0]);
  });

  it('rolling average across window', () => {
    const avg = rollingAvgSticks(logs, '2025-03-04', 4);
    expect(avg).toBeCloseTo((3 + 7 + 0 + 0) / 4);
  });
});

describe('dayShift', () => {
  it('shifts forward and backward', () => {
    expect(dayShift('2025-03-01', 1)).toBe('2025-03-02');
    expect(dayShift('2025-03-01', -1)).toBe('2025-02-28');
  });
});

describe('brandSpendMix', () => {
  it('computes shares across brands', () => {
    const logs = [
      mkLog({ brandNameSnap: 'A', totalPriceInr: 100, localDate: '2025-03-01' }),
      mkLog({ brandNameSnap: 'B', totalPriceInr: 50, localDate: '2025-03-01' }),
      mkLog({ brandNameSnap: 'A', totalPriceInr: 50, localDate: '2025-03-02' }),
    ];
    const mix = brandSpendMix(logs, '2025-03-01', '2025-03-02');
    expect(mix[0]!.brand).toBe('A');
    expect(mix[0]!.spendInr).toBe(150);
    expect(mix[0]!.share).toBeCloseTo(0.75);
  });
});

describe('potentialSavings', () => {
  it('sums avoided sticks × avg unit price', () => {
    const logs: CigaretteLog[] = [
      mkLog({ localDate: '2025-03-01', quantity: 5, unitPriceInr: 20, totalPriceInr: 100 }),
      mkLog({ localDate: '2025-03-02', quantity: 3, unitPriceInr: 20, totalPriceInr: 60 }),
      mkLog({ localDate: '2025-03-03', quantity: 0, unitPriceInr: 20, totalPriceInr: 0 }),
    ];
    const r = potentialSavings({
      logs,
      baselinePerDay: 10,
      sinceYmd: '2025-03-01',
      untilYmd: '2025-03-03',
    });
    // avoided = (10-5)+(10-3)+(10-0) = 22 sticks × 20 = 440
    expect(r.sticksAvoided).toBe(22);
    expect(r.totalInr).toBe(440);
  });

  it('handles zero unit price gracefully', () => {
    const r = potentialSavings({
      logs: [],
      baselinePerDay: 10,
      sinceYmd: '2025-03-01',
      untilYmd: '2025-03-02',
    });
    expect(r.totalInr).toBe(0);
  });
});

describe('actualSavings', () => {
  it('clamps display value to non-negative', () => {
    const logs: CigaretteLog[] = [
      mkLog({ localDate: '2025-03-01', totalPriceInr: 300 }),
      mkLog({ localDate: '2025-03-02', totalPriceInr: 50 }),
    ];
    const r = actualSavings({
      logs,
      expectedSpendPerDay: 200,
      sinceYmd: '2025-03-01',
      untilYmd: '2025-03-02',
    });
    // day 1: 200-300 = -100 (clamped 0); day 2: 200-50 = 150 → display 150
    expect(r.displayInr).toBe(150);
    expect(r.rawDeltaInr).toBe(50);
  });
});

describe('deriveBaselinePerDay', () => {
  it('uses yesterday as end anchor', () => {
    const logs = [mkLog({ localDate: '2025-03-01', quantity: 10 })];
    const r = deriveBaselinePerDay(logs, 1, '2025-03-02');
    expect(r).toBe(10);
  });
});

describe('trendVsBaseline', () => {
  it('computes negative delta when recent avg is lower', () => {
    const logs: CigaretteLog[] = [];
    // baseline window: days -36..-7 (30 days). current window: days -6..0 (7 days).
    for (let i = 7; i < 37; i++) logs.push(mkLog({ localDate: dayShift('2025-04-01', -i), quantity: 10 }));
    for (let i = 0; i < 7; i++) logs.push(mkLog({ localDate: dayShift('2025-04-01', -i), quantity: 5 }));
    const t = trendVsBaseline(logs, '2025-04-01', 7, 30);
    expect(t.deltaPct).toBeLessThan(0);
  });
});

describe('smokeFreeStreak', () => {
  it('counts trailing zero-smoke days', () => {
    const logs = [mkLog({ localDate: '2025-03-28', quantity: 3 })];
    expect(smokeFreeStreak(logs, '2025-04-01')).toBe(4);
  });
});

describe('forecastMonthlySpend', () => {
  it('extrapolates daily average to month end', () => {
    const logs = [
      mkLog({ localDate: '2025-03-01', totalPriceInr: 100 }),
      mkLog({ localDate: '2025-03-02', totalPriceInr: 100 }),
    ];
    const r = forecastMonthlySpend(logs, '2025-03-02');
    // perDay = 200/2 = 100; days-in-month March = 31
    expect(r.forecast).toBeCloseTo(3100);
  });
});

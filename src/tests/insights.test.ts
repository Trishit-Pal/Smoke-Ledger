import { generateInsights } from '@/domain/insights';
import type { CigaretteLog } from '@/types';

function mk(date: string, overrides: Partial<CigaretteLog> = {}): CigaretteLog {
  return {
    id: Math.random().toString(36).slice(2),
    tsUtc: `${date}T12:00:00.000Z`,
    localDate: date,
    localHour: overrides.localHour ?? 12,
    brandId: 'b1',
    brandNameSnap: overrides.brandNameSnap ?? 'Gold Flake',
    variantSnap: 'Kings',
    quantity: overrides.quantity ?? 1,
    purchaseMode: 'single',
    packSize: null,
    totalPriceInr: overrides.totalPriceInr ?? 20,
    unitPriceInr: overrides.unitPriceInr ?? 20,
    priceSource: 'exact',
    triggerTag: overrides.triggerTag ?? null,
    moodBefore: null,
    moodAfter: null,
    craving: null,
    contextTag: null,
    notes: null,
    createdAt: `${date}T12:00:00.000Z`,
    updatedAt: `${date}T12:00:00.000Z`,
  };
}

describe('generateInsights', () => {
  it('returns a bootstrap insight when below 3 logs', () => {
    const ins = generateInsights([mk('2025-04-01')], '2025-04-01');
    expect(ins).toHaveLength(1);
    expect(ins[0]!.title).toMatch(/Log a few entries/);
  });

  it('detects time-of-day peak when concentrated', () => {
    const logs: CigaretteLog[] = [];
    // Heavy at 08:00 for 30 days
    for (let i = 0; i < 30; i++) {
      const d = `2025-04-${String((i % 30) + 1).padStart(2, '0')}`;
      logs.push(mk(d, { localHour: 8 }));
      logs.push(mk(d, { localHour: 8 }));
    }
    const ins = generateInsights(logs, '2025-04-30');
    expect(ins.some((i) => /between\s\d+:00/.test(i.title))).toBe(true);
  });

  it('detects trigger concentration at >=30%', () => {
    const logs: CigaretteLog[] = [];
    for (let i = 1; i <= 10; i++) {
      const d = `2025-04-${String(i).padStart(2, '0')}`;
      logs.push(mk(d, { triggerTag: 'stress' }));
    }
    logs.push(mk('2025-04-11', { triggerTag: 'boredom' }));
    const ins = generateInsights(logs, '2025-04-11');
    expect(ins.some((i) => /stress/i.test(i.title))).toBe(true);
  });

  it('detects brand spend dominance', () => {
    const logs: CigaretteLog[] = [];
    for (let i = 1; i <= 10; i++) {
      const d = `2025-04-${String(i).padStart(2, '0')}`;
      logs.push(mk(d, { brandNameSnap: 'Alpha', totalPriceInr: 100 }));
      logs.push(mk(d, { brandNameSnap: 'Beta', totalPriceInr: 10 }));
    }
    const ins = generateInsights(logs, '2025-04-10');
    expect(ins.some((i) => /Alpha/.test(i.title))).toBe(true);
  });
});

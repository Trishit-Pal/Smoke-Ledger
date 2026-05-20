import { moodTriggerMatrix } from '@/domain/correlations';
import type { CigaretteLog } from '@/types';

const log = (mood: string | null, trigger: string | null, price: number | null = 15): CigaretteLog => ({
  id: Math.random().toString(36).slice(2),
  tsUtc: '2026-05-04T10:00:00Z',
  localDate: '2026-05-04',
  localHour: 10,
  brandId: null,
  brandNameSnap: null,
  variantSnap: null,
  quantity: 1,
  purchaseMode: 'single',
  packSize: null,
  totalPriceInr: price,
  unitPriceInr: price,
  priceSource: 'exact',
  triggerTag: trigger as any,
  moodBefore: mood as any,
  moodAfter: null,
  craving: null,
  contextTag: null,
  notes: null,
  createdAt: '2026-05-04T10:00:00Z',
  updatedAt: '2026-05-04T10:00:00Z',
});

describe('moodTriggerMatrix', () => {
  it('handles empty input', () => {
    const m = moodTriggerMatrix([]);
    expect(m.total).toBe(0);
    expect(m.cells).toEqual([]);
    expect(m.topPairs).toEqual([]);
  });

  it('skips logs missing mood or trigger', () => {
    const m = moodTriggerMatrix([log('stressed', null), log(null, 'after_meal'), log('calm', 'morning', 10)]);
    expect(m.total).toBe(1);
    expect(m.topPairs[0]?.mood).toBe('calm');
    expect(m.topPairs[0]?.trigger).toBe('morning');
    expect(m.topPairs[0]?.avgUnitPriceInr).toBe(10);
  });

  it('orders top pairs by count desc', () => {
    const logs = [
      log('stressed', 'work_break', 20),
      log('stressed', 'work_break', 22),
      log('stressed', 'work_break', null),
      log('calm', 'after_meal', 15),
      log('bored', 'social', 18),
      log('bored', 'social', 18),
    ];
    const m = moodTriggerMatrix(logs, 3);
    expect(m.topPairs.map((p) => `${p.mood}/${p.trigger}:${p.count}`)).toEqual([
      'stressed/work_break:3',
      'bored/social:2',
      'calm/after_meal:1',
    ]);
    // avg price for stressed/work_break = (20+22)/2 = 21 (one had null)
    expect(m.topPairs[0]?.avgUnitPriceInr).toBe(21);
  });

  it('returns sorted moods + triggers axes', () => {
    const m = moodTriggerMatrix([log('stressed', 'social'), log('calm', 'morning'), log('bored', 'after_meal')]);
    expect(m.moods).toEqual(['bored', 'calm', 'stressed']);
    expect(m.triggers).toEqual(['after_meal', 'morning', 'social']);
  });
});

// Mood × trigger correlation surface. Pure aggregation; no I/O.
import type { CigaretteLog } from '@/types';

export interface MoodTriggerPair {
  mood: string;
  trigger: string;
  count: number;
  avgUnitPriceInr: number | null;
}

export interface MoodTriggerMatrix {
  moods: string[];
  triggers: string[];
  cells: { mood: string; trigger: string; count: number }[];
  total: number;
  topPairs: MoodTriggerPair[];
}

export function moodTriggerMatrix(logs: CigaretteLog[], topK = 3): MoodTriggerMatrix {
  const counts = new Map<string, { count: number; sumPrice: number; nPrice: number }>();
  const moodSet = new Set<string>();
  const trigSet = new Set<string>();
  let total = 0;

  for (const l of logs) {
    if (!l.moodBefore || !l.triggerTag) continue;
    moodSet.add(l.moodBefore);
    trigSet.add(l.triggerTag);
    const k = `${l.moodBefore}|${l.triggerTag}`;
    const existing = counts.get(k) ?? { count: 0, sumPrice: 0, nPrice: 0 };
    existing.count += 1;
    if (l.unitPriceInr != null) {
      existing.sumPrice += l.unitPriceInr;
      existing.nPrice += 1;
    }
    counts.set(k, existing);
    total += 1;
  }

  const moods = [...moodSet].sort();
  const triggers = [...trigSet].sort();

  const cells = [];
  const allPairs: MoodTriggerPair[] = [];
  for (const [k, v] of counts.entries()) {
    const [mood, trigger] = k.split('|');
    if (!mood || !trigger) continue;
    cells.push({ mood, trigger, count: v.count });
    allPairs.push({
      mood,
      trigger,
      count: v.count,
      avgUnitPriceInr: v.nPrice > 0 ? Math.round((v.sumPrice / v.nPrice) * 100) / 100 : null,
    });
  }

  allPairs.sort((a, b) => b.count - a.count || a.mood.localeCompare(b.mood));
  return { moods, triggers, cells, total, topPairs: allPairs.slice(0, Math.max(1, topK)) };
}

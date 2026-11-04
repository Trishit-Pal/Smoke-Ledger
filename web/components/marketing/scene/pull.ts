/**
 * Pure helpers for the scene's two quiet pulls: the next recovery milestone on
 * app pages, and the glass jar of money kept on Home. No three.js, no DOM;
 * storage is injected so tests can fake it. Nothing here reads as a penalty:
 * a reset or a lapse only ever means "no sweep" or "no grain".
 */

import { dayShift } from '@/domain/calc';
import { formatMinutesUntil, milestoneProgress } from '@/domain/health';
import type { DailySummaryRow } from '@/domain/periodSummary';

export type MinimalStorage = { getItem(k: string): string | null; setItem(k: string, v: string): void };

export const MILESTONE_SEEN_KEY = 'scene-milestone-seen';
export const GRAIN_DAY_KEY = 'scene-grain-day';

const MILESTONE_CAPTION = 'Next, from your last entry';
/** Jar time constant, in days of baseline spend: about a week kept fills ~63%. */
const JAR_DAYS = 7;

export interface MilestoneLine {
  text: string;
  caption: string;
  /** Minutes of the latest milestone already reached, or null if none yet. */
  milestoneMinutes: number | null;
}

/** Milestone bodies are sentences ending in a period; drop one so the dash join reads cleanly. */
const stripPeriod = (s: string): string => s.replace(/\.$/, '');

export function milestoneLine(lastSmokeIso: string | null, now: Date): MilestoneLine | null {
  if (!lastSmokeIso) return null;
  const p = milestoneProgress(lastSmokeIso, now);
  const milestoneMinutes = p.current?.minutes ?? null;
  if (p.next) {
    return {
      text: `${stripPeriod(p.next.body)} — ${formatMinutesUntil(p.minutesToNext)}`,
      caption: MILESTONE_CAPTION,
      milestoneMinutes,
    };
  }
  if (!p.current) return null; // unreachable: no next means every milestone was reached
  return { text: `${stripPeriod(p.current.body)} — reached`, caption: MILESTONE_CAPTION, milestoneMinutes };
}

/**
 * True once when a newly reached milestone differs from the one last seen. The
 * first sighting and a reset (nothing reached) only record, never sweep.
 */
export function sweepDue(storage: MinimalStorage, milestoneMinutes: number | null): boolean {
  try {
    const value = String(milestoneMinutes ?? 0);
    const prev = storage.getItem(MILESTONE_SEEN_KEY);
    if (prev === value) return false;
    storage.setItem(MILESTONE_SEEN_KEY, value);
    return prev !== null && milestoneMinutes !== null;
  } catch {
    return false;
  }
}

/** Jar fill in [0, 1): 1 - e^(-total / (7 days of baseline spend)); saturates, never overflows. */
export function jarFill(totalMoney: number, baselinePerDay: number, unitPrice: number): number {
  const total = Number.isFinite(totalMoney) ? Math.max(0, totalMoney) : 0;
  const scale = JAR_DAYS * Math.max(baselinePerDay, 1) * Math.max(unitPrice, 1);
  return 1 - Math.exp(-total / scale);
}

/** Yesterday (no row = smoke-free) was below a positive baseline. Today never counts. */
export function underBaselineYesterday(rows: DailySummaryRow[], baselinePerDay: number, todayYmd: string): boolean {
  if (!(baselinePerDay > 0)) return false;
  const yesterday = dayShift(todayYmd, -1);
  const sticks = rows.find((r) => r.date === yesterday)?.sticks ?? 0;
  return sticks < baselinePerDay;
}

/** True at most once per day per storage, and only when yesterday came in under baseline. */
export function grainDue(storage: MinimalStorage, underBaseline: boolean, todayYmd: string): boolean {
  if (!underBaseline) return false;
  try {
    if (storage.getItem(GRAIN_DAY_KEY) === todayYmd) return false;
    storage.setItem(GRAIN_DAY_KEY, todayYmd);
    return true;
  } catch {
    return false;
  }
}

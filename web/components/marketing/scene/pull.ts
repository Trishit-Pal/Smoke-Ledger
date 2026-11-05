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
/** Jar half-fill point, in days of baseline spend: a week kept fills half. */
const JAR_DAYS = 7;

export interface MilestoneLine {
  text: string;
  caption: string;
  /** Minutes of the latest milestone already reached, or null if none yet. */
  milestoneMinutes: number | null;
}

/**
 * Milestone bodies are sentences ending in a period, and one carries its own dash.
 * Drop the period and turn inner dashes into "; " so the single " — " that joins the
 * time reads cleanly.
 */
const cleanBody = (s: string): string => s.replace(/\.$/, '').replace(/ — /g, '; ');

export function milestoneLine(lastSmokeIso: string | null, now: Date): MilestoneLine | null {
  if (!lastSmokeIso) return null;
  const p = milestoneProgress(lastSmokeIso, now);
  const milestoneMinutes = p.current?.minutes ?? null;
  if (p.next) {
    // minutesToNext is always >= 1 here: minutesSince floors to whole minutes and the
    // next milestone is, by definition, still ahead, so "in now" cannot occur.
    return {
      text: `${cleanBody(p.next.body)} — in ${formatMinutesUntil(p.minutesToNext)}`,
      caption: MILESTONE_CAPTION,
      milestoneMinutes,
    };
  }
  if (!p.current) return null; // unreachable: no next means every milestone was reached
  return { text: `${cleanBody(p.current.body)} — reached`, caption: MILESTONE_CAPTION, milestoneMinutes };
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

/**
 * Jar fill in [0, 1): total / (total + a week of baseline spend). Half full after one
 * week kept, 0.9 after nine, and a long tail that never reads full. A per-stick price
 * under 1 (EUR) is used as it is; only a missing or non-positive one falls back to 1.
 */
export function jarFill(totalMoney: number, baselinePerDay: number, unitPrice: number): number {
  const total = Number.isFinite(totalMoney) ? Math.max(0, totalMoney) : 0;
  const scale = JAR_DAYS * Math.max(baselinePerDay, 1) * (unitPrice > 0 ? unitPrice : 1);
  if (!Number.isFinite(scale)) return 0;
  return Math.min(total / (total + scale), 1 - Number.EPSILON);
}

/** Yesterday (no row = smoke-free) was below a positive baseline. Today never counts. */
export function underBaselineYesterday(rows: DailySummaryRow[], baselinePerDay: number, todayYmd: string): boolean {
  if (!(baselinePerDay > 0)) return false;
  const yesterday = dayShift(todayYmd, -1);
  const sticks = rows.find((r) => r.date === yesterday)?.sticks ?? 0;
  return sticks < baselinePerDay;
}

/**
 * A grain is earned only by a real yesterday: the reader has rows, and yesterday is on or
 * after their onboarding day (earlier days predate the ledger and would count as smoke-free).
 */
export function grainEligible(rows: DailySummaryRow[], baselinePerDay: number, todayYmd: string, sinceYmd: string): boolean {
  return rows.length > 0 && dayShift(todayYmd, -1) >= sinceYmd && underBaselineYesterday(rows, baselinePerDay, todayYmd);
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

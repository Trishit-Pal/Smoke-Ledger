// Savings engine: two explicit models (potential, actual).
// Formulas are documented in-code and surfaced in UI to maintain trust.

import type { CigaretteLog } from '@/types';
import { avgUnitPrice, dailyStats, dayShift, rollingAvgSticks, round2 } from './calc';
import { todayIst } from '@/lib/date';

export interface PotentialSavingsInput {
  logs: CigaretteLog[];
  baselinePerDay: number; // user-chosen or derived
  sinceYmd: string;       // inclusive
  untilYmd?: string;      // defaults to today
}

/**
 * Potential savings = sum over days of max(0, baseline - actual_sticks) * avgUnitPrice.
 * Interpretation: money *not spent* thanks to smoking less than baseline.
 */
export function potentialSavings(input: PotentialSavingsInput): {
  totalInr: number;
  sticksAvoided: number;
  avgUnitPriceUsed: number;
  days: number;
} {
  const endYmd = input.untilYmd ?? todayIst();
  const stats = dailyStats(input.logs, input.sinceYmd, endYmd);
  const unit = avgUnitPrice(input.logs) ?? 0;
  let sticksAvoided = 0;
  for (const s of stats) {
    const avoided = Math.max(0, input.baselinePerDay - s.sticks);
    sticksAvoided += avoided;
  }
  return {
    totalInr: round2(sticksAvoided * unit),
    sticksAvoided,
    avgUnitPriceUsed: unit,
    days: stats.length,
  };
}

export interface ActualSavingsInput {
  logs: CigaretteLog[];
  expectedSpendPerDay: number;
  sinceYmd: string;
  untilYmd?: string;
}

/**
 * Actual savings = sum over days of (expectedSpendPerDay - actualSpendThatDay).
 * We also return the raw delta (can be negative) for transparency.
 * The "for display" value clamps the daily delta to non-negative to avoid misleading totals.
 */
export function actualSavings(input: ActualSavingsInput): {
  rawDeltaInr: number;
  displayInr: number;
  days: number;
} {
  const endYmd = input.untilYmd ?? todayIst();
  const stats = dailyStats(input.logs, input.sinceYmd, endYmd);
  let raw = 0;
  let clamped = 0;
  for (const s of stats) {
    const delta = input.expectedSpendPerDay - s.spendInr;
    raw += delta;
    clamped += Math.max(0, delta);
  }
  return {
    rawDeltaInr: round2(raw),
    displayInr: round2(clamped),
    days: stats.length,
  };
}

/** Derive baseline sticks/day from user history using a chosen window. */
export function deriveBaselinePerDay(
  logs: CigaretteLog[],
  windowDays = 30,
  anchorYmd: string = todayIst(),
): number {
  // Use yesterday as endYmd so "today" doesn't skew baseline while still building up.
  const end = dayShift(anchorYmd, -1);
  return round2(rollingAvgSticks(logs, end, windowDays));
}

/** Derive baseline spend/day from history. */
export function deriveBaselineSpendPerDay(
  logs: CigaretteLog[],
  windowDays = 30,
  anchorYmd: string = todayIst(),
): number {
  const end = dayShift(anchorYmd, -1);
  const stats = dailyStats(logs, dayShift(end, -(windowDays - 1)), end);
  const total = stats.reduce((a, s) => a + s.spendInr, 0);
  return round2(total / windowDays);
}

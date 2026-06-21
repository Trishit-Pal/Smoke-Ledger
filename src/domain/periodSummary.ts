// Canonical timeframe aggregation over the per-day rows returned by the
// get_daily_summary RPC (server-aggregated, quantity-correct, up to 366 days).
// This is the SINGLE SOURCE OF TRUTH for dashboard + Trends *totals* across the
// rolling daily / weekly / monthly / yearly windows, so web and mobile cannot
// diverge and Year reconciles with Day/Week/Month. Pure functions, no I/O.

import { dateRange } from '@/lib/date';
import { dayShift, round2 } from './calc';

export interface DailySummaryRow {
  date: string; // YYYY-MM-DD (IST local_date)
  sticks: number; // SUM(quantity) for the day
  spendInr: number; // SUM(total_price_inr) for the day
  avgUnitPriceInr: number | null;
}

export interface WindowTotals {
  sticks: number;
  spendInr: number;
}

/** Sum sticks + spend over the trailing `windowDays` ending at `endYmd` (inclusive). */
export function totalsForWindow(
  rows: DailySummaryRow[],
  windowDays: number,
  endYmd: string,
): WindowTotals {
  if (windowDays <= 0) return { sticks: 0, spendInr: 0 };
  const startYmd = dayShift(endYmd, -(windowDays - 1));
  let sticks = 0;
  let spendInr = 0;
  for (const r of rows) {
    if (r.date >= startYmd && r.date <= endYmd) {
      sticks += r.sticks;
      spendInr += r.spendInr;
    }
  }
  return { sticks, spendInr: round2(spendInr) };
}

export interface PeriodTrend {
  current: WindowTotals;
  previous: WindowTotals;
  stickDeltaPct: number; // negative = fewer sticks than the previous period
  spendDeltaPct: number;
}

/** Current window vs the immediately-preceding window of the same length. */
export function periodWithTrend(
  rows: DailySummaryRow[],
  windowDays: number,
  endYmd: string,
): PeriodTrend {
  const current = totalsForWindow(rows, windowDays, endYmd);
  const prevEnd = dayShift(endYmd, -windowDays);
  const previous = totalsForWindow(rows, windowDays, prevEnd);
  return {
    current,
    previous,
    stickDeltaPct: pctDelta(current.sticks, previous.sticks),
    spendDeltaPct: pctDelta(current.spendInr, previous.spendInr),
  };
}

function pctDelta(current: number, previous: number): number {
  if (previous === 0) return current === 0 ? 0 : 100;
  return ((current - previous) / previous) * 100;
}

export interface SavedResult {
  totalInr: number;
  sticksAvoided: number;
}

function savedOverRange(
  rows: DailySummaryRow[],
  baselinePerDay: number,
  fallbackUnitPrice: number,
  startYmd: string,
  endYmd: string,
): SavedResult {
  const byDate = new Map(rows.map((r) => [r.date, r]));
  let totalInr = 0;
  let sticksAvoided = 0;
  for (const day of dateRange(startYmd, endYmd)) {
    const r = byDate.get(day);
    const sticks = r?.sticks ?? 0;
    const avoided = Math.max(0, baselinePerDay - sticks);
    // Prefer the day's own avg unit price; fall back (zero-stick / unpriced days).
    const unit = r?.avgUnitPriceInr != null ? r.avgUnitPriceInr : fallbackUnitPrice;
    sticksAvoided += avoided;
    totalInr += avoided * unit;
  }
  // sticksAvoided left raw (may be fractional when baseline is fractional),
  // matching calc.ts:potentialSavings; only the money total is rounded.
  return { totalInr: round2(totalInr), sticksAvoided };
}

/** Money not spent vs baseline over the trailing `windowDays`. */
export function savedForWindow(
  rows: DailySummaryRow[],
  baselinePerDay: number,
  fallbackUnitPrice: number,
  windowDays: number,
  endYmd: string,
): SavedResult {
  const startYmd = dayShift(endYmd, -(windowDays - 1));
  return savedOverRange(rows, baselinePerDay, fallbackUnitPrice, startYmd, endYmd);
}

/**
 * Money not spent vs baseline from `sinceYmd` (e.g. onboarding) through `endYmd`.
 * Iterates one entry per calendar day in range, so callers MUST bound `sinceYmd`
 * (the wiring passes `max(onboardedAt, daysAgoIst(365))`, matching the RPC's
 * 366-day cap) — an unbounded `sinceYmd` allocates one entry per day.
 */
export function savedAllTime(
  rows: DailySummaryRow[],
  baselinePerDay: number,
  fallbackUnitPrice: number,
  sinceYmd: string,
  endYmd: string,
): SavedResult {
  return savedOverRange(rows, baselinePerDay, fallbackUnitPrice, sinceYmd, endYmd);
}

/**
 * Consecutive smoke-free days ending at `endYmd`. An absent day OR a logged
 * zero-stick day is smoke-free; only a day with sticks > 0 ends the streak —
 * matching `smokeFreeStreak`'s `sticks === 0` predicate in calc.ts so the two
 * paths agree on overlapping inputs. Anchored at the earliest row so an account
 * with no recent data doesn't report an unbounded streak.
 */
export function streakFromRows(
  rows: DailySummaryRow[],
  endYmd: string,
  maxLookback = 365,
): number {
  if (!rows.length) return 0;
  const sticksByDate = new Map(rows.map((r) => [r.date, r.sticks]));
  const earliest = rows.reduce((a, r) => (r.date < a ? r.date : a), rows[0].date);
  let count = 0;
  let cur = endYmd;
  for (let i = 0; i < maxLookback; i++) {
    if (cur < earliest) break; // no evidence before the first logged day
    const sticks = sticksByDate.get(cur);
    if (sticks !== undefined && sticks > 0) break; // smoked that day
    count += 1; // absent or logged-zero day → smoke-free
    cur = dayShift(cur, -1);
  }
  return count;
}

/**
 * Stick-weighted average unit price across rows that carry a known price, or null.
 * Mirrors `calc.ts:avgUnitPrice` (Σ(unit×qty)/Σqty) over daily-summary rows rather
 * than raw logs — keep the two in lockstep if either changes.
 */
export function weightedAvgUnitPrice(rows: DailySummaryRow[]): number | null {
  let weighted = 0;
  let sticks = 0;
  for (const r of rows) {
    if (r.avgUnitPriceInr != null && r.sticks > 0) {
      weighted += r.avgUnitPriceInr * r.sticks;
      sticks += r.sticks;
    }
  }
  return sticks === 0 ? null : round2(weighted / sticks);
}

// Core calculation engine. Pure functions, no I/O. Fully unit tested.
// All monetary values are INR numbers.

import type { CigaretteLog, DailyStat, PriceSource } from '@/types';
import { dateRange, todayIst } from '@/lib/date';

export interface UnitPriceInput {
  quantity: number;
  purchaseMode: 'single' | 'pack' | 'carton' | 'custom';
  packSize: number | null;
  totalPriceInr: number | null;
  // Optional inferred reference price when total is missing.
  inferredUnitInr?: number | null;
}

export interface UnitPriceResult {
  unitPriceInr: number | null;
  totalPriceInr: number | null;
  source: PriceSource;
}

/**
 * Derives unit + total price using explicit, documented rules.
 *
 *  - 'single'  : total/qty if total provided, else inferred if available, else null.
 *  - 'pack'    : total = pack price; unit = total/packSize; multiply by qty for log total.
 *  - 'carton'  : total = carton price; unit = total/(packSize*10) default unless override.
 *  - 'custom'  : interpret total as total paid for current qty; unit = total/qty.
 */
export function deriveUnitPrice(i: UnitPriceInput): UnitPriceResult {
  const q = Math.max(1, i.quantity || 1);
  const total = i.totalPriceInr;
  const pack = i.packSize ?? null;

  if (i.purchaseMode === 'single') {
    if (total != null && total >= 0) {
      const unit = total / q;
      return { unitPriceInr: round2(unit), totalPriceInr: round2(total), source: 'exact' };
    }
    if (i.inferredUnitInr != null) {
      return {
        unitPriceInr: round2(i.inferredUnitInr),
        totalPriceInr: round2(i.inferredUnitInr * q),
        source: 'inferred',
      };
    }
    return { unitPriceInr: null, totalPriceInr: null, source: 'unknown' };
  }

  if (i.purchaseMode === 'pack') {
    if (total != null && pack && pack > 0) {
      const unit = total / pack;
      return {
        unitPriceInr: round2(unit),
        totalPriceInr: round2(unit * q),
        source: 'exact',
      };
    }
    if (i.inferredUnitInr != null) {
      return {
        unitPriceInr: round2(i.inferredUnitInr),
        totalPriceInr: round2(i.inferredUnitInr * q),
        source: 'inferred',
      };
    }
    return { unitPriceInr: null, totalPriceInr: null, source: 'unknown' };
  }

  if (i.purchaseMode === 'carton') {
    if (total != null && pack && pack > 0) {
      const cartonPacks = 10;
      const unit = total / (pack * cartonPacks);
      return {
        unitPriceInr: round2(unit),
        totalPriceInr: round2(unit * q),
        source: 'estimated',
      };
    }
    if (i.inferredUnitInr != null) {
      return {
        unitPriceInr: round2(i.inferredUnitInr),
        totalPriceInr: round2(i.inferredUnitInr * q),
        source: 'inferred',
      };
    }
    return { unitPriceInr: null, totalPriceInr: null, source: 'unknown' };
  }

  // 'custom'
  if (total != null && q > 0) {
    const unit = total / q;
    return {
      unitPriceInr: round2(unit),
      totalPriceInr: round2(total),
      source: 'exact',
    };
  }
  if (i.inferredUnitInr != null) {
    return {
      unitPriceInr: round2(i.inferredUnitInr),
      totalPriceInr: round2(i.inferredUnitInr * q),
      source: 'inferred',
    };
  }
  return { unitPriceInr: null, totalPriceInr: null, source: 'unknown' };
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export interface PerStickPriceInput {
  /** The price the user typed for ONE stick. null/undefined = not entered. */
  perStickInr: number | null;
  quantity: number;
  /** Reference price used ONLY when the user typed nothing. */
  inferredUnitInr?: number | null;
}

/**
 * Resolve unit + total price for a log entry whose price field is **per stick**.
 *
 * The typed per-stick price is authoritative: it is the unit price as-is (total =
 * unit × quantity) and is NEVER overridden by an inferred/catalog default. An
 * inferred price is used only when the user typed nothing. This is the single
 * source of truth for the web log form — it removes the total÷quantity surprise
 * and the pack-size fall-through that previously dropped a typed price in favour
 * of the default.
 */
export function resolveLogUnitPrice(i: PerStickPriceInput): UnitPriceResult {
  const q = Math.max(1, i.quantity || 1);
  const typed = i.perStickInr;
  if (typed != null && Number.isFinite(typed) && typed >= 0) {
    const unit = round2(typed);
    return { unitPriceInr: unit, totalPriceInr: round2(unit * q), source: 'exact' };
  }
  const inferred = i.inferredUnitInr;
  if (inferred != null && Number.isFinite(inferred) && inferred >= 0) {
    const unit = round2(inferred);
    return { unitPriceInr: unit, totalPriceInr: round2(unit * q), source: 'inferred' };
  }
  return { unitPriceInr: null, totalPriceInr: null, source: 'unknown' };
}

/** Group logs into DailyStat[], covering every day in [startYmd, endYmd] including zeros. */
export function dailyStats(logs: CigaretteLog[], startYmd: string, endYmd: string): DailyStat[] {
  const map = new Map<string, DailyStat>();
  for (const d of dateRange(startYmd, endYmd)) {
    map.set(d, { date: d, sticks: 0, spendInr: 0 });
  }
  for (const l of logs) {
    const cur = map.get(l.localDate);
    if (!cur) continue; // out of range
    cur.sticks += l.quantity;
    cur.spendInr += l.totalPriceInr ?? 0;
  }
  return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Average self-rated craving intensity (0..10) across logs with a non-null
 * `craving` value in [startYmd, endYmd]. Requires at least 3 tagged logs to
 * avoid a misleading average from sparse data — returns null below that
 * threshold, mirroring generateInsights()'s existing `logs.length >= 3` gate.
 */
export function avgCravingInWindow(
  logs: CigaretteLog[],
  startYmd: string,
  endYmd: string,
): number | null {
  const vals = logs
    .filter((l) => l.localDate >= startYmd && l.localDate <= endYmd && l.craving != null)
    .map((l) => l.craving as number);
  if (vals.length < 3) return null;
  return vals.reduce((acc, v) => acc + v, 0) / vals.length;
}

/** Rolling average sticks per day over a trailing window ending at endYmd (inclusive). */
export function rollingAvgSticks(
  logs: CigaretteLog[],
  endYmd: string,
  windowDays: number,
): number {
  if (windowDays <= 0) return 0;
  const startYmd = dateRange(
    dayShift(endYmd, -(windowDays - 1)),
    endYmd,
  )[0];
  const stats = dailyStats(logs, startYmd, endYmd);
  const total = stats.reduce((acc, s) => acc + s.sticks, 0);
  return total / windowDays;
}

/** Rolling average daily spend over a trailing window. */
export function rollingAvgSpend(
  logs: CigaretteLog[],
  endYmd: string,
  windowDays: number,
): number {
  if (windowDays <= 0) return 0;
  const startYmd = dayShift(endYmd, -(windowDays - 1));
  const stats = dailyStats(logs, startYmd, endYmd);
  const total = stats.reduce((acc, s) => acc + s.spendInr, 0);
  return total / windowDays;
}

export function dayShift(ymd: string, deltaDays: number): string {
  // Pure string math to avoid TZ drift. ymd is YYYY-MM-DD.
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + deltaDays);
  const iso = dt.toISOString().slice(0, 10);
  return iso;
}

/** Sum sticks on a given local date. */
export function sticksOn(logs: CigaretteLog[], ymd: string): number {
  return logs.reduce((acc, l) => (l.localDate === ymd ? acc + l.quantity : acc), 0);
}

/** Sum spend on a given local date. */
export function spendOn(logs: CigaretteLog[], ymd: string): number {
  return logs.reduce(
    (acc, l) => (l.localDate === ymd ? acc + (l.totalPriceInr ?? 0) : acc),
    0,
  );
}

export interface TrendDelta {
  currentPerDay: number;
  baselinePerDay: number;
  deltaPct: number; // negative = reduction
}

/** Compare current rolling avg vs baseline avg. */
export function trendVsBaseline(
  logs: CigaretteLog[],
  endYmd: string,
  currentWindow: number,
  baselineWindow: number,
): TrendDelta {
  const current = rollingAvgSticks(logs, endYmd, currentWindow);
  const baselineEnd = dayShift(endYmd, -currentWindow);
  const baseline = rollingAvgSticks(logs, baselineEnd, baselineWindow);
  const deltaPct = baseline === 0 ? (current === 0 ? 0 : 100) : ((current - baseline) / baseline) * 100;
  return { currentPerDay: current, baselinePerDay: baseline, deltaPct };
}

/** Forecast spend for the current month using spend-per-day-elapsed * days-in-month. */
export function forecastMonthlySpend(
  logs: CigaretteLog[],
  anchorYmd: string = todayIst(),
): { elapsedSpend: number; forecast: number; daysElapsed: number; daysInMonth: number } {
  const [y, m] = anchorYmd.split('-').map(Number);
  const firstOfMonth = `${y}-${String(m).padStart(2, '0')}-01`;
  const daysInMonth = new Date(y, m, 0).getDate();
  const daysElapsed = Number(anchorYmd.split('-')[2]);
  const stats = dailyStats(logs, firstOfMonth, anchorYmd);
  const elapsedSpend = stats.reduce((acc, s) => acc + s.spendInr, 0);
  const perDay = daysElapsed > 0 ? elapsedSpend / daysElapsed : 0;
  return {
    elapsedSpend: round2(elapsedSpend),
    forecast: round2(perDay * daysInMonth),
    daysElapsed,
    daysInMonth,
  };
}

/** Consecutive days ending at endYmd where predicate(day) is true. */
export function streak(
  logs: CigaretteLog[],
  endYmd: string,
  predicate: (stat: DailyStat) => boolean,
  maxLookback = 365,
): number {
  const startYmd = dayShift(endYmd, -(maxLookback - 1));
  const stats = dailyStats(logs, startYmd, endYmd).reverse();
  let count = 0;
  for (const s of stats) {
    if (predicate(s)) count += 1;
    else break;
  }
  return count;
}

/**
 * Counts consecutive zero-stick days ending at `endYmd`. To prevent an empty
 * log set (e.g. a brand-new account or a freshly wiped account) from
 * reporting an unbounded "streak", the streak is anchored at the earliest log
 * date or — if there are no logs at all — at `endYmd` (yielding zero).
 */
export function smokeFreeStreak(logs: CigaretteLog[], endYmd: string): number {
  if (!logs.length) return 0;
  const earliest = logs.reduce(
    (acc, l) => (l.localDate < acc ? l.localDate : acc),
    logs[0].localDate,
  );
  const window = Math.max(1, Math.min(365, Math.abs(diffDaysSafe(earliest, endYmd)) + 1));
  return streak(logs, endYmd, (s) => s.sticks === 0, window);
}

function diffDaysSafe(startYmd: string, endYmd: string): number {
  // Inline to avoid pulling dayjs into this pure module.
  const [sy, sm, sd] = startYmd.split('-').map(Number);
  const [ey, em, ed] = endYmd.split('-').map(Number);
  const start = Date.UTC(sy, sm - 1, sd);
  const end = Date.UTC(ey, em - 1, ed);
  return Math.round((end - start) / 86_400_000);
}

/** Most recent log (by tsUtc) or null. */
export function lastLog(logs: CigaretteLog[]): CigaretteLog | null {
  if (!logs.length) return null;
  return [...logs].sort((a, b) => b.tsUtc.localeCompare(a.tsUtc))[0];
}

/** Average unit price across logs with a known unit_price. */
export function avgUnitPrice(logs: CigaretteLog[]): number | null {
  const priced = logs.filter((l) => l.unitPriceInr != null && l.unitPriceInr >= 0);
  if (!priced.length) return null;
  const sum = priced.reduce((acc, l) => acc + (l.unitPriceInr ?? 0) * l.quantity, 0);
  const qty = priced.reduce((acc, l) => acc + l.quantity, 0);
  return qty === 0 ? null : round2(sum / qty);
}

/** Brand-wise spend distribution over a date range. */
export function brandSpendMix(
  logs: CigaretteLog[],
  startYmd: string,
  endYmd: string,
): { brand: string; spendInr: number; sticks: number; share: number }[] {
  const buckets = new Map<string, { spendInr: number; sticks: number }>();
  for (const l of logs) {
    if (l.localDate < startYmd || l.localDate > endYmd) continue;
    const key = l.brandNameSnap ?? 'Unknown';
    const cur = buckets.get(key) ?? { spendInr: 0, sticks: 0 };
    cur.spendInr += l.totalPriceInr ?? 0;
    cur.sticks += l.quantity;
    buckets.set(key, cur);
  }
  const total = Array.from(buckets.values()).reduce((a, b) => a + b.spendInr, 0);
  return Array.from(buckets.entries())
    .map(([brand, v]) => ({
      brand,
      spendInr: round2(v.spendInr),
      sticks: v.sticks,
      share: total === 0 ? 0 : v.spendInr / total,
    }))
    .sort((a, b) => b.spendInr - a.spendInr);
}

/** Hour-of-day distribution (0..23) of sticks smoked in range. */
export function hourDistribution(
  logs: CigaretteLog[],
  startYmd: string,
  endYmd: string,
): number[] {
  const arr = new Array(24).fill(0) as number[];
  for (const l of logs) {
    if (l.localDate < startYmd || l.localDate > endYmd) continue;
    arr[l.localHour] = (arr[l.localHour] ?? 0) + l.quantity;
  }
  return arr;
}

/** Day-of-week distribution (Mon..Sun) of sticks smoked in range. */
export function dowDistribution(
  logs: CigaretteLog[],
  startYmd: string,
  endYmd: string,
): number[] {
  // Return 7 buckets, Mon=0..Sun=6
  const arr = new Array(7).fill(0) as number[];
  for (const l of logs) {
    if (l.localDate < startYmd || l.localDate > endYmd) continue;
    const [y, m, d] = l.localDate.split('-').map(Number);
    const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0=Sun..6=Sat
    const idx = (dow + 6) % 7;
    arr[idx] = (arr[idx] ?? 0) + l.quantity;
  }
  return arr;
}

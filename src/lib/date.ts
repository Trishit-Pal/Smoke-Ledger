// Date helpers. India timezone assumed for local_date / local_hour fields.
// Uses dayjs for consistency; exports pure helpers for testability.

import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import customParseFormat from 'dayjs/plugin/customParseFormat';

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(customParseFormat);

export const IST = 'Asia/Kolkata';

export function nowUtcIso(): string {
  return dayjs().utc().toISOString();
}

export function toLocalDate(tsUtc: string): string {
  return dayjs.utc(tsUtc).tz(IST).format('YYYY-MM-DD');
}

export function toLocalHour(tsUtc: string): number {
  return dayjs.utc(tsUtc).tz(IST).hour();
}

export function formatIndianDate(date: string | Date): string {
  return dayjs(date).format('DD/MM/YYYY');
}

export function formatIndianDateTime(tsUtc: string): string {
  return dayjs.utc(tsUtc).tz(IST).format('DD/MM/YYYY, HH:mm');
}

export function formatTime(tsUtc: string): string {
  return dayjs.utc(tsUtc).tz(IST).format('HH:mm');
}

export function todayIst(): string {
  return dayjs().tz(IST).format('YYYY-MM-DD');
}

export function daysAgoIst(days: number): string {
  return dayjs().tz(IST).subtract(days, 'day').format('YYYY-MM-DD');
}

/** Returns list of YYYY-MM-DD strings from start to end inclusive. */
export function dateRange(startYmd: string, endYmd: string): string[] {
  const out: string[] = [];
  let cur = dayjs(startYmd);
  const end = dayjs(endYmd);
  while (cur.isSame(end) || cur.isBefore(end)) {
    out.push(cur.format('YYYY-MM-DD'));
    cur = cur.add(1, 'day');
  }
  return out;
}

export function daysBetween(a: string, b: string): number {
  return Math.abs(dayjs(b).diff(dayjs(a), 'day'));
}

/** Signed whole-day difference from `fromYmd` to `toYmd` (positive = `toYmd` is in the future). */
export function daysUntil(fromYmd: string, toYmd: string): number {
  return dayjs(toYmd).diff(dayjs(fromYmd), 'day');
}

export function startOfWeekIst(ymd?: string): string {
  // Week starts Monday for India convention in this app.
  const d = ymd
    ? dayjs.tz(`${ymd} 12:00`, 'YYYY-MM-DD HH:mm', IST)
    : dayjs().tz(IST);
  const dow = d.day(); // 0 Sun..6 Sat
  const diff = (dow + 6) % 7;
  return d.subtract(diff, 'day').format('YYYY-MM-DD');
}

export function startOfMonthIst(ymd?: string): string {
  const d = ymd
    ? dayjs.tz(`${ymd} 12:00`, 'YYYY-MM-DD HH:mm', IST)
    : dayjs().tz(IST);
  return d.startOf('month').format('YYYY-MM-DD');
}

export function dayOfWeekShort(ymd: string): string {
  return dayjs(ymd).format('ddd');
}

export function monthLabel(ymd: string): string {
  return dayjs(ymd).format('MMM YYYY');
}

export function hourBucketLabel(h: number): string {
  const start = String(h).padStart(2, '0');
  const end = String((h + 1) % 24).padStart(2, '0');
  return `${start}:00–${end}:00`;
}

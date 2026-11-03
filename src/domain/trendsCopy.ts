import { formatDelta } from '@/lib/format';
import { maskCount } from '@/lib/discreet';

/** One-line deck under the Trends headline pair; the whole line is hidden in discreet mode (web parity). */
export function headlineDeck(opts: {
  sticks: number;
  windowDays: number;
  avg: number;
  deltaPct: number;
  discreet: boolean;
}): string {
  if (opts.discreet) return 'Period totals — hidden.';
  if (opts.sticks === 0) {
    return opts.windowDays === 1 ? 'Nothing logged today.' : `Nothing logged across the last ${opts.windowDays} days.`;
  }
  const noun = opts.sticks === 1 ? 'cigarette' : 'cigarettes';
  const delta = formatDelta(opts.deltaPct);
  if (opts.windowDays === 1) return `${opts.sticks} ${noun} today, ${delta} vs the day before.`;
  return `${opts.sticks} ${noun} across ${opts.windowDays} days. Average ${opts.avg.toFixed(1)} per day, ${delta} vs the period before.`;
}

/** Caption under the daily-sticks line. */
export function avgLine(opts: { sticks: number; avg: number; discreet: boolean }): string {
  if (opts.sticks === 0) return 'A flat line. Nothing logged in this window.';
  if (opts.avg < 1) return 'A sparse window — most days quiet.';
  return `Around ${maskCount(opts.avg.toFixed(1), opts.discreet)} a day, on average.`;
}

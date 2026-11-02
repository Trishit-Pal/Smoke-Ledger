// The read-only tools the model may call. Every number the reader sees comes
// from here, computed by the same domain functions the screens use. The model
// never does arithmetic; it narrates around the rows these tools return.

import { z } from 'zod';
import type { ToolContext } from './context';
import type { Row, RowUnit } from './types';
import {
  brandSpendMix,
  dayShift,
  dowDistribution,
  forecastMonthlySpend,
  hourDistribution,
  round2,
} from '@/domain/calc';
import { moodTriggerMatrix } from '@/domain/correlations';
import { goalTypeLabel } from '@/domain/goalForm';
import { evaluateGoal } from '@/domain/goals';
import { generateInsights } from '@/domain/insights';
import { periodWithTrend, savedAllTime, totalsForWindow, weightedAvgUnitPrice } from '@/domain/periodSummary';
import { hourBucketLabel } from '@/lib/date';
import { formatMoney } from '@/lib/format';

export const TOOL_NAMES = [
  'compare_periods',
  'totals_in_window',
  'savings',
  'spend_outlook',
  'when_and_why',
  'brand_mix',
  'goal_status',
  'insights',
  'recent_entries',
] as const;

export type ToolName = (typeof TOOL_NAMES)[number];

/** Same shape the Messages API accepts for a client tool; kept SDK-free so jest can load it. */
export interface ToolDef {
  name: ToolName;
  description: string;
  strict: true;
  input_schema: {
    type: 'object';
    properties: Record<string, unknown>;
    required: string[];
    additionalProperties: false;
  };
}

export type ToolOutcome =
  | { ok: true; data: Record<string, unknown>; rows: Row[] }
  | { ok: false; error: string };

/** Raw-log window the Trends screen uses; tool numbers must match it. */
const LOG_WINDOW_DAYS = 90;
const RECENT_MAX_DAYS = 30;
const RECENT_MAX_ROWS = 200;
const NOTE_MAX_CHARS = 120;
const BRAND_MIX_TOP = 5;
const PEAK_HOURS = 3;
const PEAK_WEEKDAYS = 2;
const DOW_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const YMD = /^\d{4}-\d{2}-\d{2}$/;

const emptyInput = z.object({}).strict();
const comparePeriodsInput = z.object({ window: z.enum(['week', 'month']) }).strict();
const totalsInWindowInput = z
  .object({ startYmd: z.string().regex(YMD), endYmd: z.string().regex(YMD) })
  .strict();
const recentEntriesInput = z
  .object({ days: z.number().int().min(1).max(RECENT_MAX_DAYS) })
  .strict();

function schema(properties: Record<string, unknown>, required: string[] = []): ToolDef['input_schema'] {
  return { type: 'object', properties, required, additionalProperties: false };
}

export const TOOL_DEFS: readonly ToolDef[] = [
  {
    name: 'compare_periods',
    description:
      'Sticks and spend for the current week or 30 days against the period before it, with the percentage change. Use for "how am I doing", "this week vs last", "am I cutting down".',
    strict: true,
    input_schema: schema({ window: { type: 'string', enum: ['week', 'month'] } }, ['window']),
  },
  {
    name: 'totals_in_window',
    description:
      'Sticks, spend, and days with entries between two dates (inclusive, YYYY-MM-DD, at most a year). Use for any question about a specific date range.',
    strict: true,
    input_schema: schema(
      { startYmd: { type: 'string' }, endYmd: { type: 'string' } },
      ['startYmd', 'endYmd'],
    ),
  },
  {
    name: 'savings',
    description:
      'Money not spent and sticks avoided versus the user\'s baseline, for the last 30 days and all time. Use for "how much have I saved".',
    strict: true,
    input_schema: schema({}),
  },
  {
    name: 'spend_outlook',
    description:
      'Average daily spend over the last 30 days projected to a month and a year, plus this month\'s forecast. Use for "what does this cost me per year / per month".',
    strict: true,
    input_schema: schema({}),
  },
  {
    name: 'when_and_why',
    description:
      'Peak hours of the day, peak weekdays, and the most common mood and trigger pairings over the last 90 days. Use for "when do I smoke most", "why", "what sets me off".',
    strict: true,
    input_schema: schema({}),
  },
  {
    name: 'brand_mix',
    description: 'Share of spend by brand over the last 90 days. Use for brand questions.',
    strict: true,
    input_schema: schema({}),
  },
  {
    name: 'goal_status',
    description: 'Progress on each active goal. Use for "how am I doing on my goal".',
    strict: true,
    input_schema: schema({}),
  },
  {
    name: 'insights',
    description:
      'The app\'s own rules-based observations about the last 30 days (peak hour, dominant trigger, trend versus baseline, brand concentration).',
    strict: true,
    input_schema: schema({}),
  },
  {
    name: 'recent_entries',
    description:
      'Individual entries from the last N days (1 to 30): date, hour, quantity, trigger, moods, craving, context, brand, and the user\'s own note. Use only when a question needs the detail of single entries, such as "why" questions about particular days.',
    strict: true,
    // Strict mode accepts no numeric constraints; the 1–30 range is enforced by
    // recentEntriesInput (zod) and stated in the description.
    input_schema: schema({ days: { type: 'integer', description: `Days to include, 1 to ${RECENT_MAX_DAYS}` } }, ['days']),
  },
];

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function row(id: string, label: string, value: number | string, unit: RowUnit, tone?: Row['tone']): Row {
  return tone ? { id, label, value, unit, tone } : { id, label, value, unit };
}

function deltaTone(pct: number): Row['tone'] {
  if (pct < 0) return 'accent';
  if (pct > 0) return 'warn';
  return 'neutral';
}

function clampYmd(ymd: string, lo: string, hi: string): string {
  if (ymd < lo) return lo;
  if (ymd > hi) return hi;
  return ymd;
}

function logWindowStart(ctx: ToolContext): string {
  return dayShift(ctx.today, -(LOG_WINDOW_DAYS - 1));
}

function comparePeriods(input: z.infer<typeof comparePeriodsInput>, ctx: ToolContext): ToolOutcome {
  const windowDays = input.window === 'week' ? 7 : 30;
  const trend = periodWithTrend(ctx.rows, windowDays, ctx.today);
  const thisLabel = input.window === 'week' ? 'This week' : 'Last 30 days';
  const lastLabel = input.window === 'week' ? 'Last week' : 'Previous 30 days';
  const stickDeltaPct = round1(trend.stickDeltaPct);
  const spendDeltaPct = round1(trend.spendDeltaPct);
  return {
    ok: true,
    data: {
      window: input.window,
      windowDays,
      current: trend.current,
      previous: trend.previous,
      stickDeltaPct,
      spendDeltaPct,
    },
    rows: [
      row('compare.current.sticks', thisLabel, trend.current.sticks, 'sticks'),
      row('compare.previous.sticks', lastLabel, trend.previous.sticks, 'sticks'),
      row('compare.delta', 'Change', stickDeltaPct, 'percent', deltaTone(stickDeltaPct)),
      row('compare.current.spend', `Spend, ${thisLabel.toLowerCase()}`, trend.current.spendInr, 'money'),
      row('compare.previous.spend', `Spend, ${lastLabel.toLowerCase()}`, trend.previous.spendInr, 'money'),
    ],
  };
}

function totalsInWindow(input: z.infer<typeof totalsInWindowInput>, ctx: ToolContext): ToolOutcome {
  const startYmd = clampYmd(input.startYmd, ctx.summarySinceYmd, ctx.today);
  const endYmd = clampYmd(input.endYmd, ctx.summarySinceYmd, ctx.today);
  if (startYmd > endYmd) return { ok: false, error: 'start date is after end date' };
  let sticks = 0;
  let spendInr = 0;
  let daysWithEntries = 0;
  for (const r of ctx.rows) {
    if (r.date < startYmd || r.date > endYmd) continue;
    sticks += r.sticks;
    spendInr += r.spendInr;
    if (r.sticks > 0) daysWithEntries += 1;
  }
  spendInr = round2(spendInr);
  return {
    ok: true,
    data: { startYmd, endYmd, sticks, spendInr, daysWithEntries },
    rows: [
      row('totals.sticks', `Sticks, ${startYmd} to ${endYmd}`, sticks, 'sticks'),
      row('totals.spend', 'Spend', spendInr, 'money'),
      row('totals.days', 'Days with entries', daysWithEntries, 'days'),
    ],
  };
}

function savings(_input: unknown, ctx: ToolContext): ToolOutcome {
  const baseline = ctx.baselinePerDay;
  if (baseline == null) {
    return { ok: true, data: { unavailable: 'no_baseline' }, rows: [] };
  }
  // Exactly the dashboard's formula (DashboardClient): the summary's own
  // stick-weighted unit price as the fallback, both figures via savedAllTime.
  const fallbackUnit = weightedAvgUnitPrice(ctx.rows) ?? 0;
  const windowStart = dayShift(ctx.today, -29);
  const last30Start = windowStart > ctx.summarySinceYmd ? windowStart : ctx.summarySinceYmd;
  const last30 = savedAllTime(ctx.rows, baseline, fallbackUnit, last30Start, ctx.today);
  const allTime = savedAllTime(ctx.rows, baseline, fallbackUnit, ctx.summarySinceYmd, ctx.today);
  return {
    ok: true,
    data: {
      baselinePerDay: baseline,
      fallbackUnitPrice: fallbackUnit,
      last30: { startYmd: last30Start, totalInr: last30.totalInr, sticksAvoided: round1(last30.sticksAvoided) },
      allTime: { sinceYmd: ctx.summarySinceYmd, totalInr: allTime.totalInr, sticksAvoided: round1(allTime.sticksAvoided) },
    },
    rows: [
      row('savings.last30', 'Saved, last 30 days', last30.totalInr, 'money', last30.totalInr > 0 ? 'accent' : 'neutral'),
      row('savings.allTime', 'Saved, all time', allTime.totalInr, 'money', allTime.totalInr > 0 ? 'accent' : 'neutral'),
      row('savings.sticks', 'Sticks avoided, all time', Math.round(allTime.sticksAvoided), 'sticks'),
    ],
  };
}

function spendOutlook(_input: unknown, ctx: ToolContext): ToolOutcome {
  // The daily rate comes from the daily summary (uncapped, the screens' source of
  // truth), never from the 200-row log page, which a heavy logger fills in under
  // a month. ponytail: annualised = 30-day daily average × 365, inline.
  const perDay = round2(totalsForWindow(ctx.rows, 30, ctx.today).spendInr / 30);
  const perMonth = round2(perDay * 30);
  const perYear = round2(perDay * 365);
  // Month-to-date forecast stays on the same function Home shows.
  const forecast = forecastMonthlySpend(ctx.logs, ctx.today);
  return {
    ok: true,
    data: {
      basis: 'average daily spend over the last 30 days of the daily summary',
      perDay,
      perMonth,
      perYear,
      monthSoFar: forecast.elapsedSpend,
      monthForecast: forecast.forecast,
      daysElapsed: forecast.daysElapsed,
      daysInMonth: forecast.daysInMonth,
    },
    rows: [
      row('outlook.day', 'Per day', perDay, 'money'),
      row('outlook.month', 'Per month', perMonth, 'money'),
      row('outlook.year', 'Per year', perYear, 'money'),
      row('outlook.forecast', 'This month, forecast', forecast.forecast, 'money'),
    ],
  };
}

function topIndices(values: number[], count: number): number[] {
  return values
    .map((v, i) => ({ v, i }))
    .filter((x) => x.v > 0)
    .sort((a, b) => b.v - a.v || a.i - b.i)
    .slice(0, count)
    .map((x) => x.i);
}

function whenAndWhy(_input: unknown, ctx: ToolContext): ToolOutcome {
  const start = logWindowStart(ctx);
  const hours = hourDistribution(ctx.logs, start, ctx.today);
  const dows = dowDistribution(ctx.logs, start, ctx.today);
  const peakHours = topIndices(hours, PEAK_HOURS).map((h) => ({ hour: h, label: hourBucketLabel(h), sticks: hours[h] }));
  const peakWeekdays = topIndices(dows, PEAK_WEEKDAYS).map((d) => ({ weekday: DOW_LABELS[d], sticks: dows[d] }));
  const matrix = moodTriggerMatrix(ctx.logs, 3);
  const pairs = matrix.topPairs.map((p) => ({ mood: p.mood, trigger: p.trigger, count: p.count }));
  const rows: Row[] = [];
  if (peakHours.length) rows.push(row('when.hour', 'Peak hour', peakHours[0].label, 'text'));
  if (peakWeekdays.length) rows.push(row('when.weekday', 'Peak weekday', peakWeekdays[0].weekday, 'text'));
  if (pairs.length) rows.push(row('when.pair', 'Most common pairing', `${pairs[0].mood} · ${pairs[0].trigger}`, 'text'));
  return {
    ok: true,
    data: { windowDays: LOG_WINDOW_DAYS, peakHours, peakWeekdays, moodTriggerPairs: pairs, taggedEntries: matrix.total },
    rows,
  };
}

function brandMix(_input: unknown, ctx: ToolContext): ToolOutcome {
  const mix = brandSpendMix(ctx.logs, logWindowStart(ctx), ctx.today).slice(0, BRAND_MIX_TOP);
  const brands = mix.map((b) => ({ brand: b.brand, spendInr: b.spendInr, sticks: b.sticks, sharePct: round1(b.share * 100) }));
  return {
    ok: true,
    data: { windowDays: LOG_WINDOW_DAYS, brands },
    rows: brands.map((b, i) => row(`brand.${i}`, b.brand, b.sharePct, 'percent')),
  };
}

function goalUnit(unit: 'sticks' | 'inr' | 'days' | 'percent'): RowUnit {
  return unit === 'inr' ? 'money' : unit;
}

function goalStatus(_input: unknown, ctx: ToolContext): ToolOutcome {
  const money = { currency: ctx.currency, locale: ctx.locale };
  const active = ctx.goals.filter((g) => g.status === 'active');
  const progress = active.map((g) => evaluateGoal(g, ctx.logs, ctx.today, money));
  return {
    ok: true,
    data: { goals: progress.map(({ goalId: _goalId, ...rest }) => rest) },
    // The row label is the goal's type, never evaluateGoal's label, which embeds
    // the target ("Daily spend cap: ₹500") and would print it past the mask.
    rows: progress.map((p, i) =>
      row(`goal.${i}`, goalTypeLabel(active[i].type), p.valueCurrent, goalUnit(p.unit), p.isOnTrack ? 'accent' : 'warn'),
    ),
  };
}

function insights(_input: unknown, ctx: ToolContext): ToolOutcome {
  const money = (n: number) => formatMoney(n, ctx.currency, { locale: ctx.locale });
  const list = generateInsights(ctx.logs, ctx.today, money);
  // ponytail: no rows — insight titles are sentences, not figures; the narration carries them.
  return {
    ok: true,
    data: { insights: list.map(({ id: _id, generatedAt: _at, ...rest }) => rest) },
    rows: [],
  };
}

function cleanNote(note: string): string {
  return note.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, NOTE_MAX_CHARS);
}

function recentEntries(input: z.infer<typeof recentEntriesInput>, ctx: ToolContext): ToolOutcome {
  const startYmd = dayShift(ctx.today, -(input.days - 1));
  const inWindow = ctx.logs.filter((l) => l.localDate >= startYmd && l.localDate <= ctx.today);
  const entries = inWindow.slice(0, RECENT_MAX_ROWS).map((l) => {
    const base: Record<string, unknown> = {
      date: l.localDate,
      hour: l.localHour,
      quantity: l.quantity,
      trigger: l.triggerTag,
      moodBefore: l.moodBefore,
      moodAfter: l.moodAfter,
      craving: l.craving,
      context: l.contextTag,
      brand: l.brandNameSnap,
    };
    const note = l.notes ? cleanNote(l.notes) : '';
    return note ? { ...base, notes: note } : base;
  });
  return {
    ok: true,
    data: { days: input.days, startYmd, count: entries.length, truncated: inWindow.length > entries.length, entries },
    rows: [],
  };
}

type Runner = (input: unknown, ctx: ToolContext) => ToolOutcome;

function withInput<S extends z.ZodTypeAny>(schema: S, run: (input: z.infer<S>, ctx: ToolContext) => ToolOutcome): Runner {
  return (input, ctx) => {
    const parsed = schema.safeParse(input ?? {});
    return parsed.success ? run(parsed.data, ctx) : { ok: false, error: 'invalid input' };
  };
}

const RUNNERS: Record<ToolName, Runner> = {
  compare_periods: withInput(comparePeriodsInput, comparePeriods),
  totals_in_window: withInput(totalsInWindowInput, totalsInWindow),
  savings: withInput(emptyInput, savings),
  spend_outlook: withInput(emptyInput, spendOutlook),
  when_and_why: withInput(emptyInput, whenAndWhy),
  brand_mix: withInput(emptyInput, brandMix),
  goal_status: withInput(emptyInput, goalStatus),
  insights: withInput(emptyInput, insights),
  recent_entries: withInput(recentEntriesInput, recentEntries),
};

export function isToolName(name: string): name is ToolName {
  return (TOOL_NAMES as readonly string[]).includes(name);
}

/** Never throws: an unknown tool or bad input is an error outcome the model can read. */
export function runTool(name: string, input: unknown, ctx: ToolContext): ToolOutcome {
  if (!isToolName(name)) return { ok: false, error: `unknown tool: ${name}` };
  return RUNNERS[name](input, ctx);
}

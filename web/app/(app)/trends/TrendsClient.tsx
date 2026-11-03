'use client';

/*
 * ─────────────────────────────────────────────────────────────────────────────
 *  Trends — "Quiet editorial · the analysis spread"
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *  Aesthetic direction: Trends is the analysis spread of the same publication —
 *  the page where the daily ledger zooms out and the charts become editorial
 *  graphics rather than dashboard widgets. The period selector (Day · Week ·
 *  Month · Year) becomes a small-caps text run separated by middots, no chip
 *  pills. The headline pair under the masthead echoes Dashboard's hero numeral
 *  but is anchored to the selected period total — a slow mirror, not today's
 *  pulse. Charts shed their Card chrome and live flush with the typography,
 *  each headed by an editorial caption and a one-sentence deck describing
 *  what it says. A single ink-panel section (brand mix donut) carries the
 *  page's one moment of dramatic contrast.
 *
 *  Period chips are now text buttons. Active period is set in --text and
 *  underlined; inactive ones in --text-muted. Keyboard focusable, aria-pressed
 *  reflects the selection.
 *
 *  Motion: .editorial-stage choreography. Index allocation:
 *    0 = masthead, 1 = period chips, 2 = headline pair,
 *    3..9 = chart sections (in source order), 10 = end-mark.
 *
 *  Chart accuracy matrix (F1a):
 *
 *  Chart #1 — daily sticks line + spend bars:
 *    Year view (365d): FULL YEAR accurate — driven by `dailySummary` (server-side aggregate).
 *    Day/Week/Month views: use raw `logs` as before.
 *
 *  Charts #2–#5 — hour distribution, day-of-week, brand spend mix, mood×trigger matrix,
 *    day×hour heatmap: still driven by raw `logs` (90-day cap).
 *    Year view will display the same 90-day window as Month view for these breakdowns.
 *    Known limitation tracked as: F1 follow-on: full-Year breakdowns.
 *
 *  Discreet mode (isDiscreetMode(profile)) masks INR values via maskInr; the
 *  headline sticks numeral collapses to "•••" when totals are hidden.
 *
 *  Data path is unchanged. The pickDailyStats helper (F1a) and previousStats
 *  comparison are preserved.
 */

import * as React from 'react';
import {
  dayShift,
  hourDistribution,
  dowDistribution,
  brandSpendMix,
} from '@/domain/calc';
import { todayInZone, daysAgoInZone, dateRange } from '@/lib/date';
import { formatDelta, formatMoney } from '@/lib/format';
import { localeForCountry, timezoneForCountry } from '@/lib/regions';
import { isDiscreetMode, maskBrandAt, maskCount, maskInr } from '@/lib/discreet';

import { LineChart, BarChart, Donut } from '@web/components/charts/dynamic';
import { BarChart3D } from '@web/components/charts/BarChart3D';
import { CHART_SERIES } from '@web/components/charts/chartTheme';
import { Heatmap } from '@web/components/charts/Heatmap';
import { MoodTriggerMatrix } from '@web/components/charts/MoodTriggerMatrix';
import { Reveal } from '@web/components/anim/dynamic';
import { SectionLabel, ChoiceRun } from '@web/components/visual';
import { goalTypeLabel } from '@/domain/goalForm';
import { hasCapLine, pickCapGoal, withCapLine } from '@web/lib/goals/capLine';
import type { CigaretteLog, DailyStat, Goal, UserProfile } from '@/types';
import type { DailySummary } from '@web/lib/server/data';
import { brandRows } from '@web/lib/trends/brandRows';

type WindowDays = 1 | 7 | 30 | 365;

interface PeriodOption {
  label: string;
  days: WindowDays;
}

const PERIOD_OPTIONS: PeriodOption[] = [
  { label: 'Day', days: 1 },
  { label: 'Week', days: 7 },
  { label: 'Month', days: 30 },
  { label: 'Year', days: 365 },
];
const DOW_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export interface TrendsClientProps {
  profile: UserProfile;
  logs: CigaretteLog[];
  dailySummary: DailySummary[];
  /** Active goals: the first daily cap or taper is drawn as a dashed line on Daily sticks. */
  goals: Goal[];
}

/**
 * Zero-filled DailyStat array over [startYmd, endYmd] sourced from the server
 * `dailySummary` (quantity-correct, up to 365 days). ALL windows now use this
 * single source so Day/Week/Month/Year totals reconcile with each other and with
 * the dashboard, and none are silently truncated by the raw-log 200-row cap.
 */
function summaryStats(
  dailySummary: DailySummary[],
  startYmd: string,
  endYmd: string,
): DailyStat[] {
  const byDate = new Map(dailySummary.map((r) => [r.localDate, r]));
  return dateRange(startYmd, endYmd).map((d) => {
    const r = byDate.get(d);
    return { date: d, sticks: r?.sticks ?? 0, spendInr: r?.totalSpendInr ?? 0 };
  });
}

/** Tone for delta percentage: terracotta for up, teal for down (positive),
 *  neutral for stable. Never alarm red. Mirrors Dashboard. */
function deltaTone(deltaPct: number): 'up' | 'down' | 'flat' {
  if (!Number.isFinite(deltaPct)) return 'flat';
  if (deltaPct > 2) return 'up';
  if (deltaPct < -2) return 'down';
  return 'flat';
}

function deltaColor(tone: 'up' | 'down' | 'flat'): string {
  if (tone === 'up') return 'var(--warn-earth)';
  if (tone === 'down') return 'var(--accent)';
  return 'var(--text-muted)';
}

// Text-only variant: the shared deltaColor also feeds chart strokes, which keep the decorative token.
function deltaTextColor(tone: 'up' | 'down' | 'flat'): string {
  if (tone === 'up') return 'var(--warn-earth-ink)';
  if (tone === 'down') return 'var(--accent-ink)';
  return deltaColor(tone);
}

/** Editorial label for the masthead — pairs the static word "Trends" with the
 *  selected period. Reads as a section title in the publication. */
function windowLabel(days: WindowDays): string {
  switch (days) {
    case 1:
      return 'Today';
    case 7:
      return 'This week';
    case 30:
      return 'This month';
    case 365:
      return 'This year';
  }
}

/** One-line deck describing the headline pair, voiced honestly. */
function headlineDeck(opts: {
  sticks: number;
  windowDays: WindowDays;
  avg: number;
  deltaPct: number;
  hidden: boolean;
}): string {
  if (opts.hidden) return 'Period totals — hidden.';
  if (opts.sticks === 0) {
    if (opts.windowDays === 1) return 'Nothing logged today.';
    return `Nothing logged across the last ${opts.windowDays} days.`;
  }
  const delta = formatDelta(opts.deltaPct);
  if (opts.windowDays === 1) {
    return `${opts.sticks} ${opts.sticks === 1 ? 'cigarette' : 'cigarettes'} today, ${delta} vs the day before.`;
  }
  return `${opts.sticks} ${opts.sticks === 1 ? 'cigarette' : 'cigarettes'} across ${opts.windowDays} days. Average ${opts.avg.toFixed(1)} per day, ${delta} vs the period before.`;
}

export function TrendsClient({ profile, logs, dailySummary, goals }: TrendsClientProps) {
  const discreet = isDiscreetMode(profile);
  const [windowDays, setWindowDays] = React.useState<WindowDays>(30);

  const zone = timezoneForCountry(profile.country);
  const today = todayInZone(zone);
  const startYmd = daysAgoInZone(windowDays - 1, zone);
  const money = (value: number | null | undefined, opts?: { compact?: boolean }) =>
    formatMoney(value, profile.currency, { ...opts, locale: localeForCountry(profile.country) });

  const dependencyKey = `${windowDays}-${logs.length}-${dailySummary.length}`;

  const currentStats = React.useMemo(
    () => summaryStats(dailySummary, startYmd, today),
    [dailySummary, startYmd, today],
  );

  const previousStart = React.useMemo(
    () => dayShift(startYmd, -windowDays),
    [startYmd, windowDays],
  );
  const previousEnd = React.useMemo(() => dayShift(startYmd, -1), [startYmd]);
  const previousStats = React.useMemo(
    // Same source as the current period, so Day/Week/Month deltas are accurate
    // (no longer limited by the raw-log 200-row cap). Year's previous period sits
    // outside the 365-day summary, so its delta reads as "no prior data".
    () => summaryStats(dailySummary, previousStart, previousEnd),
    [dailySummary, previousStart, previousEnd],
  );

  const capGoal = React.useMemo(() => pickCapGoal(goals), [goals]);
  const sticksLine = React.useMemo(
    () =>
      withCapLine(
        currentStats.map((s) => ({ label: s.date.slice(5), value: s.sticks })),
        capGoal,
        currentStats.map((s) => s.date),
        true, // every window plots one point per day (summaryStats), so a daily cap is comparable
      ),
    [currentStats, capGoal],
  );

  const spendBars = React.useMemo(
    () =>
      currentStats.map((s) => ({
        label: s.date.slice(5),
        value: Math.round(s.spendInr),
      })),
    [currentStats],
  );

  const hours = React.useMemo(
    () => hourDistribution(logs, startYmd, today),
    [logs, startYmd, today],
  );
  const hourBars = React.useMemo(
    () =>
      hours.map((v, i) => ({
        label: `${String(i).padStart(2, '0')}h`,
        value: v,
      })),
    [hours],
  );

  const dows = React.useMemo(
    () => dowDistribution(logs, startYmd, today),
    [logs, startYmd, today],
  );
  const dowBars = React.useMemo(
    () => dows.map((v, i) => ({ label: DOW_LABELS[i] ?? '', value: v })),
    [dows],
  );

  const brandMix = React.useMemo(
    () => brandSpendMix(logs, startYmd, today).slice(0, 5),
    [logs, startYmd, today],
  );
  const donutSlices = React.useMemo(
    () =>
      brandMix.map((b) => ({
        label: b.brand,
        value: Math.round(b.spendInr),
      })),
    [brandMix],
  );

  const brandList = React.useMemo(() => brandRows(brandMix, discreet), [brandMix, discreet]);

  const totalSpend = React.useMemo(
    () => brandMix.reduce((acc, b) => acc + b.spendInr, 0),
    [brandMix],
  );

  const summary = React.useMemo(() => {
    const sticks = currentStats.reduce((acc, stat) => acc + stat.sticks, 0);
    const spend = currentStats.reduce((acc, stat) => acc + stat.spendInr, 0);
    const prevSticks = previousStats.reduce((acc, stat) => acc + stat.sticks, 0);
    const prevSpend = previousStats.reduce((acc, stat) => acc + stat.spendInr, 0);

    const stickDeltaPct =
      prevSticks === 0 ? (sticks === 0 ? 0 : 100) : ((sticks - prevSticks) / prevSticks) * 100;
    const spendDeltaPct =
      prevSpend === 0 ? (spend === 0 ? 0 : 100) : ((spend - prevSpend) / prevSpend) * 100;

    return {
      sticks,
      spend,
      avgSticksPerDay: sticks / windowDays,
      avgSpendPerDay: spend / windowDays,
      stickDeltaPct,
      spendDeltaPct,
    };
  }, [currentStats, previousStats, windowDays]);

  const stickTone = deltaTone(summary.stickDeltaPct);
  const spendTone = deltaTone(summary.spendDeltaPct);
  const stickToneColor = deltaColor(stickTone);

  const hasData = logs.length > 0;
  const periodLabel = windowLabel(windowDays);
  const isYear = windowDays === 365;

  // Editorial-stage CSS-variable indexing helper.
  const idx = (n: number) => ({ ['--ed-index' as string]: n } as React.CSSProperties);

  // Index allocation: 0 masthead, 1 chips, 2 headline pair,
  // 3..9 sections (sticks, spend, heatmap, hours, dow, mood, brand-mix), 10 end-mark.
  const TRAILING_INDEX = 10;

  return (
    <div className="relative page-column pt-xl pb-32 md:pt-xxl">
      {/* Atmospheric paper noise — purely decorative, behind everything. */}
      <div aria-hidden className="paper-noise absolute inset-0 -z-10" />

      <div className="editorial-stage flex flex-col section-gap">
        {/* ─────────────── Masthead ─────────────── */}
        <header style={idx(0)} className="flex flex-col group-tight">
          <div className="flex items-center gap-md">
            <span
              aria-hidden
              className="h-px flex-1 bg-[var(--rule-strong)] rule-draw"
              style={idx(0)}
            />
            <span className="editorial-caption nums-tabular">
              Trends · {periodLabel}
            </span>
            <span
              aria-hidden
              className="h-px flex-1 bg-[var(--rule-strong)] rule-draw"
              style={idx(0)}
            />
          </div>
          <p className="text-small text-text-muted text-center italic">
            The week, the month, the year — in one read.
          </p>
        </header>

        {/* ─────────────── Period selector — small-caps text run ─────────────── */}
        <div style={idx(1)} className="flex justify-center">
          <ChoiceRun
            ariaLabel="Select trend period"
            options={PERIOD_OPTIONS.map((p) => ({ value: p.days, label: p.label }))}
            value={windowDays}
            onSelect={(days) => {
              if (days !== null) setWindowDays(days);
            }}
            allowClear={false}
          />
        </div>

        {hasData ? (
          <>
            {/* ─────────────── Headline pair — the period in one number ─────────────── */}
            <section
              style={idx(2)}
              aria-labelledby="period-heading"
              className="flex flex-col gap-lg"
            >
              <h1 className="sr-only">Trends</h1>
              <h2 id="period-heading" className="sr-only">
                {periodLabel} totals
              </h2>

              <div className="flex items-end justify-between gap-lg flex-wrap">
                <div className="flex flex-col">
                  <span className="editorial-caption mb-sm">Sticks · {periodLabel.toLowerCase()}</span>
                  <div
                    className="editorial-numeral editorial-headline-rise nums-tabular"
                    role="img"
                    aria-label={
                      discreet
                        ? 'Period sticks total hidden'
                        : `${summary.sticks} ${summary.sticks === 1 ? 'cigarette' : 'cigarettes'} across the period`
                    }
                  >
                    {discreet ? '•••' : summary.sticks}
                  </div>
                  <span
                    className="text-small nums-tabular mt-xs"
                    style={{ color: deltaTextColor(stickTone) }}
                    aria-label={`Sticks change: ${formatDelta(summary.stickDeltaPct)} vs previous period`}
                  >
                    {formatDelta(summary.stickDeltaPct)}
                    <span className="text-text-faint"> vs previous</span>
                  </span>
                </div>
                <div className="flex flex-col items-end text-right ml-auto pb-sm">
                  <span className="editorial-caption mb-sm">Spend</span>
                  <div
                    className="editorial-numeral--small nums-tabular"
                    aria-label={
                      discreet
                        ? 'Period spend hidden'
                        : `Spent ${money(summary.spend)} across the period`
                    }
                  >
                    {maskInr(summary.spend, discreet, (n) => money(n, { compact: true }))}
                  </div>
                  <span
                    className="text-small nums-tabular mt-xs"
                    style={{ color: deltaTextColor(spendTone) }}
                    aria-label={`Spend change: ${formatDelta(summary.spendDeltaPct)} vs previous period`}
                  >
                    {formatDelta(summary.spendDeltaPct)}
                    <span className="text-text-faint"> vs previous</span>
                  </span>
                </div>
              </div>

              <p className="text-body text-text-muted max-w-[44ch]">
                {headlineDeck({
                  sticks: summary.sticks,
                  windowDays,
                  avg: summary.avgSticksPerDay,
                  deltaPct: summary.stickDeltaPct,
                  hidden: discreet,
                })}
              </p>

              {isYear ? (
                <p className="text-caption text-text-faint italic">
                  — Year-accurate: the sticks &amp; spend lines below are summed from
                  the server-side daily summary.
                </p>
              ) : null}
            </section>

            {/* ─────────────── Daily sticks — the line ─────────────── */}
            <section style={idx(3)} aria-labelledby="sticks-heading" className="flex flex-col gap-md">
              <div className="rule-hair-strong pt-md flex items-baseline justify-between gap-md">
                <SectionLabel id="sticks-heading" spacing="none">
                  Daily sticks
                </SectionLabel>
                <span className="text-caption text-text-faint nums-tabular">
                  {windowDays} {windowDays === 1 ? 'day' : 'days'}
                </span>
              </div>
              <Reveal dependencyKey={dependencyKey}>
                <LineChart
                  title="Daily sticks"
                  data={sticksLine}
                  height={180}
                  strokeColor={stickToneColor}
                  formatY={(v) => maskCount(v, discreet)}
                />
              </Reveal>
              <p className="text-small text-text-muted italic max-w-[48ch]">
                {summary.sticks === 0
                  ? 'A flat line. Nothing logged in this window.'
                  : summary.avgSticksPerDay < 1
                    ? 'A sparse week — most days quiet.'
                    : `Around ${maskCount(summary.avgSticksPerDay.toFixed(1), discreet)} a day, on average.`}
              </p>
              {capGoal && hasCapLine(sticksLine) ? (
                <p className="text-caption text-text-faint italic">
                  — dashed line: your {goalTypeLabel(capGoal.type).toLowerCase()}
                </p>
              ) : null}
            </section>

            {/* ─────────────── Daily spend — bars ─────────────── */}
            <section style={idx(4)} aria-labelledby="spend-heading" className="flex flex-col gap-md">
              <div className="rule-hair-strong pt-md flex items-baseline justify-between gap-md">
                <SectionLabel id="spend-heading" spacing="none">
                  Daily spend
                </SectionLabel>
                <span className="text-caption text-text-faint nums-tabular">
                  {maskInr(summary.spend, discreet, (n) => money(n, { compact: true }))} total
                </span>
              </div>
              <Reveal dependencyKey={dependencyKey}>
                <BarChart
                  title="Daily spend"
                  data={spendBars}
                  height={180}
                  formatY={(v) => maskInr(v, discreet, (n) => money(n, { compact: true }))}
                />
              </Reveal>
              <p className="text-small text-text-muted italic max-w-[48ch]">
                {summary.spend === 0
                  ? 'Nothing spent in this window.'
                  : `Average ${maskInr(summary.avgSpendPerDay, discreet, (n) => money(n, { compact: true }))} a day. The bars are the texture.`}
              </p>
            </section>

            {/* ─────────────── Day × hour heatmap ─────────────── */}
            <section style={idx(5)} aria-labelledby="heatmap-heading" className="flex flex-col gap-md">
              <div className="rule-hair-strong pt-md flex items-baseline justify-between gap-md">
                <SectionLabel id="heatmap-heading" spacing="none">
                  Day × hour
                </SectionLabel>
                <span className="text-caption text-text-faint">
                  When the week breathes
                </span>
              </div>
              <Reveal dependencyKey={dependencyKey}>
                <Heatmap
                  logs={logs}
                  startYmd={startYmd}
                  endYmd={today}
                  formatCount={(n) => maskCount(n, discreet)}
                />
              </Reveal>
              <p className="text-small text-text-muted italic max-w-[48ch]">
                The grid reads top-down by weekday, left-right by hour. Dark
                squares are where the habit lives.
              </p>
              {isYear ? (
                <p className="text-caption text-text-faint italic">
                  — Breakdown based on your last 90 days of data.
                </p>
              ) : null}
            </section>

            {/* ─────────────── Time of day ─────────────── */}
            <section style={idx(6)} aria-labelledby="hour-heading" className="flex flex-col gap-md">
              <div className="rule-hair-strong pt-md flex items-baseline justify-between gap-md">
                <SectionLabel id="hour-heading" spacing="none">
                  Time of day
                </SectionLabel>
                <span className="text-caption text-text-faint">
                  24-hour distribution
                </span>
              </div>
              <Reveal dependencyKey={dependencyKey}>
                <BarChart
                  title="Sticks by hour of day"
                  data={hourBars}
                  height={160}
                  formatY={(v) => maskCount(v, discreet)}
                  showYAxis={false}
                />
              </Reveal>
              <p className="text-small text-text-muted italic max-w-[48ch]">
                Mornings and evenings tend to spike. Quiet hours are the ones
                worth keeping.
              </p>
              {isYear ? (
                <p className="text-caption text-text-faint italic">
                  — Breakdown based on your last 90 days of data.
                </p>
              ) : null}
            </section>

            {/* ─────────────── Day of week ─────────────── */}
            <section style={idx(7)} aria-labelledby="dow-heading" className="flex flex-col gap-md">
              <div className="rule-hair-strong pt-md flex items-baseline justify-between gap-md">
                <SectionLabel id="dow-heading" spacing="none">
                  Day of week
                </SectionLabel>
                <span className="text-caption text-text-faint">
                  Mon — Sun
                </span>
              </div>
              <Reveal dependencyKey={dependencyKey}>
                <BarChart3D data={dowBars} formatValue={(v) => maskCount(v, discreet)} />
              </Reveal>
              <p className="text-small text-text-muted italic max-w-[48ch]">
                The shape of your week. Weekends and weekdays rarely match.
              </p>
              {isYear ? (
                <p className="text-caption text-text-faint italic">
                  — Breakdown based on your last 90 days of data.
                </p>
              ) : null}
            </section>

            {/* ─────────────── Mood × trigger ─────────────── */}
            <section style={idx(8)} aria-labelledby="mood-heading" className="flex flex-col gap-md">
              <div className="rule-hair-strong pt-md flex items-baseline justify-between gap-md">
                <SectionLabel id="mood-heading" spacing="none">
                  Mood × trigger
                </SectionLabel>
                <span className="text-caption text-text-faint">
                  Where it tends to start
                </span>
              </div>
              <Reveal dependencyKey={dependencyKey}>
                <MoodTriggerMatrix logs={logs} money={(n) => maskInr(n, discreet, money)} formatCount={(n) => maskCount(n, discreet)} />
              </Reveal>
              <p className="text-small text-text-muted italic max-w-[48ch]">
                A grid of feelings against situations. The dense cells are the
                pattern.
              </p>
              {isYear ? (
                <p className="text-caption text-text-faint italic">
                  — Breakdown based on your last 90 days of data.
                </p>
              ) : null}
            </section>

            {/* ─────────────── Brand spend — ink-panel donut ───────────────
                This is the one editorial contrast on the page. A colored donut
                set on the dark ink surface reads as the visual climax of the
                spread — the rest is paper, this is ink. */}
            <section style={idx(9)} aria-labelledby="brand-heading">
              <div className="ink-panel rounded-xl p-xl flex flex-col gap-lg">
                <div className="flex items-baseline justify-between gap-md">
                  <SectionLabel id="brand-heading" spacing="none" tone="inverse">
                    Brand spend · top 5
                  </SectionLabel>
                  <span
                    className="text-caption nums-tabular"
                    style={{ color: 'var(--ink-surface-muted)' }}
                  >
                    {maskInr(totalSpend, discreet, (n) => money(n, { compact: true }))}
                  </span>
                </div>

                {donutSlices.length === 0 ? (
                  <p className="text-small italic" style={{ color: 'var(--ink-surface-muted)' }}>
                    No priced logs in this window.
                  </p>
                ) : (
                  <Reveal dependencyKey={dependencyKey}>
                    <div className="flex flex-col sm:flex-row items-center gap-lg">
                      <Donut
                        title="Spend by brand"
                        slices={donutSlices}
                        size={160}
                        formatValue={(v) => maskInr(v, discreet, (n) => money(n, { compact: true }))}
                        formatLabel={(l, i) => maskBrandAt(l, i, discreet)}
                        centerLabel="TOTAL"
                        centerValue={maskInr(totalSpend, discreet, (n) =>
                          money(n, { compact: true }),
                        )}
                      />
                      <ul className="flex-1 w-full flex flex-col">
                        {brandMix.map((b, i) => (
                          <li
                            key={brandList[i]!.key}
                            className="flex items-center justify-between py-sm"
                            style={{
                              borderTop: i === 0 ? 'none' : '1px solid var(--ink-surface-rule)',
                            }}
                          >
                            <div className="flex items-center gap-sm min-w-0">
                              <span
                                aria-hidden
                                className="w-2 h-2 rounded-full shrink-0"
                                style={{
                                  backgroundColor: CHART_SERIES[i % CHART_SERIES.length],
                                }}
                              />
                              <span
                                className="text-small truncate"
                                style={{ color: 'var(--ink-surface-text)' }}
                              >
                                {brandList[i]!.name}
                              </span>
                            </div>
                            <span
                              className="text-small nums-tabular"
                              style={{ color: 'var(--ink-surface-muted)' }}
                            >
                              {maskInr(b.spendInr, discreet, (n) =>
                                money(n, { compact: true }),
                              )}
                              <span style={{ color: 'var(--ink-surface-muted)' }}> · </span>
                              {brandList[i]!.shareText}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </Reveal>
                )}
                {isYear ? (
                  <p
                    className="text-caption italic"
                    style={{ color: 'var(--ink-surface-muted)' }}
                  >
                    — Breakdown based on your last 90 days of data.
                  </p>
                ) : null}
              </div>
            </section>

            {/* ─────────────── End-mark ─────────────── */}
            <footer
              style={idx(TRAILING_INDEX)}
              className="rule-hair pt-md flex items-center justify-center"
            >
              <span className="text-caption text-text-faint italic">
                Numbers are a slow mirror.
              </span>
            </footer>
          </>
        ) : (
          /* ─────────────── Empty state — a quiet invitation ─────────────── */
          <section style={idx(2)} className="rule-hair pt-lg flex flex-col gap-sm">
            <p className="editorial-headline text-[clamp(1.125rem,2vw,1.375rem)] text-text">
              No data to chart yet.
            </p>
            <p className="text-body text-text-muted max-w-[40ch]">
              Once you log a few cigarettes, the charts and patterns of your
              week will print here.
            </p>
          </section>
        )}
      </div>
    </div>
  );
}

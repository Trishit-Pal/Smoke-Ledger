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
  dailyStats,
  dayShift,
  hourDistribution,
  dowDistribution,
  brandSpendMix,
} from '@/domain/calc';
import { todayIst, daysAgoIst } from '@/lib/date';
import { formatDelta, formatInr } from '@/lib/format';
import { isDiscreetMode, maskInr } from '@/lib/discreet';

import { LineChart, BarChart, AnimatedBarChart, Donut } from '@web/components/charts/dynamic';
import { Heatmap } from '@web/components/charts/Heatmap';
import { MoodTriggerMatrix } from '@web/components/charts/MoodTriggerMatrix';
import { Reveal } from '@web/components/anim/dynamic';
import type { CigaretteLog, DailyStat, UserProfile } from '@/types';
import type { DailySummary } from '@web/lib/server/data';

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
}

/**
 * Returns a DailyStat array appropriate for the sticks/spend time-series charts.
 *
 * For windowDays === 365, transforms the pre-aggregated `dailySummary` (365 rows from
 * the server-side RPC) into DailyStat shape — giving true full-year accuracy without
 * pulling raw logs.
 *
 * For narrower windows (1/7/30), falls back to `dailyStats(logs, ...)` to retain the
 * full raw-log path (including hour-level granularity if any future chart needs it).
 */
function pickDailyStats(
  windowDays: WindowDays,
  logs: CigaretteLog[],
  dailySummary: DailySummary[],
  startYmd: string,
  today: string,
): DailyStat[] {
  if (windowDays === 365) {
    return dailySummary
      .filter((r) => r.localDate >= startYmd && r.localDate <= today)
      .map((r) => ({ date: r.localDate, sticks: r.sticks, spendInr: r.totalSpendInr }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }
  return dailyStats(logs, startYmd, today);
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

export function TrendsClient({ profile, logs, dailySummary }: TrendsClientProps) {
  const discreet = isDiscreetMode(profile);
  const [windowDays, setWindowDays] = React.useState<WindowDays>(30);

  const today = todayIst();
  const startYmd = daysAgoIst(windowDays - 1);

  const dependencyKey = `${windowDays}-${logs.length}-${dailySummary.length}`;

  const currentStats = React.useMemo(
    () => pickDailyStats(windowDays, logs, dailySummary, startYmd, today),
    [windowDays, logs, dailySummary, startYmd, today],
  );

  const previousStart = React.useMemo(
    () => dayShift(startYmd, -windowDays),
    [startYmd, windowDays],
  );
  const previousEnd = React.useMemo(() => dayShift(startYmd, -1), [startYmd]);
  const previousStats = React.useMemo(() => {
    // Previous-period comparison always uses raw logs (only the current period
    // uses dailySummary for Year; prior-year comparison is out of F1a scope).
    return dailyStats(logs, previousStart, previousEnd);
  }, [logs, previousStart, previousEnd]);

  const sticksLine = React.useMemo(
    () =>
      currentStats.map((s) => ({
        label: s.date.slice(5),
        value: s.sticks,
      })),
    [currentStats],
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
  const spendToneColor = deltaColor(spendTone);

  const hasData = logs.length > 0;
  const periodLabel = windowLabel(windowDays);
  const isYear = windowDays === 365;

  // Editorial-stage CSS-variable indexing helper.
  const idx = (n: number) => ({ ['--ed-index' as string]: n } as React.CSSProperties);

  // Index allocation: 0 masthead, 1 chips, 2 headline pair,
  // 3..9 sections (sticks, spend, heatmap, hours, dow, mood, brand-mix), 10 end-mark.
  const TRAILING_INDEX = 10;

  return (
    <div className="relative mx-auto w-full max-w-[44rem] lg:max-w-[52rem] xl:max-w-[60rem] px-lg pt-xl pb-32 md:pt-xxl md:px-xxl">
      {/* Atmospheric paper noise — purely decorative, behind everything. */}
      <div aria-hidden className="paper-noise absolute inset-0 -z-10" />

      <div className="editorial-stage flex flex-col gap-xxl">
        {/* ─────────────── Masthead ─────────────── */}
        <header style={idx(0)} className="flex flex-col gap-sm">
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
        <nav
          style={idx(1)}
          aria-label="Select trend period"
          className="flex items-center justify-center"
        >
          <ul className="flex items-center gap-sm flex-wrap justify-center">
            {PERIOD_OPTIONS.map((period, i) => {
              const isActive = windowDays === period.days;
              return (
                <li key={period.days} className="flex items-center gap-sm">
                  <button
                    type="button"
                    onClick={() => setWindowDays(period.days)}
                    aria-pressed={isActive}
                    className="editorial-caption focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg rounded-sm transition-colors"
                    style={{
                      color: isActive ? 'var(--text)' : 'var(--text-muted)',
                      textDecoration: isActive ? 'underline' : 'none',
                      textDecorationColor: 'var(--rule-strong)',
                      textUnderlineOffset: '4px',
                      textDecorationThickness: '1px',
                      padding: '6px 4px',
                      minHeight: '32px',
                    }}
                  >
                    {period.label}
                  </button>
                  {i < PERIOD_OPTIONS.length - 1 ? (
                    <span aria-hidden className="text-text-faint" style={{ fontSize: 11 }}>
                      ·
                    </span>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </nav>

        {hasData ? (
          <>
            {/* ─────────────── Headline pair — the period in one number ─────────────── */}
            <section
              style={idx(2)}
              aria-labelledby="period-heading"
              className="flex flex-col gap-lg"
            >
              <h2 id="period-heading" className="sr-only">
                {periodLabel} totals
              </h2>

              <div className="flex items-end justify-between gap-lg flex-wrap">
                <div className="flex flex-col">
                  <span className="editorial-caption mb-sm">Sticks · {periodLabel.toLowerCase()}</span>
                  <div
                    className="editorial-numeral editorial-headline-rise nums-tabular"
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
                    style={{ color: stickToneColor }}
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
                        : `Spent ${formatInr(summary.spend)} across the period`
                    }
                  >
                    {maskInr(summary.spend, discreet, (n) => formatInr(n, { compact: true }))}
                  </div>
                  <span
                    className="text-small nums-tabular mt-xs"
                    style={{ color: spendToneColor }}
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
                <h2 id="sticks-heading" className="editorial-caption">
                  Daily sticks
                </h2>
                <span className="text-caption text-text-faint nums-tabular">
                  {windowDays} {windowDays === 1 ? 'day' : 'days'}
                </span>
              </div>
              <Reveal dependencyKey={dependencyKey}>
                <LineChart
                  data={sticksLine}
                  height={180}
                  strokeColor={stickToneColor}
                />
              </Reveal>
              <p className="text-small text-text-muted italic max-w-[48ch]">
                {summary.sticks === 0
                  ? 'A flat line. Nothing logged in this window.'
                  : summary.avgSticksPerDay < 1
                    ? 'A sparse week — most days quiet.'
                    : `Around ${summary.avgSticksPerDay.toFixed(1)} a day, on average.`}
              </p>
            </section>

            {/* ─────────────── Daily spend — bars ─────────────── */}
            <section style={idx(4)} aria-labelledby="spend-heading" className="flex flex-col gap-md">
              <div className="rule-hair-strong pt-md flex items-baseline justify-between gap-md">
                <h2 id="spend-heading" className="editorial-caption">
                  Daily spend
                </h2>
                <span className="text-caption text-text-faint nums-tabular">
                  {maskInr(summary.spend, discreet, (n) => formatInr(n, { compact: true }))} total
                </span>
              </div>
              <Reveal dependencyKey={dependencyKey}>
                <AnimatedBarChart
                  data={spendBars}
                  height={180}
                  formatY={(v) => formatInr(v, { compact: true })}
                />
              </Reveal>
              <p className="text-small text-text-muted italic max-w-[48ch]">
                {summary.spend === 0
                  ? 'Nothing spent in this window.'
                  : `Average ${maskInr(summary.avgSpendPerDay, discreet, (n) => formatInr(n, { compact: true }))} a day. The bars are the texture.`}
              </p>
            </section>

            {/* ─────────────── Day × hour heatmap ─────────────── */}
            <section style={idx(5)} aria-labelledby="heatmap-heading" className="flex flex-col gap-md">
              <div className="rule-hair-strong pt-md flex items-baseline justify-between gap-md">
                <h2 id="heatmap-heading" className="editorial-caption">
                  Day × hour
                </h2>
                <span className="text-caption text-text-faint">
                  When the week breathes
                </span>
              </div>
              <Reveal dependencyKey={dependencyKey}>
                <Heatmap logs={logs} startYmd={startYmd} endYmd={today} />
              </Reveal>
              <p className="text-small text-text-muted italic max-w-[48ch]">
                The grid reads top-down by weekday, left-right by hour. Dark
                squares are where the habit lives.
              </p>
              {isYear ? (
                <p className="text-caption text-text-faint italic">
                  — Showing the last 90 days. Longer history coming soon.
                </p>
              ) : null}
            </section>

            {/* ─────────────── Time of day ─────────────── */}
            <section style={idx(6)} aria-labelledby="hour-heading" className="flex flex-col gap-md">
              <div className="rule-hair-strong pt-md flex items-baseline justify-between gap-md">
                <h2 id="hour-heading" className="editorial-caption">
                  Time of day
                </h2>
                <span className="text-caption text-text-faint">
                  24-hour distribution
                </span>
              </div>
              <Reveal dependencyKey={dependencyKey}>
                <BarChart data={hourBars} height={160} />
              </Reveal>
              <p className="text-small text-text-muted italic max-w-[48ch]">
                Mornings and evenings tend to spike. Quiet hours are the ones
                worth keeping.
              </p>
              {isYear ? (
                <p className="text-caption text-text-faint italic">
                  — Showing the last 90 days. Longer history coming soon.
                </p>
              ) : null}
            </section>

            {/* ─────────────── Day of week ─────────────── */}
            <section style={idx(7)} aria-labelledby="dow-heading" className="flex flex-col gap-md">
              <div className="rule-hair-strong pt-md flex items-baseline justify-between gap-md">
                <h2 id="dow-heading" className="editorial-caption">
                  Day of week
                </h2>
                <span className="text-caption text-text-faint">
                  Mon — Sun
                </span>
              </div>
              <Reveal dependencyKey={dependencyKey}>
                <BarChart data={dowBars} height={160} />
              </Reveal>
              <p className="text-small text-text-muted italic max-w-[48ch]">
                The shape of your week. Weekends and weekdays rarely match.
              </p>
              {isYear ? (
                <p className="text-caption text-text-faint italic">
                  — Showing the last 90 days. Longer history coming soon.
                </p>
              ) : null}
            </section>

            {/* ─────────────── Mood × trigger ─────────────── */}
            <section style={idx(8)} aria-labelledby="mood-heading" className="flex flex-col gap-md">
              <div className="rule-hair-strong pt-md flex items-baseline justify-between gap-md">
                <h2 id="mood-heading" className="editorial-caption">
                  Mood × trigger
                </h2>
                <span className="text-caption text-text-faint">
                  Where it tends to start
                </span>
              </div>
              <Reveal dependencyKey={dependencyKey}>
                <MoodTriggerMatrix logs={logs} />
              </Reveal>
              <p className="text-small text-text-muted italic max-w-[48ch]">
                A grid of feelings against situations. The dense cells are the
                pattern.
              </p>
              {isYear ? (
                <p className="text-caption text-text-faint italic">
                  — Showing the last 90 days. Longer history coming soon.
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
                  <h2
                    id="brand-heading"
                    className="editorial-caption"
                    style={{ color: 'var(--ink-surface-muted)' }}
                  >
                    Brand spend · top 5
                  </h2>
                  <span
                    className="text-caption nums-tabular"
                    style={{ color: 'var(--ink-surface-muted)' }}
                  >
                    {maskInr(totalSpend, discreet, (n) => formatInr(n, { compact: true }))}
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
                        slices={donutSlices}
                        size={160}
                        centerLabel="TOTAL"
                        centerValue={maskInr(totalSpend, discreet, (n) =>
                          formatInr(n, { compact: true }),
                        )}
                      />
                      <ul className="flex-1 w-full flex flex-col">
                        {brandMix.map((b, i) => (
                          <li
                            key={b.brand}
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
                                  backgroundColor: [
                                    '#2FA39B',
                                    '#4C7CD9',
                                    '#D99A2B',
                                    '#C85A54',
                                    '#8A6FC2',
                                  ][i % 5],
                                }}
                              />
                              <span
                                className="text-small truncate"
                                style={{ color: 'var(--ink-surface-text)' }}
                              >
                                {b.brand}
                              </span>
                            </div>
                            <span
                              className="text-small nums-tabular"
                              style={{ color: 'var(--ink-surface-muted)' }}
                            >
                              {maskInr(b.spendInr, discreet, (n) =>
                                formatInr(n, { compact: true }),
                              )}
                              <span style={{ color: 'var(--ink-surface-muted)' }}> · </span>
                              {Math.round(b.share * 100)}%
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
                    — Showing the last 90 days. Longer history coming soon.
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

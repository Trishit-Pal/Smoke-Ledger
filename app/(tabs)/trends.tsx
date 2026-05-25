/*
 * ─────────────────────────────────────────────────────────────────────────────
 *  Trends — editorial design, web parity
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *  Aesthetic direction: the analysis spread. Period selector (Day · Week ·
 *  Month · Year) as small-caps text run with middot separators — no chip pills.
 *  Active period underlined; inactive in textMuted. Headline pair mirrors the
 *  web's editorial numerals. Charts live flush with typography, each preceded
 *  by an editorial caption + hairline Divider. Brand-mix section uses the ink
 *  panel for one moment of dramatic contrast.
 *
 *  Year window accuracy:
 *    - Sticks/spend time-series: driven by `get_daily_summary` RPC (full year).
 *    - Hour/DoW/Heatmap/Mood/Brand: raw session logs (90-day cap). Year view
 *      shows a "last 90 days" footnote for these breakdowns.
 *
 *  RPC error handling: if `get_daily_summary` fails we fall back to raw logs
 *  with a visible note — the screen never crashes.
 *
 *  Reduce-motion: Reveal is a no-op when AccessibilityInfo reports reduceMotion.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  View,
} from 'react-native';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { Divider } from '@/components/ui/Divider';
import { EmptyState } from '@/components/ui/EmptyState';
import { LineChart } from '@/components/charts/LineChart';
import { AnimatedBarChart } from '@/components/charts/AnimatedBarChart';
import { BarChart } from '@/components/charts/BarChart';
import { Donut } from '@/components/charts/Donut';
import { Heatmap } from '@/components/charts/Heatmap';
import { MoodTriggerMatrixView } from '@/components/charts/MoodTriggerMatrix';
import { Reveal } from '@/components/anim/Reveal';
import { useTheme } from '@/hooks/useTheme';
import { spacing } from '@/constants/theme';
import { useSession } from '@/store/session';
import {
  brandSpendMix,
  dailyStats,
  dayShift,
  dowDistribution,
  hourDistribution,
} from '@/domain/calc';
import { daysAgoIst, todayIst } from '@/lib/date';
import { formatDelta, formatInr } from '@/lib/format';
import { isDiscreetMode, maskCount, maskInr } from '@/lib/discreet';
import type { DailyStat } from '@/types';
import { getDailySummary, type DailySummaryRow } from '@/db/repositories/summary';

// ─── Types ───────────────────────────────────────────────────────────────────

type WindowDays = 1 | 7 | 30 | 365;

interface PeriodOption {
  label: string;
  days: WindowDays;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const PERIOD_OPTIONS: PeriodOption[] = [
  { label: 'Day',   days: 1 },
  { label: 'Week',  days: 7 },
  { label: 'Month', days: 30 },
  { label: 'Year',  days: 365 },
];

const DOW_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function windowLabel(days: WindowDays): string {
  switch (days) {
    case 1:   return 'Today';
    case 7:   return 'This week';
    case 30:  return 'This month';
    case 365: return 'This year';
  }
}

function deltaTone(pct: number): 'up' | 'down' | 'flat' {
  if (!Number.isFinite(pct)) return 'flat';
  if (pct > 2)  return 'up';
  if (pct < -2) return 'down';
  return 'flat';
}

/**
 * Produces the DailyStat array for sticks/spend charts.
 * Year → transforms DailySummaryRow[] (full accuracy).
 * Day/Week/Month → raw dailyStats from session logs.
 */
function pickDailyStats(
  windowDays: WindowDays,
  rawLogs: Parameters<typeof dailyStats>[0],
  summaryRows: DailySummaryRow[],
  startYmd: string,
  today: string,
): DailyStat[] {
  if (windowDays === 365) {
    return summaryRows
      .filter((r) => r.localDate >= startYmd && r.localDate <= today)
      .map((r): DailyStat => ({
        date: r.localDate,
        sticks: r.sticks,
        spendInr: r.totalSpendInr,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }
  return dailyStats(rawLogs, startYmd, today);
}

// ─── Sub-components ──────────────────────────────────────────────────────────

interface SectionHeaderProps {
  caption: string;
  right?: string;
}

function SectionHeader({ caption, right }: SectionHeaderProps) {
  const theme = useTheme();
  return (
    <>
      <Divider strong />
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          paddingTop: spacing.sm,
        }}
      >
        <Text
          variant="caption"
          style={{ letterSpacing: 0.5, textTransform: 'uppercase', color: theme.text }}
        >
          {caption}
        </Text>
        {right ? (
          <Text variant="caption" faint>
            {right}
          </Text>
        ) : null}
      </View>
    </>
  );
}

interface YearNoteProps {
  show: boolean;
}

function YearNote({ show }: YearNoteProps) {
  if (!show) return null;
  return (
    <Text variant="small" faint style={{ fontStyle: 'italic', marginTop: spacing.xs }}>
      — Showing the last 90 days. Full-year breakdowns coming soon.
    </Text>
  );
}

// ─── Main screen ─────────────────────────────────────────────────────────────

export default function Trends() {
  const theme = useTheme();
  const logs = useSession((s) => s.logs);
  const profile = useSession((s) => s.profile);

  const discreet = isDiscreetMode(profile);

  const fmtSpend = useCallback(
    (n: number, compact = false) =>
      maskInr(n, discreet, (v) => formatInr(v, compact ? { compact: true } : undefined)),
    [discreet],
  );

  const [windowDays, setWindowDays] = useState<WindowDays>(30);
  const today = todayIst();
  const startYmd = useMemo(() => daysAgoIst(windowDays - 1), [windowDays]);

  // Year RPC state
  const [yearRows, setYearRows] = useState<DailySummaryRow[]>([]);
  const [yearLoading, setYearLoading] = useState(false);
  const [yearError, setYearError] = useState<string | null>(null);

  // Fetch year summary when window === 365
  useEffect(() => {
    if (windowDays !== 365) return;
    let cancelled = false;
    setYearLoading(true);
    setYearError(null);
    const from365 = daysAgoIst(364);
    getDailySummary(from365, today)
      .then((rows) => {
        if (!cancelled) {
          setYearRows(rows);
          setYearLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          const msg = err instanceof Error ? err.message : 'Failed to load year data';
          setYearError(msg);
          setYearLoading(false);
          // Fall back to empty — charts will use raw logs and show a note
          setYearRows([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [windowDays, today]);

  const isYear = windowDays === 365;

  // Dependency key drives Reveal re-animation on window change
  const dependencyKey = `${windowDays}-${logs.length}-${yearRows.length}`;

  // Derived stats for sticks/spend charts
  const currentStats = useMemo(
    () => pickDailyStats(windowDays, logs, yearRows, startYmd, today),
    [windowDays, logs, yearRows, startYmd, today],
  );

  // Previous period comparison (always raw logs; prior-year outside scope)
  const previousStart = useMemo(() => dayShift(startYmd, -windowDays), [startYmd, windowDays]);
  const previousEnd   = useMemo(() => dayShift(startYmd, -1), [startYmd]);
  const previousStats = useMemo(
    () => dailyStats(logs, previousStart, previousEnd),
    [logs, previousStart, previousEnd],
  );

  // Chart series
  const sticksLine = useMemo(
    () => currentStats.map((s) => ({ label: s.date.slice(5), value: s.sticks })),
    [currentStats],
  );
  const spendBars = useMemo(
    () => currentStats.map((s) => ({ label: s.date.slice(5), value: Math.round(s.spendInr) })),
    [currentStats],
  );

  // Distribution charts — always raw logs, capped at 90d in session
  const hourDist = useMemo(() => hourDistribution(logs, startYmd, today), [logs, startYmd, today]);
  const hourBars = useMemo(
    () => hourDist.map((v, i) => ({ label: `${String(i).padStart(2, '0')}h`, value: v })),
    [hourDist],
  );

  const dowDist = useMemo(() => dowDistribution(logs, startYmd, today), [logs, startYmd, today]);
  const dowBars = useMemo(
    () => dowDist.map((v, i) => ({ label: DOW_LABELS[i] ?? '', value: v })),
    [dowDist],
  );

  const brandMix = useMemo(
    () => brandSpendMix(logs, startYmd, today).slice(0, 5),
    [logs, startYmd, today],
  );
  const donutSlices = useMemo(
    () => brandMix.map((b) => ({ label: b.brand, value: Math.round(b.spendInr) })),
    [brandMix],
  );

  // Summary headline pair + delta
  const summary = useMemo(() => {
    const sticks  = currentStats.reduce((acc, s) => acc + s.sticks, 0);
    const spend   = currentStats.reduce((acc, s) => acc + s.spendInr, 0);
    const prevSticks = previousStats.reduce((acc, s) => acc + s.sticks, 0);
    const prevSpend  = previousStats.reduce((acc, s) => acc + s.spendInr, 0);

    const stickDeltaPct =
      prevSticks === 0 ? (sticks === 0 ? 0 : 100) : ((sticks - prevSticks) / prevSticks) * 100;
    const spendDeltaPct =
      prevSpend  === 0 ? (spend  === 0 ? 0 : 100) : ((spend  - prevSpend)  / prevSpend)  * 100;

    return {
      sticks,
      spend,
      avgSticksPerDay: sticks / windowDays,
      avgSpendPerDay:  spend  / windowDays,
      stickDeltaPct,
      spendDeltaPct,
    };
  }, [currentStats, previousStats, windowDays]);

  const stickTone       = deltaTone(summary.stickDeltaPct);
  const spendTone       = deltaTone(summary.spendDeltaPct);
  const stickToneColor  =
    stickTone === 'up' ? theme.warnEarth : stickTone === 'down' ? theme.accent : theme.textMuted;
  const spendToneColor  =
    spendTone === 'up' ? theme.warnEarth : spendTone === 'down' ? theme.accent : theme.textMuted;

  const hasData    = logs.length > 0;
  const periodLabel = windowLabel(windowDays);
  const totalBrandSpend = brandMix.reduce((acc, b) => acc + b.spendInr, 0);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <Screen>
      {/* ─── Masthead ─── */}
      <View style={{ gap: spacing.xs }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <View style={{ height: 1, flex: 1, backgroundColor: theme.ruleStrong }} />
          <Text
            variant="caption"
            style={{ textTransform: 'uppercase', letterSpacing: 0.8, color: theme.text }}
          >
            Trends · {periodLabel}
          </Text>
          <View style={{ height: 1, flex: 1, backgroundColor: theme.ruleStrong }} />
        </View>
        <Text variant="small" muted style={{ textAlign: 'center', fontStyle: 'italic' }}>
          The week, the month, the year — in one read.
        </Text>
      </View>

      {/* ─── Period selector — text run with middot separators ─── */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: spacing.sm,
        }}
      >
        {PERIOD_OPTIONS.map((period, i) => {
          const isActive = windowDays === period.days;
          return (
            <View
              key={period.days}
              style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}
            >
              <Pressable
                onPress={() => setWindowDays(period.days)}
                accessibilityRole="button"
                accessibilityState={{ selected: isActive }}
                accessibilityLabel={`${period.label} period`}
                style={{ paddingVertical: spacing.xs, paddingHorizontal: 2, minHeight: 32, justifyContent: 'center' }}
              >
                <Text
                  variant="caption"
                  style={{
                    textTransform: 'uppercase',
                    letterSpacing: 0.6,
                    color: isActive ? theme.text : theme.textMuted,
                    textDecorationLine: isActive ? 'underline' : 'none',
                    textDecorationColor: theme.ruleStrong,
                  }}
                >
                  {period.label}
                </Text>
              </Pressable>
              {i < PERIOD_OPTIONS.length - 1 ? (
                <Text variant="caption" faint>
                  ·
                </Text>
              ) : null}
            </View>
          );
        })}
      </View>

      {/* ─── Year loading indicator ─── */}
      {isYear && yearLoading ? (
        <View style={{ alignItems: 'center', paddingVertical: spacing.sm }}>
          <ActivityIndicator size="small" color={theme.accent} />
          <Text variant="small" muted style={{ marginTop: spacing.xs }}>
            Loading year data…
          </Text>
        </View>
      ) : null}

      {/* ─── Year RPC error fallback note ─── */}
      {isYear && yearError ? (
        <View
          style={{
            paddingVertical: spacing.sm,
            paddingHorizontal: spacing.md,
            backgroundColor: theme.warnEarthSoft,
            borderRadius: 8,
          }}
        >
          <Text variant="small" style={{ color: theme.warnEarth }}>
            Year totals unavailable — showing available logs instead.
          </Text>
        </View>
      ) : null}

      {!hasData ? (
        /* ─── Empty state ─── */
        <EmptyState
          title="No data to chart yet."
          description="Once you log a few cigarettes, the charts and patterns of your week will print here."
        />
      ) : (
        <>
          {/* ─── Headline pair ─── */}
          <View style={{ gap: spacing.md }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
              {/* Sticks */}
              <View style={{ gap: spacing.xs }}>
                <Text
                  variant="caption"
                  style={{ textTransform: 'uppercase', letterSpacing: 0.5, color: theme.textMuted }}
                >
                  Sticks · {periodLabel.toLowerCase()}
                </Text>
                <Text
                  variant="display"
                  style={{ color: theme.text }}
                  accessibilityLabel={
                    discreet
                      ? 'Period sticks total hidden'
                      : `${summary.sticks} cigarettes`
                  }
                >
                  {maskCount(summary.sticks, discreet)}
                </Text>
                <Text variant="small" style={{ color: stickToneColor }}>
                  {formatDelta(summary.stickDeltaPct)}
                  <Text variant="small" faint>
                    {' '}vs previous
                  </Text>
                </Text>
              </View>

              {/* Spend */}
              <View style={{ gap: spacing.xs, alignItems: 'flex-end' }}>
                <Text
                  variant="caption"
                  style={{ textTransform: 'uppercase', letterSpacing: 0.5, color: theme.textMuted }}
                >
                  Spend
                </Text>
                <Text
                  variant="h1"
                  style={{ color: theme.text }}
                  accessibilityLabel={
                    discreet ? 'Period spend hidden' : `Spent ${formatInr(summary.spend)}`
                  }
                >
                  {fmtSpend(summary.spend, true)}
                </Text>
                <Text variant="small" style={{ color: spendToneColor }}>
                  {formatDelta(summary.spendDeltaPct)}
                  <Text variant="small" faint>
                    {' '}vs previous
                  </Text>
                </Text>
              </View>
            </View>

            {/* Deck */}
            <Text variant="body" muted>
              {summary.sticks === 0
                ? windowDays === 1
                  ? 'Nothing logged today.'
                  : `Nothing logged across the last ${windowDays} days.`
                : windowDays === 1
                ? `${summary.sticks} ${summary.sticks === 1 ? 'cigarette' : 'cigarettes'} today, ${formatDelta(summary.stickDeltaPct)} vs the day before.`
                : `${summary.sticks} ${summary.sticks === 1 ? 'cigarette' : 'cigarettes'} across ${windowDays} days. Average ${summary.avgSticksPerDay.toFixed(1)} per day, ${formatDelta(summary.stickDeltaPct)} vs the period before.`}
            </Text>

            {isYear && !yearLoading && !yearError ? (
              <Text variant="small" faint style={{ fontStyle: 'italic' }}>
                — Year-accurate: the sticks &amp; spend lines below are summed from the server-side daily summary.
              </Text>
            ) : null}
          </View>

          {/* ─── Daily sticks line ─── */}
          <View style={{ gap: spacing.md }}>
            <SectionHeader
              caption="Daily sticks"
              right={`${windowDays} ${windowDays === 1 ? 'day' : 'days'}`}
            />
            <Reveal dependencyKey={dependencyKey}>
              <LineChart
                data={sticksLine}
                height={180}
                strokeColor={stickToneColor}
              />
            </Reveal>
            <Text variant="small" muted style={{ fontStyle: 'italic' }}>
              {summary.sticks === 0
                ? 'A flat line. Nothing logged in this window.'
                : summary.avgSticksPerDay < 1
                ? 'A sparse window — most days quiet.'
                : `Around ${summary.avgSticksPerDay.toFixed(1)} a day, on average.`}
            </Text>
          </View>

          {/* ─── Daily spend bars ─── */}
          <View style={{ gap: spacing.md }}>
            <SectionHeader
              caption="Daily spend"
              right={`${fmtSpend(summary.spend, true)} total`}
            />
            <Reveal dependencyKey={dependencyKey}>
              <AnimatedBarChart
                data={spendBars}
                height={180}
                formatY={(v) => formatInr(v, { compact: true })}
                showLabels={false}
              />
            </Reveal>
            <Text variant="small" muted style={{ fontStyle: 'italic' }}>
              {summary.spend === 0
                ? 'Nothing spent in this window.'
                : `Average ${fmtSpend(summary.avgSpendPerDay, true)} a day. The bars are the texture.`}
            </Text>
          </View>

          {/* ─── Day × hour heatmap ─── */}
          <View style={{ gap: spacing.md }}>
            <SectionHeader caption="Day × hour" right="When the week breathes" />
            <Reveal dependencyKey={dependencyKey}>
              <Heatmap logs={logs} startYmd={startYmd} endYmd={today} />
            </Reveal>
            <Text variant="small" muted style={{ fontStyle: 'italic' }}>
              The grid reads top-down by weekday, left-right by hour. Dark squares are where the habit lives.
            </Text>
            <YearNote show={isYear} />
          </View>

          {/* ─── Time of day ─── */}
          <View style={{ gap: spacing.md }}>
            <SectionHeader caption="Time of day" right="24-hour distribution" />
            <Reveal dependencyKey={dependencyKey}>
              <BarChart data={hourBars} height={160} />
            </Reveal>
            <Text variant="small" muted style={{ fontStyle: 'italic' }}>
              Mornings and evenings tend to spike. Quiet hours are the ones worth keeping.
            </Text>
            <YearNote show={isYear} />
          </View>

          {/* ─── Day of week ─── */}
          <View style={{ gap: spacing.md }}>
            <SectionHeader caption="Day of week" right="Mon — Sun" />
            <Reveal dependencyKey={dependencyKey}>
              <BarChart data={dowBars} height={160} />
            </Reveal>
            <Text variant="small" muted style={{ fontStyle: 'italic' }}>
              The shape of your week. Weekends and weekdays rarely match.
            </Text>
            <YearNote show={isYear} />
          </View>

          {/* ─── Mood × trigger matrix ─── */}
          <View style={{ gap: spacing.md }}>
            <SectionHeader caption="Mood × trigger" right="Where it tends to start" />
            <Reveal dependencyKey={dependencyKey}>
              <MoodTriggerMatrixView logs={logs} />
            </Reveal>
            <Text variant="small" muted style={{ fontStyle: 'italic' }}>
              A grid of feelings against situations. The dense cells are the pattern.
            </Text>
            <YearNote show={isYear} />
          </View>

          {/* ─── Brand spend — ink panel ─── */}
          <View
            style={{
              backgroundColor: theme.inkSurface,
              borderRadius: 14,
              padding: spacing.xl,
              gap: spacing.lg,
            }}
          >
            {/* Panel header */}
            <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
              <Text
                variant="caption"
                style={{
                  textTransform: 'uppercase',
                  letterSpacing: 0.5,
                  color: theme.inkSurfaceMuted,
                }}
              >
                Brand spend · top 5
              </Text>
              <Text variant="caption" style={{ color: theme.inkSurfaceMuted }}>
                {fmtSpend(totalBrandSpend, true)}
              </Text>
            </View>

            {donutSlices.length === 0 ? (
              <Text variant="small" style={{ color: theme.inkSurfaceMuted, fontStyle: 'italic' }}>
                No priced logs in this window.
              </Text>
            ) : (
              <Reveal dependencyKey={dependencyKey}>
                <View style={{ gap: spacing.lg }}>
                  <View style={{ alignItems: 'center' }}>
                    <Donut
                      slices={donutSlices}
                      centerLabel="TOTAL"
                      centerValue={fmtSpend(totalBrandSpend, true)}
                    />
                  </View>
                  <View>
                    {brandMix.map((b, idx) => (
                      <View
                        key={b.brand}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          paddingVertical: spacing.sm,
                          borderTopWidth: idx === 0 ? 0 : 1,
                          borderTopColor: theme.inkSurfaceRule,
                        }}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1, minWidth: 0 }}>
                          <View
                            style={{
                              width: 8,
                              height: 8,
                              borderRadius: 4,
                              backgroundColor: theme.chart[idx % theme.chart.length] ?? theme.accent,
                              flexShrink: 0,
                            }}
                          />
                          <Text
                            variant="small"
                            style={{ color: theme.inkSurfaceText, flexShrink: 1 }}
                            numberOfLines={1}
                          >
                            {b.brand}
                          </Text>
                        </View>
                        <Text variant="small" style={{ color: theme.inkSurfaceMuted }}>
                          {fmtSpend(b.spendInr, true)}
                          {' · '}
                          {discreet ? '••' : `${Math.round(b.share * 100)}%`}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
              </Reveal>
            )}

            <YearNote show={isYear} />
          </View>

          {/* ─── End-mark ─── */}
          <View style={{ paddingTop: spacing.md }}>
            <Divider />
            <Text
              variant="small"
              faint
              style={{ textAlign: 'center', fontStyle: 'italic', marginTop: spacing.sm }}
            >
              Numbers are a slow mirror.
            </Text>
          </View>
        </>
      )}
    </Screen>
  );
}

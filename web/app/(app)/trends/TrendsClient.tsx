'use client';

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

import { Card } from '@web/components/ui/Card';
import { Chip } from '@web/components/ui/Chip';
import { Text } from '@web/components/ui/Text';
import { EmptyState } from '@web/components/ui/EmptyState';
import { FadeSlideIn, Reveal } from '@web/components/anim/dynamic';
import { Header } from '@web/components/layout/Header';
import { LineChart, BarChart, AnimatedBarChart, Donut } from '@web/components/charts/dynamic';
import { Heatmap } from '@web/components/charts/Heatmap';
import { MoodTriggerMatrix } from '@web/components/charts/MoodTriggerMatrix';
import type { CigaretteLog, UserProfile } from '@/types';

type WindowDays = 1 | 7 | 30 | 365;

const PERIOD_OPTIONS: { label: string; days: WindowDays }[] = [
  { label: 'Day', days: 1 },
  { label: 'Week', days: 7 },
  { label: 'Month', days: 30 },
  { label: 'Year', days: 365 },
];
const DOW_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export interface TrendsClientProps {
  profile: UserProfile;
  logs: CigaretteLog[];
}

export function TrendsClient({ profile, logs }: TrendsClientProps) {
  const discreet = isDiscreetMode(profile);
  const [windowDays, setWindowDays] = React.useState<WindowDays>(30);

  const today = todayIst();
  const startYmd = daysAgoIst(windowDays - 1);

  const dependencyKey = `${windowDays}-${logs.length}`;

  const currentStats = React.useMemo(
    () => dailyStats(logs, startYmd, today),
    [logs, startYmd, today],
  );

  const previousStart = React.useMemo(
    () => dayShift(startYmd, -windowDays),
    [startYmd, windowDays],
  );
  const previousEnd = React.useMemo(() => dayShift(startYmd, -1), [startYmd]);
  const previousStats = React.useMemo(
    () => dailyStats(logs, previousStart, previousEnd),
    [logs, previousStart, previousEnd],
  );

  const sticksLine = React.useMemo(() => {
    return currentStats.map((s) => ({
      label: s.date.slice(5),
      value: s.sticks,
    }));
  }, [currentStats]);

  const spendBars = React.useMemo(() => {
    return currentStats.map((s) => ({
      label: s.date.slice(5),
      value: Math.round(s.spendInr),
    }));
  }, [currentStats]);

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

  return (
    <div className="max-w-3xl mx-auto p-lg flex flex-col gap-xl pb-32">
      <FadeSlideIn index={0}>
        <Header title="Trends" subtitle="Patterns in your data" />
      </FadeSlideIn>

      <FadeSlideIn index={1}>
        <div className="flex gap-sm">
          {PERIOD_OPTIONS.map((period) => (
            <Chip
              key={period.days}
              label={period.label}
              selected={windowDays === period.days}
              onPress={() => setWindowDays(period.days)}
            />
          ))}
        </div>
      </FadeSlideIn>

      {logs.length === 0 ? (
        <EmptyState
          title="No data to chart yet"
          description="Once you log a few cigarettes, charts and patterns will appear here."
        />
      ) : (
        <>
          <FadeSlideIn index={2}>
            <Card>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-md">
                <div>
                  <Text variant="caption" muted>
                    Sticks
                  </Text>
                  <Text variant="bodyStrong">
                    {discreet ? '•••' : summary.sticks}
                  </Text>
                  <Text variant="small" muted>
                    {formatDelta(summary.stickDeltaPct)} vs previous
                  </Text>
                </div>
                <div>
                  <Text variant="caption" muted>
                    Spend
                  </Text>
                  <Text variant="bodyStrong">
                    {maskInr(summary.spend, discreet, (n) => formatInr(n))}
                  </Text>
                  <Text variant="small" muted>
                    {formatDelta(summary.spendDeltaPct)} vs previous
                  </Text>
                </div>
                <div>
                  <Text variant="caption" muted>
                    Avg/day sticks
                  </Text>
                  <Text variant="bodyStrong">
                    {discreet ? '•••' : summary.avgSticksPerDay.toFixed(1)}
                  </Text>
                </div>
                <div>
                  <Text variant="caption" muted>
                    Avg/day spend
                  </Text>
                  <Text variant="bodyStrong">
                    {maskInr(summary.avgSpendPerDay, discreet, (n) => formatInr(n))}
                  </Text>
                </div>
              </div>
            </Card>
          </FadeSlideIn>

          {/* Daily sticks line */}
          <FadeSlideIn index={3}>
            <Card>
              <Text variant="caption" muted className="mb-sm">
                Daily sticks
              </Text>
              <Reveal dependencyKey={dependencyKey}>
                <LineChart data={sticksLine} height={180} />
              </Reveal>
            </Card>
          </FadeSlideIn>

          {/* Daily spend */}
          <FadeSlideIn index={4}>
            <Card>
              <Text variant="caption" muted className="mb-sm">
                Daily spend
              </Text>
              <Reveal dependencyKey={dependencyKey}>
                <AnimatedBarChart
                  data={spendBars}
                  height={180}
                  formatY={(v) => formatInr(v, { compact: true })}
                />
              </Reveal>
            </Card>
          </FadeSlideIn>

          {/* Heatmap */}
          <FadeSlideIn index={5}>
            <Card>
              <Text variant="caption" muted className="mb-sm">
                Day × hour heatmap
              </Text>
              <Reveal dependencyKey={dependencyKey}>
                <Heatmap logs={logs} startYmd={startYmd} endYmd={today} />
              </Reveal>
            </Card>
          </FadeSlideIn>

          {/* Time of day */}
          <FadeSlideIn index={6}>
            <Card>
              <Text variant="caption" muted className="mb-sm">
                Time of day
              </Text>
              <Reveal dependencyKey={dependencyKey}>
                <BarChart data={hourBars} height={160} />
              </Reveal>
            </Card>
          </FadeSlideIn>

          {/* Day of week */}
          <FadeSlideIn index={7}>
            <Card>
              <Text variant="caption" muted className="mb-sm">
                Day of week
              </Text>
              <Reveal dependencyKey={dependencyKey}>
                <BarChart data={dowBars} height={160} />
              </Reveal>
            </Card>
          </FadeSlideIn>

          {/* Mood × Trigger */}
          <FadeSlideIn index={8}>
            <Card>
              <Text variant="caption" muted className="mb-sm">
                Mood × trigger
              </Text>
              <Reveal dependencyKey={dependencyKey}>
                <MoodTriggerMatrix logs={logs} />
              </Reveal>
            </Card>
          </FadeSlideIn>

          {/* Brand spend donut */}
          <FadeSlideIn index={9}>
            <Card>
              <Text variant="caption" muted className="mb-sm">
                Brand spend (top 5)
              </Text>
              {donutSlices.length === 0 ? (
                <Text variant="small" muted>
                  No priced logs in this window.
                </Text>
              ) : (
                <Reveal dependencyKey={dependencyKey}>
                  <div className="flex flex-col sm:flex-row items-center gap-lg">
                    <Donut
                      slices={donutSlices}
                      size={160}
                      centerLabel="TOTAL"
                      centerValue={formatInr(totalSpend, { compact: true })}
                    />
                    <ul className="flex-1 w-full flex flex-col gap-sm">
                      {brandMix.map((b, idx) => (
                        <li key={b.brand} className="flex items-center justify-between">
                          <div className="flex items-center gap-sm min-w-0">
                            <span
                              aria-hidden
                              className="w-3 h-3 rounded-sm shrink-0"
                              style={{
                                backgroundColor: [
                                  '#2FA39B',
                                  '#4C7CD9',
                                  '#D99A2B',
                                  '#C85A54',
                                  '#8A6FC2',
                                ][idx % 5],
                              }}
                            />
                            <Text variant="small" className="truncate">
                              {b.brand}
                            </Text>
                          </div>
                          <Text variant="small" muted>
                            {formatInr(b.spendInr, { compact: true })} ·{' '}
                            {Math.round(b.share * 100)}%
                          </Text>
                        </li>
                      ))}
                    </ul>
                  </div>
                </Reveal>
              )}
            </Card>
          </FadeSlideIn>
        </>
      )}
    </div>
  );
}

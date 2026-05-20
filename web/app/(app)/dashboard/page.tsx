'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from '@/store/session';
import {
  dailyStats,
  sticksOn,
  spendOn,
  trendVsBaseline,
  forecastMonthlySpend,
  rollingAvgSticks,
  smokeFreeStreak,
  lastLog,
} from '@/domain/calc';
import { potentialSavings } from '@/domain/savings';
import { evaluateGoal } from '@/domain/goals';
import { generateInsights } from '@/domain/insights';
import {
  todayIst,
  daysAgoIst,
  dayOfWeekShort,
  formatIndianDate,
} from '@/lib/date';
import { formatInr, formatDelta } from '@/lib/format';
import { isDiscreetMode, isHomeTotalsHidden } from '@/lib/discreet';
import { createLog } from '@/db/repositories/logs';
import { AnalyticsEvents } from '@/constants/events';
import { track } from '@/services/analytics';
import { toSafeErrorMessage } from '@/lib/errors';

import { Card } from '@web/components/ui/Card';
import { Button } from '@web/components/ui/Button';
import { Text } from '@web/components/ui/Text';
import { StatTile } from '@web/components/ui/StatTile';
import { ProgressBar } from '@web/components/ui/ProgressBar';
import { EmptyState } from '@web/components/ui/EmptyState';
import { FactsCarousel } from '@web/components/ui/FactsCarousel';
import { HealthMilestones } from '@web/components/ui/HealthMilestones';
import { FadeSlideIn } from '@web/components/anim/FadeSlideIn';
import { Pulse } from '@web/components/anim/Pulse';
import { AnimatedBarChart } from '@web/components/charts/AnimatedBarChart';

export default function DashboardPage() {
  const router = useRouter();
  const {
    booted,
    boot,
    logs,
    profile,
    goals,
    refreshLogs,
  } = useSession();

  const [quickLogError, setQuickLogError] = React.useState<string | null>(null);
  const [quickLogPending, setQuickLogPending] = React.useState(false);

  React.useEffect(() => {
    if (!booted) boot().catch(() => {});
  }, [booted, boot]);

  const today = todayIst();

  const todaySticks = React.useMemo(() => sticksOn(logs, today), [logs, today]);
  const todaySpend = React.useMemo(() => spendOn(logs, today), [logs, today]);
  const avgPerDay = React.useMemo(
    () => rollingAvgSticks(logs, today, 7),
    [logs, today],
  );
  const trend = React.useMemo(
    () => trendVsBaseline(logs, today, 7, 30),
    [logs, today],
  );
  const forecast = React.useMemo(
    () => forecastMonthlySpend(logs, today),
    [logs, today],
  );
  const weekBars = React.useMemo(() => {
    const stats = dailyStats(logs, daysAgoIst(6), today);
    return stats.map((s) => ({
      label: dayOfWeekShort(s.date).slice(0, 2),
      value: s.sticks,
    }));
  }, [logs, today]);
  const periodSummaries = React.useMemo(() => {
    return [
      { label: 'Day', days: 1 },
      { label: 'Week', days: 7 },
      { label: 'Month', days: 30 },
      { label: 'Year', days: 365 },
    ].map((period) => {
      const stats = dailyStats(logs, daysAgoIst(period.days - 1), today);
      const sticks = stats.reduce((acc, stat) => acc + stat.sticks, 0);
      const spend = stats.reduce((acc, stat) => acc + stat.spendInr, 0);
      return { ...period, sticks, spend };
    });
  }, [logs, today]);
  const streak = React.useMemo(() => smokeFreeStreak(logs, today), [logs, today]);
  const last = React.useMemo(() => lastLog(logs), [logs]);
  const insights = React.useMemo(() => generateInsights(logs, today), [logs, today]);

  const hidden = isHomeTotalsHidden(profile);
  const discreet = isDiscreetMode(profile);

  const savings = React.useMemo(() => {
    if (!profile?.baselinePerDay) return null;
    return potentialSavings({
      logs,
      baselinePerDay: profile.baselinePerDay,
      sinceYmd: profile.onboardedAt?.slice(0, 10) ?? daysAgoIst(30),
    });
  }, [logs, profile]);

  const activeGoal = goals[0] ?? null;
  const goalProgress = React.useMemo(
    () => (activeGoal ? evaluateGoal(activeGoal, logs, today) : null),
    [activeGoal, logs, today],
  );

  const handleQuickLog = React.useCallback(async () => {
    try {
      setQuickLogError(null);
      setQuickLogPending(true);
      const lastL = logs[0];
      const unit = lastL?.unitPriceInr ?? null;
      await createLog({
        tsUtc: new Date().toISOString(),
        brandId: lastL?.brandId ?? null,
        brandNameSnap: lastL?.brandNameSnap ?? null,
        variantSnap: lastL?.variantSnap ?? null,
        quantity: 1,
        purchaseMode: 'single',
        packSize: null,
        totalPriceInr: unit,
        unitPriceInr: unit,
        priceSource: unit != null ? 'inferred' : 'unknown',
        triggerTag: null,
        moodBefore: null,
        moodAfter: null,
        craving: null,
        contextTag: null,
        notes: null,
      });
      await track(AnalyticsEvents.QUICK_ADD_USED, {});
      await refreshLogs();
    } catch (e) {
      setQuickLogError(toSafeErrorMessage(e, 'dependency_failure'));
    } finally {
      setQuickLogPending(false);
    }
  }, [logs, refreshLogs]);

  // Loading skeleton
  if (!booted) {
    return (
      <div className="max-w-2xl mx-auto p-lg">
        <div className="h-6 w-32 bg-card rounded-md animate-pulse mb-md" />
        <div className="h-12 w-48 bg-card rounded-md animate-pulse mb-xl" />
        <div className="grid grid-cols-2 gap-md mb-lg">
          <div className="h-28 bg-card rounded-lg animate-pulse" />
          <div className="h-28 bg-card rounded-lg animate-pulse" />
        </div>
        <div className="h-12 bg-card rounded-md animate-pulse" />
      </div>
    );
  }

  let i = 0;

  return (
    <div className="max-w-2xl mx-auto p-lg flex flex-col gap-xl">
      {/* 1. Date header */}
      <FadeSlideIn index={i++}>
        <div>
          <Text variant="caption" muted>
            {formatIndianDate(today).toUpperCase()}
          </Text>
          <Text variant="display">Today</Text>
        </div>
      </FadeSlideIn>

      {logs.length === 0 ? (
        <FadeSlideIn index={i++}>
          <EmptyState
            title="No logs yet"
            description="Your first entry kicks off insights, trends, and savings calculations."
            actionLabel="Log your first cigarette"
            onAction={() => router.push('/log/new')}
          />
        </FadeSlideIn>
      ) : null}

      {/* 2. Stat tiles */}
      <FadeSlideIn index={i++}>
        <div className="grid grid-cols-2 gap-md">
          <StatTile
            label="Sticks"
            value={String(todaySticks)}
            animatedValue={todaySticks}
            sublabel={`7d avg ${avgPerDay.toFixed(1)}/day`}
            hidden={hidden}
          />
          <StatTile
            label="Spend"
            value={formatInr(todaySpend, { compact: true })}
            animatedValue={todaySpend}
            formatAnimated={(n) => formatInr(n, { compact: true })}
            sublabel={`Trend ${formatDelta(trend.deltaPct)}`}
            tone={trend.deltaPct > 0 ? 'warn' : 'success'}
            hidden={hidden}
          />
        </div>
      </FadeSlideIn>

      {/* 3. Multi-period summary */}
      <FadeSlideIn index={i++}>
        <Card>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-md">
            {periodSummaries.map((period) => (
              <div key={period.label} className="flex flex-col gap-1">
                <Text variant="caption" muted>
                  {period.label}
                </Text>
                <Text variant="bodyStrong">{hidden ? '•••' : `${period.sticks} sticks`}</Text>
                <Text variant="small" muted>
                  {hidden ? '•••' : formatInr(period.spend, { compact: true })}
                </Text>
              </div>
            ))}
          </div>
        </Card>
      </FadeSlideIn>

      {/* 4. Action buttons */}
      <FadeSlideIn index={i++}>
        <div className="flex flex-col gap-xs">
          <div className="flex gap-md">
            <Pulse active={streak >= 1} className="flex-1">
              <Button
                title="Quick add +1"
                variant="primary"
                fullWidth
                loading={quickLogPending}
                onPress={handleQuickLog}
              />
            </Pulse>
            <Button
              title="Log details"
              variant="secondary"
              onPress={() => router.push('/log/new')}
              className="flex-1"
            />
          </div>
          {quickLogError ? (
            <Text
              variant="small"
              color="var(--danger, #C85A54)"
              className="text-center"
            >
              {quickLogError}
            </Text>
          ) : null}
        </div>
      </FadeSlideIn>

      {/* 5. Active goal */}
      {goalProgress ? (
        <FadeSlideIn index={i++}>
          <Card>
            <div className="flex items-baseline justify-between mb-sm">
              <Text variant="caption" muted>
                Goal
              </Text>
              <Text
                variant="small"
                color={
                  goalProgress.atRisk
                    ? 'var(--warn, #D99A2B)'
                    : goalProgress.isOnTrack
                      ? 'var(--success, #4CAF84)'
                      : 'var(--danger, #C85A54)'
                }
              >
                {goalProgress.isOnTrack ? 'On track' : 'Over target'}
              </Text>
            </div>
            <Text variant="bodyStrong" className="mb-sm">
              {goalProgress.label}
            </Text>
            <ProgressBar
              value={goalProgress.percent}
              tone={
                goalProgress.atRisk
                  ? 'warn'
                  : goalProgress.isOnTrack
                    ? 'success'
                    : 'danger'
              }
            />
            <Text variant="small" muted className="mt-sm">
              {goalProgress.explanation}
            </Text>
          </Card>
        </FadeSlideIn>
      ) : null}

      {/* 6. 7-day bar chart */}
      {logs.length > 0 ? (
        <FadeSlideIn index={i++}>
          <Card>
            <div className="flex items-baseline justify-between mb-md">
              <Text variant="caption" muted>
                Last 7 days
              </Text>
              <Text variant="small" muted>
                {todaySticks} today
              </Text>
            </div>
            <AnimatedBarChart data={weekBars} height={140} />
          </Card>
        </FadeSlideIn>
      ) : null}

      {/* 7. Streak + forecast */}
      {logs.length > 0 ? (
        <FadeSlideIn index={i++}>
          <div className="grid grid-cols-2 gap-md">
            <StatTile
              label="Smoke-free"
              value={`${streak}d`}
              sublabel={
                last
                  ? `Last on ${formatIndianDate(last.localDate)}`
                  : 'No logs yet'
              }
              tone={streak >= 1 ? 'success' : 'default'}
              hidden={hidden}
            />
            <StatTile
              label="Month forecast"
              value={formatInr(forecast.forecast, { compact: true })}
              sublabel={`${forecast.daysElapsed}/${forecast.daysInMonth} days`}
              hidden={hidden}
            />
          </div>
        </FadeSlideIn>
      ) : null}

      {/* 8. Health milestones */}
      <FadeSlideIn index={i++}>
        <HealthMilestones lastSmokeIso={last?.tsUtc ?? null} />
      </FadeSlideIn>

      {/* 9. Savings card */}
      {savings && savings.totalInr > 0 ? (
        <FadeSlideIn index={i++}>
          <Card>
            <Text variant="caption" muted>
              Potential savings
            </Text>
            <Text variant="display" className="mt-xs text-success">
              {formatInr(savings.totalInr, { compact: true })}
            </Text>
            <Text variant="small" muted className="mt-xs">
              {discreet
                ? '••• sticks avoided over ••• days vs your baseline.'
                : `${savings.sticksAvoided} sticks avoided over ${savings.days} days vs your baseline of ${profile?.baselinePerDay}/day.`}
            </Text>
          </Card>
        </FadeSlideIn>
      ) : null}

      {/* 10. Facts carousel */}
      <FadeSlideIn index={i++}>
        <FactsCarousel count={5} />
      </FadeSlideIn>

      {/* 11. Insights */}
      {insights.length > 0 ? (
        <FadeSlideIn index={i++}>
          <div className="flex flex-col gap-md">
            <Text variant="caption" muted>
              Insights
            </Text>
            {insights.slice(0, 3).map((insight) => (
              <Card key={insight.id}>
                <div className="flex items-baseline justify-between gap-sm mb-xs">
                  <Text variant="bodyStrong">{insight.title}</Text>
                  <Text
                    variant="caption"
                    color={
                      insight.severity === 'act'
                        ? 'var(--danger, #C85A54)'
                        : insight.severity === 'watch'
                          ? 'var(--warn, #D99A2B)'
                          : 'var(--text-muted)'
                    }
                  >
                    {insight.severity.toUpperCase()}
                  </Text>
                </div>
                <Text variant="small" muted className="mb-xs">
                  {insight.explanation}
                </Text>
                <Text variant="caption" faint>
                  {insight.evidence}
                </Text>
              </Card>
            ))}
          </div>
        </FadeSlideIn>
      ) : null}
    </div>
  );
}

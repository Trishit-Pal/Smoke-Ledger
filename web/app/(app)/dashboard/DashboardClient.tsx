'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  dailyStats,
  sticksOn,
  spendOn,
  trendVsBaseline,
  rollingAvgSticks,
  smokeFreeStreak,
  lastLog,
} from '@/domain/calc';
import { evaluateGoal } from '@/domain/goals';
import { generateInsights } from '@/domain/insights';
import { todayIst, daysAgoIst, dayOfWeekShort, formatIndianDate } from '@/lib/date';
import { formatInr, formatDelta } from '@/lib/format';
import { isHomeTotalsHidden } from '@/lib/discreet';
import { createLog, inferUnitPriceForVariant } from '@/db/repositories/logs';
import { AnalyticsEvents } from '@/constants/events';
import { track } from '@/services/analytics';
import { toSafeErrorMessage } from '@/lib/errors';

import { Card } from '@web/components/ui/Card';
import { Button } from '@web/components/ui/Button';
import { Text } from '@web/components/ui/Text';
import { StatTile } from '@web/components/ui/StatTile';
import { ProgressBar } from '@web/components/ui/ProgressBar';
import { EmptyState } from '@web/components/ui/EmptyState';
import { HealthMilestones } from '@web/components/ui/HealthMilestones';
import { FadeSlideIn } from '@web/components/anim/dynamic';
import { AnimatedBarChart } from '@web/components/charts/dynamic';
import { TodayRing } from '@web/components/dashboard/TodayRing';
import { QuickLogSheet } from '@web/components/log/QuickLogSheet';
import type { Brand, BrandVariant, CigaretteLog, Goal, UserProfile } from '@/types';

export interface DashboardClientProps {
  profile: UserProfile;
  logs: CigaretteLog[];
  goals: Goal[];
  brands: (Brand & { variants: BrandVariant[] })[];
}

export function DashboardClient({ profile, logs, goals, brands }: DashboardClientProps) {
  const router = useRouter();
  const [quickLogError, setQuickLogError] = React.useState<string | null>(null);
  const [quickLogPending, setQuickLogPending] = React.useState(false);
  const [toast, setToast] = React.useState<string | null>(null);

  const today = todayIst();
  const todaySticks = React.useMemo(() => sticksOn(logs, today), [logs, today]);
  const todaySpend = React.useMemo(() => spendOn(logs, today), [logs, today]);
  const avgPerDay = React.useMemo(() => rollingAvgSticks(logs, today, 7), [logs, today]);
  const trend = React.useMemo(() => trendVsBaseline(logs, today, 7, 30), [logs, today]);
  const weekBars = React.useMemo(() => {
    const stats = dailyStats(logs, daysAgoIst(6), today);
    return stats.map((s) => ({
      label: dayOfWeekShort(s.date).slice(0, 2),
      value: s.sticks,
    }));
  }, [logs, today]);
  const streak = React.useMemo(() => smokeFreeStreak(logs, today), [logs, today]);
  const last = React.useMemo(() => lastLog(logs), [logs]);
  const insights = React.useMemo(() => generateInsights(logs, today), [logs, today]);
  const hidden = isHomeTotalsHidden(profile);

  const activeGoal = goals[0] ?? null;
  const goalProgress = React.useMemo(
    () => (activeGoal ? evaluateGoal(activeGoal, logs, today) : null),
    [activeGoal, logs, today],
  );

  const runQuickLog = React.useCallback(
    async (opts: {
      brandId: string | null;
      brandName: string | null;
      variantName: string | null;
      quantity: number;
    }) => {
      try {
        setQuickLogError(null);
        setQuickLogPending(true);
        const inferred = await inferUnitPriceForVariant(opts.variantName, opts.brandId);
        const unit = inferred;
        const total = unit != null ? unit * opts.quantity : null;
        await createLog({
          tsUtc: new Date().toISOString(),
          brandId: opts.brandId,
          brandNameSnap: opts.brandName,
          variantSnap: opts.variantName,
          quantity: opts.quantity,
          purchaseMode: 'single',
          packSize: null,
          totalPriceInr: total,
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
        setToast(
          `Logged ${opts.quantity} · ${opts.brandName ?? 'entry'}${
            total != null ? ` · ${formatInr(total, { compact: true })}` : ''
          }`,
        );
        window.setTimeout(() => setToast(null), 2500);
        router.refresh();
      } catch (e) {
        setQuickLogError(toSafeErrorMessage(e, 'dependency_failure'));
      } finally {
        setQuickLogPending(false);
      }
    },
    [router],
  );

  let i = 0;

  return (
    <div className="max-w-3xl mx-auto p-lg flex flex-col gap-xl">
      <FadeSlideIn index={i++}>
        <div className="flex flex-col gap-xs">
          <Text variant="caption" muted>
            {formatIndianDate(today).toUpperCase()}
          </Text>
          <Text variant="display" className="font-serif">
            Smoke tracker
          </Text>
        </div>
      </FadeSlideIn>

      {logs.length === 0 ? (
        <FadeSlideIn index={i++}>
          <EmptyState
            title="Start tracking"
            description="Log one cigarette to unlock spend trends and insights."
            actionLabel="Log your first"
            onAction={() => router.push('/log/new')}
          />
        </FadeSlideIn>
      ) : null}

      <FadeSlideIn index={i++}>
        <Card className="bento-hero overflow-hidden">
          <div className="grid md:grid-cols-2 gap-lg items-center">
            <TodayRing
              sticks={todaySticks}
              baseline={profile.baselinePerDay}
              spendLabel={formatInr(todaySpend, { compact: true })}
              hidden={hidden}
            />
            <QuickLogSheet
              profile={profile}
              brands={brands}
              lastLog={last}
              pending={quickLogPending}
              onLog={runQuickLog}
              onAdvanced={() => router.push('/log/new')}
            />
          </div>
          {toast ? (
            <Text variant="small" className="text-center text-accent mt-md" role="status">
              {toast}
            </Text>
          ) : null}
          {quickLogError ? (
            <Text variant="small" color="var(--danger, #C85A54)" className="text-center mt-sm" role="alert">
              {quickLogError}
            </Text>
          ) : null}
        </Card>
      </FadeSlideIn>

      <FadeSlideIn index={i++}>
        <div className="grid grid-cols-2 gap-md">
          <StatTile
            label="7-day avg"
            value={`${avgPerDay.toFixed(1)}/d`}
            sublabel={`Trend ${formatDelta(trend.deltaPct)}`}
            tone={trend.deltaPct > 0 ? 'warn' : 'success'}
            hidden={hidden}
          />
          <StatTile
            label="Smoke-free"
            value={`${streak}d`}
            sublabel={last ? `Last ${formatIndianDate(last.localDate)}` : '—'}
            tone={streak >= 1 ? 'success' : 'default'}
            hidden={hidden}
          />
        </div>
      </FadeSlideIn>

      {goalProgress ? (
        <FadeSlideIn index={i++}>
          <Card>
            <Text variant="caption" muted>
              Goal
            </Text>
            <Text variant="bodyStrong" className="mt-xs mb-sm">
              {goalProgress.label}
            </Text>
            <ProgressBar
              value={goalProgress.percent}
              tone={goalProgress.atRisk ? 'warn' : goalProgress.isOnTrack ? 'success' : 'danger'}
            />
          </Card>
        </FadeSlideIn>
      ) : null}

      {logs.length > 0 ? (
        <FadeSlideIn index={i++}>
          <Card>
            <Text variant="caption" muted className="mb-md">
              Last 7 days
            </Text>
            <AnimatedBarChart data={weekBars} height={120} />
          </Card>
        </FadeSlideIn>
      ) : null}

      <FadeSlideIn index={i++}>
        <HealthMilestones lastSmokeIso={last?.tsUtc ?? null} />
      </FadeSlideIn>

      {insights.length > 0 ? (
        <FadeSlideIn index={i++}>
          <div className="flex flex-col gap-md">
            <Text variant="caption" muted>
              Weekly insight
            </Text>
            <Card>
              <Text variant="bodyStrong">{insights[0]?.title}</Text>
              <Text variant="small" muted className="mt-xs">
                {insights[0]?.explanation}
              </Text>
            </Card>
          </div>
        </FadeSlideIn>
      ) : null}

      <FadeSlideIn index={i++}>
        <Button
          title="View full history"
          variant="ghost"
          fullWidth
          onPress={() => router.push('/log')}
        />
      </FadeSlideIn>
    </div>
  );
}

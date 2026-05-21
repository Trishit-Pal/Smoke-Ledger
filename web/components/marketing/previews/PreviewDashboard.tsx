'use client';

import { Card } from '@web/components/ui/Card';
import { Text } from '@web/components/ui/Text';
import { ProgressBar } from '@web/components/ui/ProgressBar';
import { TodayRing } from '@web/components/dashboard/TodayRing';
import { AnimatedBarChart } from '@web/components/charts/dynamic';
import {
  DEMO_BASELINE,
  getDemoDashboardStats,
} from '@web/lib/marketing/demoData';

export function PreviewDashboard() {
  const stats = getDemoDashboardStats();

  return (
    <Card className="p-lg shadow-[var(--shadow-card)]">
      <div className="flex flex-col gap-md">
        <Text variant="caption" muted>
          Dashboard preview
        </Text>
        <TodayRing
          sticks={stats.todaySticks}
          baseline={DEMO_BASELINE}
          spendLabel={stats.todaySpendLabel}
        />
        <div aria-hidden>
          <AnimatedBarChart data={stats.weekBars} height={100} />
        </div>
        <p className="sr-only">
          Demo dashboard showing {stats.todaySticks} sticks today and a weekly bar chart of usage.
        </p>
        {stats.goalProgress ? (
          <div className="flex flex-col gap-xs">
            <div className="flex justify-between text-small">
              <span className="text-text-muted">{stats.goalProgress.label}</span>
              <span className="font-medium">
                {stats.goalProgress.valueCurrent}/{stats.goalProgress.valueTarget}
              </span>
            </div>
            <ProgressBar
              value={stats.goalProgress.percent}
              tone={stats.goalProgress.isOnTrack ? 'success' : 'warn'}
            />
          </div>
        ) : null}
      </div>
    </Card>
  );
}

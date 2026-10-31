'use client';

import { Card } from '@web/components/ui/Card';
import { Text } from '@web/components/ui/Text';
import { LineChart } from '@web/components/charts/dynamic';
import { getDemoDashboardStats, getDemoTrendsStats } from '@web/lib/marketing/demoData';

export function PreviewTrends() {
  const { topInsight } = getDemoDashboardStats();
  const { sticksLine } = getDemoTrendsStats();

  return (
    <Card className="p-lg shadow-[var(--shadow-card)] flex flex-col gap-md">
      <div className="flex flex-wrap gap-xs">
        {['Day', 'Week', 'Month', 'Year'].map((label, i) => (
          <span
            key={label}
            className={`rounded-pill px-md py-xs text-caption font-medium border ${
              i === 2
                ? 'bg-accent-soft border-accent text-accent-ink'
                : 'bg-bg-elevated border-border text-text-muted'
            }`}
          >
            {label}
          </span>
        ))}
      </div>
      <Text variant="caption" muted>
        Sticks — last 30 days
      </Text>
      <div aria-hidden>
        <LineChart data={sticksLine.slice(-14)} height={120} />
      </div>
      <p className="sr-only">Demo trends line chart showing declining stick count over two weeks.</p>
      {topInsight ? (
        <div className="rounded-lg border border-border bg-bg-elevated p-md flex flex-col gap-xs">
          <Text variant="caption" muted>
            Rule-based insight
          </Text>
          <Text variant="bodyStrong">{topInsight.title}</Text>
          <Text variant="small" muted>
            {topInsight.explanation}
          </Text>
        </div>
      ) : null}
    </Card>
  );
}

import React, { useMemo, useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StatTile } from '@/components/ui/StatTile';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { EmptyState } from '@/components/ui/EmptyState';
import { AnimatedBarChart } from '@/components/charts/AnimatedBarChart';
import { FactsCarousel } from '@/components/ui/FactsCarousel';
import { HealthMilestones } from '@/components/ui/HealthMilestones';
import { FadeSlideIn } from '@/components/anim/FadeSlideIn';
import { Tilt } from '@/components/anim/Tilt';
import { Pulse } from '@/components/anim/Pulse';
import { spacing } from '@/constants/theme';
import { useSession } from '@/store/session';
import { useTheme } from '@/hooks/useTheme';
import {
  dailyStats,
  forecastMonthlySpend,
  lastLog,
  rollingAvgSticks,
  smokeFreeStreak,
  spendOn,
  sticksOn,
  trendVsBaseline,
} from '@/domain/calc';
import { potentialSavings } from '@/domain/savings';
import { evaluateGoal } from '@/domain/goals';
import { generateInsights } from '@/domain/insights';
import { formatInr, formatDelta } from '@/lib/format';
import { isHomeTotalsHidden } from '@/lib/discreet';
import { todayIst, daysAgoIst, dayOfWeekShort, formatIndianDate } from '@/lib/date';
import { createLog } from '@/db/repositories/logs';
import { track } from '@/services/analytics';
import { AnalyticsEvents } from '@/constants/events';
import { success } from '@/lib/haptics';

export default function Home() {
  const router = useRouter();
  const theme = useTheme();
  const logs = useSession((s) => s.logs);
  const profile = useSession((s) => s.profile);
  const goals = useSession((s) => s.goals);
  const refreshLogs = useSession((s) => s.refreshLogs);
  const [refreshing, setRefreshing] = useState(false);
  const [quickLogError, setQuickLogError] = useState<string | null>(null);

  const today = todayIst();
  const last7Start = daysAgoIst(6);

  const todaySticks = useMemo(() => sticksOn(logs, today), [logs, today]);
  const todaySpend = useMemo(() => spendOn(logs, today), [logs, today]);
  const weekBars = useMemo(() => {
    const stats = dailyStats(logs, last7Start, today);
    return stats.map((s) => ({ label: dayOfWeekShort(s.date).slice(0, 2), value: s.sticks }));
  }, [logs, last7Start, today]);

  const trend = useMemo(() => trendVsBaseline(logs, today, 7, 30), [logs, today]);
  const forecast = useMemo(() => forecastMonthlySpend(logs, today), [logs, today]);
  const insights = useMemo(() => generateInsights(logs, today), [logs, today]);
  const last = useMemo(() => lastLog(logs), [logs]);
  const streak = useMemo(() => smokeFreeStreak(logs, today), [logs, today]);

  const savings = useMemo(() => {
    if (!profile?.baselinePerDay) return null;
    const since = profile.onboardedAt?.slice(0, 10) ?? daysAgoIst(30);
    return potentialSavings({
      logs,
      baselinePerDay: profile.baselinePerDay,
      sinceYmd: since,
    });
  }, [logs, profile]);

  const quickLog = async () => {
    try {
      setQuickLogError(null);
      const lastL = logs[0];
      const now = new Date().toISOString();
      const unit = lastL?.unitPriceInr ?? null;
      await createLog({
        tsUtc: now,
        brandId: lastL?.brandId ?? null,
        brandNameSnap: lastL?.brandNameSnap ?? null,
        variantSnap: lastL?.variantSnap ?? null,
        quantity: 1,
        purchaseMode: 'single',
        packSize: lastL?.packSize ?? null,
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
      success();
      await refreshLogs();
    } catch (e) {
      setQuickLogError(e instanceof Error ? e.message : 'Could not save log. Pull to refresh and retry.');
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshLogs();
    } finally {
      setRefreshing(false);
    }
  };

  const hidden = isHomeTotalsHidden(profile);
  const avgPerDay = rollingAvgSticks(logs, today, 7);

  let i = 0;

  return (
    <Screen refreshing={refreshing} onRefresh={onRefresh}>
      <FadeSlideIn index={i++}>
        <View style={{ gap: spacing.xs }}>
          <Text variant="caption" muted>
            {formatIndianDate(today).toUpperCase()}
          </Text>
          <Text variant="display">Today</Text>
        </View>
      </FadeSlideIn>

      <FadeSlideIn index={i++}>
        <Tilt>
          <View style={{ flexDirection: 'row', gap: spacing.md }}>
            <StatTile
              label="Sticks"
              value={String(todaySticks)}
              animatedValue={todaySticks}
              sublabel={`7-day avg ${avgPerDay.toFixed(1)}/day`}
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
          </View>
        </Tilt>
      </FadeSlideIn>

      <FadeSlideIn index={i++}>
        <View style={{ flexDirection: 'row', gap: spacing.md }}>
          <View style={{ flex: 1 }}>
            <Pulse active={streak >= 1}>
              <Button title="Quick add +1" variant="primary" fullWidth onPress={quickLog} />
            </Pulse>
          </View>
          <Button
            title="Details"
            variant="secondary"
            onPress={() => router.push('/log/new')}
            style={{ flex: 1 }}
          />
        </View>
        {quickLogError ? (
          <Text variant="small" color={theme.danger} style={{ marginTop: spacing.xs }}>
            {quickLogError}
          </Text>
        ) : null}
      </FadeSlideIn>

      {goals.length === 0 ? null : (
        <FadeSlideIn index={i++}>
          <Card>
            <View style={{ gap: spacing.sm }}>
              <Text variant="bodyStrong">Active goal</Text>
              {goals.slice(0, 1).map((g) => {
                const p = evaluateGoal(g, logs, today);
                const tone = p.atRisk ? 'warn' : !p.isOnTrack ? 'danger' : 'default';
                return (
                  <View key={g.id} style={{ gap: spacing.xs }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text variant="small">{p.label}</Text>
                      <Text variant="small" muted>
                        {p.unit === 'inr'
                          ? `${formatInr(p.valueCurrent)} / ${formatInr(p.valueTarget)}`
                          : `${p.valueCurrent} / ${p.valueTarget}`}
                      </Text>
                    </View>
                    <ProgressBar value={p.percent} tone={tone} />
                    <Text variant="caption" muted>
                      {p.explanation}
                    </Text>
                  </View>
                );
              })}
            </View>
          </Card>
        </FadeSlideIn>
      )}

      <FadeSlideIn index={i++}>
        <Card>
          <View style={{ gap: spacing.md }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text variant="bodyStrong">Last 7 days</Text>
              <Text variant="caption" muted>
                STICKS / DAY
              </Text>
            </View>
            {weekBars.some((b) => b.value > 0) ? (
              <AnimatedBarChart data={weekBars} height={140} />
            ) : (
              <Text variant="small" muted>
                Log a few entries to see your pattern.
              </Text>
            )}
          </View>
        </Card>
      </FadeSlideIn>

      <FadeSlideIn index={i++}>
        <View style={{ flexDirection: 'row', gap: spacing.md }}>
          <StatTile
            label="Smoke-free streak"
            value={`${streak}d`}
            sublabel="Consecutive smoke-free days"
          />
          <StatTile
            label="Month forecast"
            value={formatInr(forecast.forecast, { compact: true })}
            animatedValue={forecast.forecast}
            formatAnimated={(n) => formatInr(n, { compact: true })}
            sublabel={`${forecast.daysElapsed}/${forecast.daysInMonth} days elapsed`}
            hidden={hidden}
          />
        </View>
      </FadeSlideIn>

      <FadeSlideIn index={i++}>
        <HealthMilestones lastSmokeIso={last?.tsUtc ?? null} />
      </FadeSlideIn>

      {savings && savings.totalInr > 0 ? (
        <FadeSlideIn index={i++}>
          <Card>
            <View style={{ gap: spacing.xs }}>
              <Text variant="caption" muted>
                POTENTIAL SAVINGS
              </Text>
              <Text variant="h1" color={theme.success}>
                {formatInr(savings.totalInr, { compact: true })}
              </Text>
              <Text variant="small" muted>
                Based on {savings.sticksAvoided} sticks below baseline × average unit price{' '}
                {formatInr(savings.avgUnitPriceUsed)}.
              </Text>
            </View>
          </Card>
        </FadeSlideIn>
      ) : null}

      <FadeSlideIn index={i++}>
        <FactsCarousel count={5} />
      </FadeSlideIn>

      {insights.length > 0 ? (
        <FadeSlideIn index={i++}>
          <View style={{ gap: spacing.sm }}>
            <Text variant="h3">Patterns we noticed</Text>
            {insights.slice(0, 3).map((ins) => (
              <Card key={ins.id}>
                <View style={{ gap: spacing.xs }}>
                  <Text variant="bodyStrong">{ins.title}</Text>
                  <Text variant="small" muted>
                    {ins.explanation}
                  </Text>
                  <Text variant="caption" muted>
                    EVIDENCE — {ins.evidence}
                  </Text>
                </View>
              </Card>
            ))}
          </View>
        </FadeSlideIn>
      ) : logs.length === 0 ? (
        <FadeSlideIn index={i++}>
          <EmptyState
            title="Nothing logged yet"
            description="Use Quick add or Details to record your first cigarette."
            actionLabel="Log now"
            onAction={() => router.push('/log/new')}
          />
        </FadeSlideIn>
      ) : null}
    </Screen>
  );
}

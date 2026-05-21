import React, { useMemo, useState } from 'react';
import { View } from 'react-native';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { BarChart } from '@/components/charts/BarChart';
import { LineChart } from '@/components/charts/LineChart';
import { Donut } from '@/components/charts/Donut';
import { Heatmap } from '@/components/charts/Heatmap';
import { MoodTriggerMatrixView } from '@/components/charts/MoodTriggerMatrix';
import { EmptyState } from '@/components/ui/EmptyState';
import { Reveal } from '@/components/anim/Reveal';
import { FadeSlideIn } from '@/components/anim/FadeSlideIn';
import { spacing } from '@/constants/theme';
import { useSession } from '@/store/session';
import {
  brandSpendMix,
  dailyStats,
  dowDistribution,
  hourDistribution,
  rollingAvgSticks,
  rollingAvgSpend,
} from '@/domain/calc';
import { daysAgoIst, todayIst } from '@/lib/date';
import { formatInr } from '@/lib/format';
import { isDiscreetMode, maskInr } from '@/lib/discreet';

const WINDOWS = [
  { days: 1, label: '1d' },
  { days: 7, label: '7d' },
  { days: 30, label: '30d' },
  { days: 365, label: '1y' },
];

const DOW_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

export default function Trends() {
  const logs = useSession((s) => s.logs);
  const profile = useSession((s) => s.profile);
  const discreet = isDiscreetMode(profile);
  const fmtSpend = (n: number, compact = false) =>
    maskInr(n, discreet, (v) => formatInr(v, compact ? { compact: true } : undefined));
  const [windowDays, setWindowDays] = useState<number>(30);
  const today = todayIst();
  const start = daysAgoIst(windowDays - 1);
  const dep = `${windowDays}-${logs.length}`;

  const stats = useMemo(() => dailyStats(logs, start, today), [logs, start, today]);
  const stickSeries = useMemo(
    () => stats.map((s) => ({ label: s.date.slice(5), value: s.sticks })),
    [stats],
  );
  const spendSeries = useMemo(
    () => stats.map((s) => ({ label: s.date.slice(5), value: s.spendInr })),
    [stats],
  );
  const hourDist = useMemo(() => hourDistribution(logs, start, today), [logs, start, today]);
  const dowDist = useMemo(() => dowDistribution(logs, start, today), [logs, start, today]);
  const brandMix = useMemo(() => brandSpendMix(logs, start, today), [logs, start, today]);
  const avgSticks = rollingAvgSticks(logs, today, windowDays);
  const avgSpend = rollingAvgSpend(logs, today, windowDays);
  const totalSpend = stats.reduce((a, s) => a + s.spendInr, 0);

  const totalInRange = stats.reduce((a, s) => a + s.sticks, 0);

  let i = 0;

  return (
    <Screen>
      <FadeSlideIn index={i++}>
        <View style={{ gap: spacing.xs }}>
          <Text variant="caption" muted>
            TRENDS
          </Text>
          <Text variant="display">Patterns</Text>
        </View>
      </FadeSlideIn>

      <FadeSlideIn index={i++}>
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          {WINDOWS.map((w) => (
            <Chip
              key={w.days}
              label={w.label}
              selected={windowDays === w.days}
              onPress={() => setWindowDays(w.days)}
            />
          ))}
        </View>
      </FadeSlideIn>

      {totalInRange === 0 ? (
        <EmptyState
          title="Nothing in this window"
          description="Log a few cigarettes to see your trends. The more you log, the more useful the charts become."
        />
      ) : (
        <>
          <FadeSlideIn index={i++}>
            <Card>
              <View style={{ gap: spacing.sm }}>
                <Text variant="bodyStrong">Summary</Text>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text variant="small" muted>Total sticks</Text>
                  <Text variant="bodyStrong">{totalInRange}</Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text variant="small" muted>Total spend</Text>
                  <Text variant="bodyStrong">{fmtSpend(totalSpend)}</Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text variant="small" muted>Avg sticks/day</Text>
                  <Text variant="bodyStrong">{avgSticks.toFixed(1)}</Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text variant="small" muted>Avg spend/day</Text>
                  <Text variant="bodyStrong">{fmtSpend(avgSpend)}</Text>
                </View>
              </View>
            </Card>
          </FadeSlideIn>

          <FadeSlideIn index={i++}>
            <Card>
              <View style={{ gap: spacing.sm }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text variant="bodyStrong">Daily sticks</Text>
                  <Text variant="caption" muted>
                    AVG {avgSticks.toFixed(1)}/DAY
                  </Text>
                </View>
                <Reveal dependencyKey={dep}>
                  <LineChart data={stickSeries} height={160} />
                </Reveal>
              </View>
            </Card>
          </FadeSlideIn>

          <FadeSlideIn index={i++}>
            <Card>
              <View style={{ gap: spacing.sm }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text variant="bodyStrong">Daily spend</Text>
                  <Text variant="caption" muted>
                    AVG {fmtSpend(avgSpend)} / DAY
                  </Text>
                </View>
                <Reveal dependencyKey={dep}>
                  <BarChart
                    data={spendSeries}
                    height={160}
                    formatY={(v) => fmtSpend(v, true)}
                    showLabels={false}
                  />
                </Reveal>
              </View>
            </Card>
          </FadeSlideIn>

          <FadeSlideIn index={i++}>
            <Card>
              <View style={{ gap: spacing.sm }}>
                <Text variant="bodyStrong">When you smoke</Text>
                <Text variant="caption" muted>
                  DAY × HOUR — DARKER = MORE
                </Text>
                <Reveal dependencyKey={dep}>
                  <Heatmap logs={logs} startYmd={start} endYmd={today} />
                </Reveal>
              </View>
            </Card>
          </FadeSlideIn>

          <FadeSlideIn index={i++}>
            <Card>
              <View style={{ gap: spacing.sm }}>
                <Text variant="bodyStrong">Time of day</Text>
                <Reveal dependencyKey={dep}>
                  <BarChart
                    data={hourDist.map((v, h) => ({
                      label: h % 6 === 0 ? `${h}h` : '',
                      value: v,
                    }))}
                    height={140}
                  />
                </Reveal>
              </View>
            </Card>
          </FadeSlideIn>

          <FadeSlideIn index={i++}>
            <Card>
              <View style={{ gap: spacing.sm }}>
                <Text variant="bodyStrong">Day of week</Text>
                <Reveal dependencyKey={dep}>
                  <BarChart
                    data={dowDist.map((v, idx) => ({ label: DOW_LABELS[idx]!, value: v }))}
                    height={140}
                  />
                </Reveal>
              </View>
            </Card>
          </FadeSlideIn>

          <FadeSlideIn index={i++}>
            <Card>
              <View style={{ gap: spacing.sm }}>
                <Text variant="bodyStrong">Mood × trigger</Text>
                <Reveal dependencyKey={dep}>
                  <MoodTriggerMatrixView logs={logs} />
                </Reveal>
              </View>
            </Card>
          </FadeSlideIn>

          {brandMix.length > 0 ? (
            <FadeSlideIn index={i++}>
              <Card>
                <View style={{ gap: spacing.md }}>
                  <Text variant="bodyStrong">Brand spend mix</Text>
                  <Reveal dependencyKey={dep}>
                    <Donut
                      slices={brandMix.slice(0, 5).map((b) => ({ label: b.brand, value: b.spendInr }))}
                      centerValue={fmtSpend(brandMix.reduce((a, b) => a + b.spendInr, 0), true)}
                      centerLabel="TOTAL"
                    />
                  </Reveal>
                  <View style={{ gap: spacing.xs }}>
                    {brandMix.slice(0, 5).map((b, idx) => (
                      <View
                        key={b.brand}
                        style={{ flexDirection: 'row', justifyContent: 'space-between' }}
                      >
                        <Text variant="small">{`${idx + 1}. ${b.brand}`}</Text>
                        <Text variant="small" muted>
                          {fmtSpend(b.spendInr)} · {discreet ? '••' : `${Math.round(b.share * 100)}%`}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
              </Card>
            </FadeSlideIn>
          ) : null}
        </>
      )}
    </Screen>
  );
}

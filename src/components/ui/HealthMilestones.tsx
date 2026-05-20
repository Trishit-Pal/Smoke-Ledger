import React from 'react';
import { View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { Card } from '@/components/ui/Card';
import { Text } from '@/components/ui/Text';
import { spacing, radius } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { milestoneProgress, formatMinutesUntil } from '@/domain/health';
import { HEALTH_MILESTONES } from '@/constants/milestones';
import { Reveal } from '@/components/anim/Reveal';

export interface HealthMilestonesProps {
  lastSmokeIso: string | null | undefined;
}

export function HealthMilestones({ lastSmokeIso }: HealthMilestonesProps) {
  const theme = useTheme();
  const p = milestoneProgress(lastSmokeIso);

  return (
    <Card>
      <View style={{ gap: spacing.md }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text variant="bodyStrong">Body recovery</Text>
          <Text variant="caption" muted>
            {p.next ? `NEXT IN ${formatMinutesUntil(p.minutesToNext)}` : 'ALL MILESTONES REACHED'}
          </Text>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <ProgressRing percent={p.fractionToNext} color={theme.accent} ringBg={theme.border} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="h3">{p.current ? p.current.title + ' reached' : 'Starting line'}</Text>
            <Text variant="small" muted>
              {p.current ? p.current.body : 'Your last log resets the recovery clock. The first milestone is at 20 minutes smoke-free.'}
            </Text>
            {p.current ? (
              <Text variant="caption" muted>
                Source — {p.current.source}
              </Text>
            ) : null}
          </View>
        </View>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {HEALTH_MILESTONES.map((m) => {
            const reached = p.current ? m.minutes <= p.current.minutes : false;
            const isNext = p.next?.minutes === m.minutes;
            return (
              <Reveal key={m.minutes} dependencyKey={`${reached}-${isNext}`}>
                <View
                  style={{
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                    borderRadius: radius.pill,
                    backgroundColor: reached ? theme.accentSoft : 'transparent',
                    borderWidth: 1,
                    borderColor: isNext ? theme.accent : theme.border,
                  }}
                >
                  <Text
                    variant="caption"
                    color={reached ? theme.accent : isNext ? theme.text : theme.textMuted}
                  >
                    {m.title}
                  </Text>
                </View>
              </Reveal>
            );
          })}
        </View>
      </View>
    </Card>
  );
}

function ProgressRing({
  percent,
  color,
  ringBg,
  size = 64,
  strokeWidth = 6,
}: {
  percent: number;
  color: string;
  ringBg: string;
  size?: number;
  strokeWidth?: number;
}) {
  const r = (size - strokeWidth) / 2;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - Math.max(0, Math.min(1, percent)));
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <Circle cx={size / 2} cy={size / 2} r={r} stroke={ringBg} strokeWidth={strokeWidth} fill="none" />
      <Circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        stroke={color}
        strokeWidth={strokeWidth}
        fill="none"
        strokeDasharray={`${c} ${c}`}
        strokeDashoffset={offset}
        strokeLinecap="round"
        rotation={-90}
        origin={`${size / 2}, ${size / 2}`}
      />
    </Svg>
  );
}

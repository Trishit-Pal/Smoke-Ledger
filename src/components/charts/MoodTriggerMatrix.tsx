import React from 'react';
import { View } from 'react-native';
import { Text } from '@/components/ui/Text';
import { spacing, radius } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { moodTriggerMatrix } from '@/domain/correlations';
import type { CigaretteLog } from '@/types';

export interface MoodTriggerMatrixProps {
  logs: CigaretteLog[];
  money: (amount: number) => string;
}

const PRETTY = (s: string) => s.replace(/_/g, ' ');
// Mood label column: scales with the row (and font size) instead of a fixed 80px,
// which clipped labels under large text and wasted width on tablets.
const LABEL_COL = { flex: 1.6, minWidth: 64, paddingRight: spacing.xs } as const;

export function MoodTriggerMatrixView({ logs, money }: MoodTriggerMatrixProps) {
  const theme = useTheme();
  const m = moodTriggerMatrix(logs, 5);

  if (m.total === 0) {
    return (
      <Text variant="small" muted>
        Log mood and trigger fields to surface patterns here.
      </Text>
    );
  }

  const max = Math.max(1, ...m.cells.map((c) => c.count));

  return (
    <View style={{ gap: spacing.md }}>
      <View style={{ gap: spacing.xs }}>
        <Text variant="caption" muted>
          STRONGEST PAIRS
        </Text>
        {m.topPairs.slice(0, 3).map((p) => (
          <View
            key={`${p.mood}-${p.trigger}`}
            style={{ flexDirection: 'row', justifyContent: 'space-between' }}
          >
            <Text variant="small">
              {PRETTY(p.mood)} → {PRETTY(p.trigger)}
            </Text>
            <Text variant="small" muted>
              {p.count}× {p.avgUnitPriceInr != null ? `· ${money(p.avgUnitPriceInr)}` : ''}
            </Text>
          </View>
        ))}
      </View>

      {m.moods.length > 0 && m.triggers.length > 0 ? (
        <View>
          <View style={{ flexDirection: 'row' }}>
            <View style={LABEL_COL} />
            {m.triggers.map((t) => (
              <Text key={t} variant="caption" muted style={{ flex: 1, textAlign: 'center' }}>
                {PRETTY(t).slice(0, 5)}
              </Text>
            ))}
          </View>
          {m.moods.map((mood) => (
            <View key={mood} style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
              <Text variant="caption" style={LABEL_COL} numberOfLines={1}>
                {PRETTY(mood)}
              </Text>
              {m.triggers.map((trig) => {
                const cell = m.cells.find((c) => c.mood === mood && c.trigger === trig);
                const v = cell?.count ?? 0;
                const intensity = v / max;
                return (
                  <View
                    key={trig}
                    style={{
                      flex: 1,
                      height: 22,
                      marginHorizontal: 1,
                      borderRadius: radius.sm,
                      backgroundColor: theme.accent,
                      opacity: v === 0 ? 0.06 : 0.18 + 0.82 * intensity,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {v > 0 ? (
                      <Text variant="caption" color={intensity > 0.5 ? theme.bgElevated : theme.text}>
                        {v}
                      </Text>
                    ) : null}
                  </View>
                );
              })}
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

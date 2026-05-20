import React from 'react';
import { View } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';
import { Text } from '@/components/ui/Text';
import { useTheme } from '@/hooks/useTheme';
import { spacing } from '@/constants/theme';

export interface DonutSlice {
  label: string;
  value: number;
  color?: string;
}

export interface DonutProps {
  slices: DonutSlice[];
  size?: number;
  thickness?: number;
  centerLabel?: string;
  centerValue?: string;
}

export function Donut({ slices, size = 140, thickness = 16, centerLabel, centerValue }: DonutProps) {
  const theme = useTheme();
  const total = slices.reduce((a, s) => a + s.value, 0) || 1;
  const radius = size / 2 - thickness / 2;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;
  return (
    <View style={{ alignItems: 'center', gap: spacing.sm }}>
      <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
        <Svg width={size} height={size}>
          <G rotation={-90} originX={size / 2} originY={size / 2}>
            <Circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke={theme.border}
              strokeWidth={thickness}
              fill="transparent"
            />
            {slices.map((s, i) => {
              const len = (s.value / total) * circumference;
              const c = s.color ?? theme.chart[i % theme.chart.length]!;
              const el = (
                <Circle
                  key={i}
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  stroke={c}
                  strokeWidth={thickness}
                  fill="transparent"
                  strokeDasharray={`${len} ${circumference - len}`}
                  strokeDashoffset={-offset}
                  strokeLinecap="butt"
                />
              );
              offset += len;
              return el;
            })}
          </G>
        </Svg>
        <View style={{ position: 'absolute', alignItems: 'center' }}>
          {centerValue ? <Text variant="h2">{centerValue}</Text> : null}
          {centerLabel ? (
            <Text variant="caption" muted>
              {centerLabel}
            </Text>
          ) : null}
        </View>
      </View>
    </View>
  );
}

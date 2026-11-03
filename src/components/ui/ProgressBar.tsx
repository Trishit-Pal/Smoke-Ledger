import React, { useEffect } from 'react';
import { View } from 'react-native';
import Animated, { useAnimatedStyle, withTiming, Easing, useSharedValue } from 'react-native-reanimated';
import { useTheme } from '@/hooks/useTheme';
import { radius } from '@/constants/theme';
import { useReduceMotion } from '@/hooks/useReduceMotion';

export interface ProgressBarProps {
  value: number;
  tone?: 'default' | 'warn' | 'warnEarth' | 'danger' | 'success';
  height?: number;
}

export function ProgressBar({ value, tone = 'default', height = 6 }: ProgressBarProps) {
  const theme = useTheme();
  const reduce = useReduceMotion();
  const pct = Math.max(0, Math.min(100, value));
  const width = useSharedValue(0);

  useEffect(() => {
    width.value = reduce
      ? pct
      : withTiming(pct, { duration: 700, easing: Easing.out(Easing.cubic) });
  }, [pct, reduce, width]);

  const color =
    tone === 'warn'    ? theme.warn
    : tone === 'warnEarth' ? theme.warnEarth
    : tone === 'danger'  ? theme.danger
    : tone === 'success' ? theme.success
    : theme.accent;

  const barStyle = useAnimatedStyle(() => ({
    width: `${width.value}%`,
    height: '100%',
    backgroundColor: color,
    borderRadius: radius.pill,
  }));

  return (
    // Editorial: theme.rule track (hairline feel) with theme.accent fill
    <View
      style={{ height, backgroundColor: theme.rule, borderRadius: radius.pill, overflow: 'hidden' }}
      accessible
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(pct) }}
    >
      <Animated.View style={barStyle} />
    </View>
  );
}

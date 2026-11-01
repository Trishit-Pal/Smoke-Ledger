/* eslint-disable react-hooks/immutability -- Reanimated SharedValue is a mutable box; writing `.value` in press handlers is its documented API */
import React from 'react';
import { Pressable, StyleProp, ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
import { Text } from './Text';
import { PRESS } from '@/constants/motion';
import { useTheme } from '@/hooks/useTheme';
import { radius, spacing } from '@/constants/theme';
import { tap } from '@/lib/haptics';
import { useReduceMotion } from '@/hooks/useReduceMotion';

export interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}

export function Chip({ label, selected, onPress, disabled, style, accessibilityLabel }: ChipProps) {
  const theme = useTheme();
  const reduce = useReduceMotion();
  const scale = useSharedValue(1);

  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Pressable
      onPressIn={() => { if (!reduce) scale.value = withTiming(0.94, PRESS); }}
      onPressOut={() => { if (!reduce) scale.value = withTiming(1, PRESS); }}
      onPress={() => {
        if (disabled) return;
        tap();
        onPress?.();
      }}
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected, disabled: !!disabled }}
      accessibilityLabel={accessibilityLabel ?? label}
    >
      <Animated.View
        style={[
          {
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.xs + 2,
            borderRadius: radius.pill,
            // Editorial: selected = accentSoft fill + accent border; unselected = transparent + hairline rule
            backgroundColor: selected ? theme.accentSoft : 'transparent',
            borderWidth: 1,
            borderColor: selected ? theme.accent : theme.ruleStrong,
            opacity: disabled ? 0.45 : 1,
          },
          animStyle,
          style,
        ]}
      >
        <Text
          variant="caption"
          color={selected ? theme.accent : theme.textMuted}
          style={{ letterSpacing: 1.2, textTransform: 'uppercase' }}
        >
          {label}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

import React from 'react';
import { Pressable, StyleProp, ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { Text } from './Text';
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
      onPressIn={() => { if (!reduce) scale.value = withSpring(0.94, { damping: 20 }); }}
      onPressOut={() => { if (!reduce) scale.value = withSpring(1, { damping: 20 }); }}
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

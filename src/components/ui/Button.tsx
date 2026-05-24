import React from 'react';
import { Pressable, ViewStyle, StyleProp, ActivityIndicator, View } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { Text } from './Text';
import { useTheme } from '@/hooks/useTheme';
import { radius, spacing } from '@/constants/theme';
import { tap } from '@/lib/haptics';
import { useReduceMotion } from '@/hooks/useReduceMotion';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps {
  title: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  testID?: string;
  fullWidth?: boolean;
}

// Module-level constants — avoids re-allocating on every render
const HEIGHTS: Record<ButtonSize, number> = { sm: 36, md: 44, lg: 52 };
const PADDINGS: Record<ButtonSize, number> = { sm: spacing.md, md: spacing.xl, lg: spacing.xl };
const SPRING = { damping: 18, stiffness: 300 };

export function Button({
  title, onPress, variant = 'primary', size = 'md',
  disabled, loading, leftIcon, rightIcon,
  style, accessibilityLabel, testID, fullWidth,
}: ButtonProps) {
  const theme = useTheme();
  const reduce = useReduceMotion();
  const scale = useSharedValue(1);

  // Editorial: primary = solid teal; secondary = hairline outline; ghost = transparent; danger = danger fill
  const bg =
    variant === 'primary'    ? theme.accent
    : variant === 'danger'   ? theme.danger
    : variant === 'secondary' ? 'transparent'
    : 'transparent';

  const fg =
    variant === 'primary' || variant === 'danger' ? '#FFFFFF'
    : variant === 'secondary' ? theme.text
    : theme.text;

  // Hairline borders — secondary uses ruleStrong, ghost uses rule, primary/danger transparent
  const borderColor =
    variant === 'secondary' ? theme.ruleStrong
    : variant === 'ghost'   ? theme.rule
    : 'transparent';

  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Pressable
      onPressIn={() => { if (!disabled && !loading && !reduce) scale.value = withSpring(0.96, SPRING); }}
      onPressOut={() => { if (!reduce) scale.value = withSpring(1, SPRING); }}
      onPress={() => { if (!disabled && !loading) { tap(); onPress?.(); } }}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ disabled: !!disabled, busy: !!loading }}
      testID={testID}
      style={[{ alignSelf: fullWidth ? 'stretch' : 'auto', opacity: disabled ? 0.45 : 1 }, style]}
    >
      <Animated.View
        style={[
          {
            height: HEIGHTS[size],
            paddingHorizontal: PADDINGS[size],
            borderRadius: radius.md,
            backgroundColor: bg,
            borderWidth: 1,
            borderColor,
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'row',
            gap: spacing.sm,
          },
          animStyle,
        ]}
      >
        {loading ? (
          <ActivityIndicator color={fg} />
        ) : (
          <>
            {leftIcon}
            <Text variant={size === 'sm' ? 'small' : 'bodyStrong'} color={fg} style={{ letterSpacing: 0.2 }}>
              {title}
            </Text>
            {rightIcon}
          </>
        )}
      </Animated.View>
    </Pressable>
  );
}

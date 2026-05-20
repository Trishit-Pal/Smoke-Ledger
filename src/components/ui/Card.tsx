import React from 'react';
import { View, ViewProps, StyleProp, ViewStyle } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { radius, spacing } from '@/constants/theme';

export interface CardProps extends ViewProps {
  padded?: boolean;
  glow?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function Card({ padded = true, glow = false, style, children, ...rest }: CardProps) {
  const theme = useTheme();
  const isDark = theme.mode === 'dark';
  return (
    <View
      {...rest}
      style={[
        {
          backgroundColor: theme.card,
          borderColor: glow ? theme.accent + '40' : theme.border,
          borderWidth: 1,
          borderRadius: radius.xl,
          padding: padded ? spacing.lg : 0,
          shadowColor: isDark ? theme.accent : '#000000',
          shadowOffset: { width: 0, height: isDark ? 0 : 2 },
          shadowOpacity: isDark ? (glow ? 0.18 : 0.08) : 0.06,
          shadowRadius: isDark ? (glow ? 24 : 14) : 8,
          elevation: isDark ? 4 : 2,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

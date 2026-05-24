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
          // Editorial: paper surface with hairline border instead of heavy chrome
          backgroundColor: theme.card,
          borderColor: glow ? theme.accentGlow : theme.rule,
          borderWidth: 1,
          borderRadius: radius.lg,
          padding: padded ? spacing.lg : 0,
          // Subtle elevation — light gets a faint ink shadow, dark is flat
          shadowColor: isDark ? '#000000' : '#0B0F14',
          shadowOffset: { width: 0, height: isDark ? 0 : 1 },
          shadowOpacity: isDark ? 0 : 0.04,
          shadowRadius: isDark ? 0 : 4,
          elevation: isDark ? 0 : 1,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

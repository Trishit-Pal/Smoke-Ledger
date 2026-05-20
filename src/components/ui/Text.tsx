import React from 'react';
import { Text as RNText, TextProps, StyleProp, TextStyle } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { typography } from '@/constants/theme';

type Variant = keyof typeof typography;

export interface TypedTextProps extends TextProps {
  variant?: Variant;
  muted?: boolean;
  faint?: boolean;
  color?: string;
  style?: StyleProp<TextStyle>;
}

export function Text({ variant = 'body', muted, faint, color, style, ...rest }: TypedTextProps) {
  const theme = useTheme();
  const base = typography[variant];
  const resolved = color ?? (faint ? theme.textFaint : muted ? theme.textMuted : theme.text);
  return <RNText {...rest} style={[base as TextStyle, { color: resolved }, style]} />;
}

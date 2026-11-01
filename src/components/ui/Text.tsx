import React from 'react';
import { Text as RNText, TextProps, StyleProp, TextStyle } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { typography } from '@/constants/theme';

type Variant = keyof typeof typography;

// Display numerals are already large; past ~1.6× system text size they push a
// ledger row off-screen. Body text keeps full Dynamic Type / sp scaling.
const LARGE_VARIANT_MAX_SCALE = 1.6;
const CAPPED: ReadonlySet<Variant> = new Set<Variant>(['display', 'h1']);

export interface TypedTextProps extends TextProps {
  variant?: Variant;
  muted?: boolean;
  faint?: boolean;
  color?: string;
  style?: StyleProp<TextStyle>;
}

export function Text({ variant = 'body', muted, faint, color, style, maxFontSizeMultiplier, ...rest }: TypedTextProps) {
  const theme = useTheme();
  const base = typography[variant];
  const resolved = color ?? (faint ? theme.textFaint : muted ? theme.textMuted : theme.text);
  return (
    <RNText
      {...rest}
      maxFontSizeMultiplier={maxFontSizeMultiplier ?? (CAPPED.has(variant) ? LARGE_VARIANT_MAX_SCALE : undefined)}
      style={[base as TextStyle, { color: resolved }, style]}
    />
  );
}

import React, { useState } from 'react';
import { TextInput, View, StyleProp, ViewStyle, TextInputProps } from 'react-native';
import { Text } from './Text';
import { useTheme } from '@/hooks/useTheme';
import { radius, spacing, typography, fonts } from '@/constants/theme';

export interface InputProps extends Omit<TextInputProps, 'style'> {
  label?: string;
  hint?: string;
  error?: string | null;
  leftSlot?: React.ReactNode;
  rightSlot?: React.ReactNode;
  containerStyle?: StyleProp<ViewStyle>;
}

export function Input({ label, hint, error, leftSlot, rightSlot, containerStyle, onFocus, onBlur, ...rest }: InputProps) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);

  // Editorial: hairline border — danger on error, accent on focus, rule at rest
  const borderColor = error ? theme.danger : focused ? theme.accent : theme.rule;

  return (
    <View style={[{ gap: spacing.xs }, containerStyle]}>
      {label ? (
        // Editorial caption label — uppercase, wide tracking, muted
        <Text
          variant="caption"
          muted
          style={{ textTransform: 'uppercase', letterSpacing: 1.6 }}
        >
          {label}
        </Text>
      ) : null}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          borderWidth: 1,
          borderColor,
          borderRadius: radius.md,
          backgroundColor: theme.bgElevated,
          paddingHorizontal: spacing.md,
          minHeight: 48,
        }}
      >
        {leftSlot ? <View style={{ marginRight: spacing.sm }}>{leftSlot}</View> : null}
        <TextInput
          placeholderTextColor={theme.textFaint}
          {...rest}
          onFocus={(e) => { setFocused(true); onFocus?.(e); }}
          onBlur={(e) => { setFocused(false); onBlur?.(e); }}
          style={{
            flex: 1,
            color: theme.text,
            fontFamily: fonts.body,
            fontSize: typography.body.fontSize,
            paddingVertical: spacing.sm,
          }}
        />
        {rightSlot ? <View style={{ marginLeft: spacing.sm }}>{rightSlot}</View> : null}
      </View>
      {error ? (
        <Text variant="small" color={theme.danger}>{error}</Text>
      ) : hint ? (
        <Text variant="small" muted>{hint}</Text>
      ) : null}
    </View>
  );
}

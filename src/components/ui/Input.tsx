import React, { useState } from 'react';
import { TextInput, View, StyleProp, ViewStyle, TextInputProps } from 'react-native';
import { Text } from './Text';
import { useTheme } from '@/hooks/useTheme';
import { radius, spacing } from '@/constants/theme';

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

  const borderColor = error ? theme.danger : focused ? theme.accent : theme.border;
  const glowOpacity = focused ? (theme.mode === 'dark' ? 0.25 : 0.15) : 0;

  return (
    <View style={[{ gap: spacing.xs }, containerStyle]}>
      {label ? (
        <Text variant="caption" muted>
          {label.toUpperCase()}
        </Text>
      ) : null}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          borderWidth: 1,
          borderColor,
          borderRadius: radius.lg,
          backgroundColor: theme.bgElevated,
          paddingHorizontal: spacing.md,
          minHeight: 50,
          shadowColor: error ? theme.danger : theme.accent,
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: glowOpacity,
          shadowRadius: 10,
          elevation: focused ? 2 : 0,
        }}
      >
        {leftSlot ? <View style={{ marginRight: spacing.sm }}>{leftSlot}</View> : null}
        <TextInput
          placeholderTextColor={theme.textFaint}
          {...rest}
          onFocus={(e) => { setFocused(true); onFocus?.(e); }}
          onBlur={(e) => { setFocused(false); onBlur?.(e); }}
          style={{ flex: 1, color: theme.text, fontSize: 15, paddingVertical: spacing.sm }}
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

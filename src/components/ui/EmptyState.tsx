import React from 'react';
import { View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { Text } from './Text';
import { Button } from './Button';
import { useTheme } from '@/hooks/useTheme';
import { spacing } from '@/constants/theme';

export interface EmptyStateProps {
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({ title, description, actionLabel, onAction }: EmptyStateProps) {
  const theme = useTheme();
  return (
    <View style={{ alignItems: 'center', paddingVertical: spacing.xxl + 8, gap: spacing.md }}>
      {/* Editorial concentric rings — hairline rule color, teal dot */}
      <View style={{ marginBottom: spacing.sm }}>
        <Svg width={64} height={64} viewBox="0 0 64 64" aria-hidden>
          <Circle cx={32} cy={32} r={30} stroke={theme.rule} strokeWidth={1} fill="none" />
          <Circle cx={32} cy={32} r={20} stroke={theme.rule} strokeWidth={1} fill="none" />
          <Circle cx={32} cy={32} r={5} fill={theme.accentSoft} />
          <Circle cx={32} cy={32} r={2.5} fill={theme.accent} opacity={0.7} />
        </Svg>
      </View>
      {/* Editorial caption heading — body-strong for the title */}
      <Text variant="h3" style={{ textAlign: 'center' }}>{title}</Text>
      {description ? (
        <Text variant="small" muted style={{ textAlign: 'center', maxWidth: 280, lineHeight: 20 }}>
          {description}
        </Text>
      ) : null}
      {actionLabel && onAction ? (
        <View style={{ marginTop: spacing.sm }}>
          <Button title={actionLabel} onPress={onAction} variant="secondary" />
        </View>
      ) : null}
    </View>
  );
}

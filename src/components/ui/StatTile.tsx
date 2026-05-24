import React from 'react';
import { View } from 'react-native';
import { Text } from './Text';
import { Card } from './Card';
import { useTheme } from '@/hooks/useTheme';
import { spacing, typography } from '@/constants/theme';
import { AnimatedNumber } from '@/components/anim/AnimatedNumber';

export interface StatTileProps {
  label: string;
  value: string;
  /** Optional: when provided, the value cell animates from previous to current using AnimatedNumber. */
  animatedValue?: number;
  /** Optional formatter applied while animatedValue interpolates. */
  formatAnimated?: (n: number) => string;
  sublabel?: string;
  tone?: 'default' | 'success' | 'warn' | 'danger';
  hidden?: boolean;
}

export function StatTile({
  label,
  value,
  animatedValue,
  formatAnimated,
  sublabel,
  tone = 'default',
  hidden,
}: StatTileProps) {
  const theme = useTheme();
  const color =
    tone === 'warn'    ? theme.warn
    : tone === 'danger'  ? theme.danger
    : tone === 'success' ? theme.success
    : theme.text;

  return (
    <Card style={{ flex: 1, minWidth: 140 }}>
      <View
        style={{ gap: spacing.xs }}
        accessible
        accessibilityLabel={`${label}: ${hidden ? 'hidden' : value}${sublabel ? `. ${sublabel}` : ''}`}
      >
        {/* Editorial caption label — uppercase, wide tracking */}
        <Text
          variant="caption"
          muted
          style={{ textTransform: 'uppercase', letterSpacing: 1.6 }}
        >
          {label}
        </Text>
        {/* Editorial numeral — Fraunces display family, tabular figures */}
        {hidden || animatedValue == null ? (
          <Text
            variant="display"
            color={color}
            style={{ fontVariant: ['tabular-nums'] }}
          >
            {hidden ? '••••' : value}
          </Text>
        ) : (
          <AnimatedNumber
            value={animatedValue}
            format={formatAnimated ?? ((n) => Math.round(n).toString())}
            style={[
              typography.display as object,
              { color, fontVariant: ['tabular-nums'] as ('tabular-nums')[] },
            ]}
          />
        )}
        {sublabel ? (
          <Text variant="small" muted>
            {sublabel}
          </Text>
        ) : null}
      </View>
    </Card>
  );
}

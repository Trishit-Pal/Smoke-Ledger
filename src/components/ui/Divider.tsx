import React from 'react';
import { View } from 'react-native';
import { useTheme } from '@/hooks/useTheme';

export interface DividerProps {
  inset?: number;
  strong?: boolean;
}

export function Divider({ inset = 0, strong = false }: DividerProps) {
  const theme = useTheme();
  // Editorial hairline rule — theme.rule (soft) or theme.ruleStrong (for section dividers)
  return <View style={{ height: 1, backgroundColor: strong ? theme.ruleStrong : theme.rule, marginLeft: inset }} />;
}

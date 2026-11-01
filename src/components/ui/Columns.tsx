import React from 'react';
import { View } from 'react-native';
import { spacing } from '@/constants/theme';
import { useLayout } from '@/hooks/useLayout';

export interface ColumnsProps {
  children: React.ReactNode;
  gap?: number;
}

/**
 * Pairs sibling sections side by side on a wide window (tablet, unfolded
 * foldable, landscape split pane); on a phone it renders the children untouched,
 * so the parent's vertical rhythm (its own `gap`) is unchanged. Restructure,
 * don't stretch: charts measure via onLayout, so each half re-flows itself.
 */
export function Columns({ children, gap = spacing.xl }: ColumnsProps) {
  const { isWide } = useLayout();
  if (!isWide) return <>{children}</>;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap }}>
      {React.Children.toArray(children).map((child, i) => (
        <View key={i} style={{ flex: 1, minWidth: 0 }}>
          {child}
        </View>
      ))}
    </View>
  );
}

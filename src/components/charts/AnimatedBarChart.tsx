import React from 'react';
import { Reveal } from '@/components/anim/Reveal';
import { BarChart, BarChartProps } from '@/components/charts/BarChart';

/**
 * Drop-in replacement for BarChart that fades + scales on mount and on data
 * change. Heavy work stays inside BarChart; we only animate the wrapper.
 */
export function AnimatedBarChart(props: BarChartProps) {
  const dep = `${props.data.length}|${props.data.reduce((a, d) => a + d.value, 0).toFixed(2)}`;
  return (
    <Reveal dependencyKey={dep}>
      <BarChart {...props} />
    </Reveal>
  );
}

'use client';

import * as React from 'react';
import { BarChart, type BarChartProps } from '@web/components/charts/BarChart';
import { Reveal } from '@web/components/anim/Reveal';

export type AnimatedBarChartProps = BarChartProps;

export function AnimatedBarChart(props: AnimatedBarChartProps) {
  const dependencyKey = React.useMemo(
    () => props.data.map((d) => d.value).join(','),
    [props.data],
  );
  return (
    <Reveal dependencyKey={dependencyKey}>
      <BarChart {...props} />
    </Reveal>
  );
}

export default AnimatedBarChart;

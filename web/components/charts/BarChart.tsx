'use client';

import * as React from 'react';
import { useReduceMotion } from '@web/hooks/useReduceMotion';
import { useIsDesktop } from '@web/hooks/useMediaQuery';
import {
  Bar,
  BarChart as RBarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts';
import { ChartDataTable } from '@web/components/charts/ChartDataTable';
import { CHART, CHART_SERIES, chartAxisTick, ChartTooltip } from '@web/components/charts/chartTheme';

export interface BarChartProps {
  data: { label: string; value: number }[];
  height?: number;
  formatY?: (v: number) => string;
  showLabels?: boolean;
  emphasizeLast?: boolean;
  /** Names the chart for assistive tech (caption of its data table). */
  title?: string;
}

export function BarChart({
  data,
  height = 160,
  formatY,
  showLabels = true,
  emphasizeLast = true,
  title = 'Bar chart',
}: BarChartProps) {
  const lastIndex = data.length - 1;
  const reduced = useReduceMotion();
  const fill = CHART_SERIES[0];
  // Grow taller on desktop to use the wider content column; phones/tablets keep
  // the passed height.
  const isDesktop = useIsDesktop();
  const h = isDesktop ? Math.round(height * 1.25) : height;

  return (
    <>
    <div style={{ width: '100%', height: h }} aria-hidden>
      <ResponsiveContainer width="100%" height="100%">
        <RBarChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
          <CartesianGrid stroke={CHART.grid} strokeDasharray="3 3" vertical={false} />
          {showLabels ? (
            <XAxis
              dataKey="label"
              tick={chartAxisTick}
              tickLine={false}
              axisLine={{ stroke: CHART.axis }}
            />
          ) : (
            <XAxis dataKey="label" hide />
          )}
          {formatY ? (
            <YAxis
              tickFormatter={formatY}
              tick={chartAxisTick}
              tickLine={false}
              axisLine={{ stroke: CHART.axis }}
              width={40}
            />
          ) : (
            <YAxis hide />
          )}
          <Tooltip
            cursor={{ fill: 'var(--chart-cursor)', fillOpacity: 0.12 }}
            content={<ChartTooltip formatValue={formatY} />}
          />
          <Bar dataKey="value" fill={fill} radius={[4, 4, 0, 0]} isAnimationActive={!reduced}>
            {data.map((_, i) => (
              <Cell
                key={i}
                fill={fill}
                fillOpacity={emphasizeLast && i === lastIndex ? 1 : 0.62}
              />
            ))}
          </Bar>
        </RBarChart>
      </ResponsiveContainer>
    </div>
    <ChartDataTable caption={title} rows={data} formatValue={formatY} />
    </>
  );
}

export default BarChart;

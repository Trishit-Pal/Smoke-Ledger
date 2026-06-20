'use client';

import { useReduceMotion } from '@web/hooks/useReduceMotion';
import { useIsDesktop } from '@web/hooks/useMediaQuery';
import {
  CartesianGrid,
  Line,
  LineChart as RLineChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts';
import { CHART, CHART_SERIES, chartAxisTick, ChartTooltip } from '@web/components/charts/chartTheme';

export interface LineChartProps {
  data: { label: string; value: number }[];
  height?: number;
  formatY?: (v: number) => string;
  strokeColor?: string;
}

export function LineChart({ data, height = 160, formatY, strokeColor }: LineChartProps) {
  const stroke = strokeColor ?? CHART_SERIES[0];
  const reduced = useReduceMotion();
  // Grow taller on desktop to use the wider content column; phones/tablets keep
  // the passed height.
  const isDesktop = useIsDesktop();
  const h = isDesktop ? Math.round(height * 1.25) : height;

  return (
    <div style={{ width: '100%', height: h }}>
      <ResponsiveContainer width="100%" height="100%">
        <RLineChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke={CHART.grid} strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="label"
            tick={chartAxisTick}
            tickLine={false}
            axisLine={{ stroke: CHART.axis }}
          />
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
            cursor={{ stroke: CHART.cursor, strokeDasharray: '4 4' }}
            content={<ChartTooltip formatValue={formatY} />}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke={stroke}
            strokeWidth={2.25}
            dot={{ r: 2.5, fill: stroke, stroke }}
            activeDot={{ r: 4.5 }}
            isAnimationActive={!reduced}
          />
        </RLineChart>
      </ResponsiveContainer>
    </div>
  );
}

export default LineChart;

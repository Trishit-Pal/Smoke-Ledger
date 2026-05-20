'use client';

import * as React from 'react';
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

export interface BarChartProps {
  data: { label: string; value: number }[];
  height?: number;
  formatY?: (v: number) => string;
  showLabels?: boolean;
  emphasizeLast?: boolean;
}

const ACCENT = 'var(--accent)';
const BORDER = 'var(--border)';
const TEXT_MUTED = 'var(--text-muted)';

export function BarChart({
  data,
  height = 160,
  formatY,
  showLabels = true,
  emphasizeLast = true,
}: BarChartProps) {
  const lastIndex = data.length - 1;

  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer width="100%" height="100%">
        <RBarChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
          <CartesianGrid stroke={BORDER} strokeDasharray="3 3" vertical={false} />
          {showLabels ? (
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: TEXT_MUTED }}
              tickLine={false}
              axisLine={{ stroke: BORDER }}
            />
          ) : (
            <XAxis dataKey="label" hide />
          )}
          {formatY ? (
            <YAxis
              tickFormatter={formatY}
              tick={{ fontSize: 11, fill: TEXT_MUTED }}
              tickLine={false}
              axisLine={{ stroke: BORDER }}
              width={40}
            />
          ) : (
            <YAxis hide />
          )}
          <Tooltip
            cursor={{ fill: 'transparent' }}
            contentStyle={{
              background: 'var(--card)',
              border: `1px solid ${BORDER}`,
              borderRadius: 8,
              fontSize: 12,
              color: 'var(--text)',
            }}
            labelStyle={{ color: 'var(--text-muted)' }}
            formatter={(v: number) => (formatY ? formatY(v) : v)}
          />
          <Bar dataKey="value" fill={ACCENT} radius={[4, 4, 0, 0]}>
            {data.map((_, i) => (
              <Cell
                key={i}
                fill={ACCENT}
                fillOpacity={emphasizeLast && i === lastIndex ? 1 : 0.55}
              />
            ))}
          </Bar>
        </RBarChart>
      </ResponsiveContainer>
    </div>
  );
}

export default BarChart;

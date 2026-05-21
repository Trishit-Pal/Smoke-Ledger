import { useReduceMotion } from '@web/hooks/useReduceMotion';
import {
  CartesianGrid,
  Line,
  LineChart as RLineChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts';

export interface LineChartProps {
  data: { label: string; value: number }[];
  height?: number;
  formatY?: (v: number) => string;
  strokeColor?: string;
}

const BORDER = 'var(--border)';
const TEXT_MUTED = 'var(--text-muted)';

export function LineChart({
  data,
  height = 160,
  formatY,
  strokeColor,
}: LineChartProps) {
  const stroke = strokeColor ?? 'var(--accent)';
  const reduced = useReduceMotion();

  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer width="100%" height="100%">
        <RLineChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke={BORDER} strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: TEXT_MUTED }}
            tickLine={false}
            axisLine={{ stroke: BORDER }}
          />
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
            cursor={{ stroke: BORDER, strokeDasharray: '3 3' }}
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
          <Line
            type="monotone"
            dataKey="value"
            stroke={stroke}
            strokeWidth={2}
            dot={{ r: 2.5, fill: stroke, stroke }}
            activeDot={{ r: 4 }}
            isAnimationActive={!reduced}
          />
        </RLineChart>
      </ResponsiveContainer>
    </div>
  );
}

export default LineChart;

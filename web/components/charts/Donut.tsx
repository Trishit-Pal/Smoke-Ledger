'use client';

import * as React from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';

export interface DonutSlice {
  label: string;
  value: number;
  color?: string;
}

export interface DonutProps {
  slices: DonutSlice[];
  size?: number;
  centerLabel?: string;
  centerValue?: string;
}

const PALETTE = ['#2FA39B', '#4C7CD9', '#D99A2B', '#C85A54', '#8A6FC2', '#4CAF84'];

export function Donut({ slices, size = 140, centerLabel, centerValue }: DonutProps) {
  const safeSlices = slices.filter((s) => s.value > 0);
  const inner = Math.round(size * 0.6);
  const outer = Math.round(size * 0.85);

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={safeSlices}
            dataKey="value"
            nameKey="label"
            innerRadius={inner / 2}
            outerRadius={outer / 2}
            stroke="none"
            isAnimationActive
          >
            {safeSlices.map((slice, idx) => (
              <Cell
                key={`${slice.label}-${idx}`}
                fill={slice.color ?? PALETTE[idx % PALETTE.length]}
              />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              background: 'var(--card)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              fontSize: 12,
              color: 'var(--text)',
            }}
          />
        </PieChart>
      </ResponsiveContainer>
      {(centerLabel || centerValue) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          {centerValue ? (
            <span className="text-h2 font-bold text-text leading-none">{centerValue}</span>
          ) : null}
          {centerLabel ? (
            <span className="text-caption uppercase text-text-muted mt-1">{centerLabel}</span>
          ) : null}
        </div>
      )}
    </div>
  );
}

export default Donut;

'use client';

import * as React from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { useReduceMotion } from '@web/hooks/useReduceMotion';
import { ChartDataTable } from '@web/components/charts/ChartDataTable';
import { CHART_SERIES, chartTooltipStyle } from '@web/components/charts/chartTheme';

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
  /** Names the chart for assistive tech (caption of its data table). */
  title?: string;
  /** Formats slice values (tooltip + table), e.g. discreet masking. Default: String. */
  formatValue?: (v: number) => string;
  /** Formats slice names (tooltip + table), e.g. brand aliasing. Default: identity. */
  formatLabel?: (label: string, index: number) => string;
}

export function Donut({
  slices,
  size = 140,
  centerLabel,
  centerValue,
  title = 'Share by category',
  formatValue,
  formatLabel,
}: DonutProps) {
  const reduced = useReduceMotion();
  const safeSlices = slices.filter((s) => s.value > 0);
  const inner = Math.round(size * 0.6);
  const outer = Math.round(size * 0.85);

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <div className="contents" aria-hidden>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={safeSlices}
            dataKey="value"
            nameKey="label"
            innerRadius={inner / 2}
            outerRadius={outer / 2}
            stroke="none"
            isAnimationActive={!reduced}
          >
            {safeSlices.map((slice, idx) => (
              <Cell
                key={`${slice.label}-${idx}`}
                fill={slice.color ?? CHART_SERIES[idx % CHART_SERIES.length]}
              />
            ))}
          </Pie>
          <Tooltip
            contentStyle={chartTooltipStyle}
            formatter={(value, name) => {
              const i = safeSlices.findIndex((s) => s.label === name);
              return [
                formatValue ? formatValue(Number(value)) : value,
                formatLabel && i >= 0 ? formatLabel(String(name), i) : name,
              ];
            }}
          />
        </PieChart>
      </ResponsiveContainer>
      </div>
      <ChartDataTable caption={title} rows={safeSlices} formatValue={formatValue} formatLabel={formatLabel} />
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

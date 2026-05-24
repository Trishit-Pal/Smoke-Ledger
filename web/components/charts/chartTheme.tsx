import * as React from 'react';

/**
 * Shared, theme-aware chart tokens + a richer tooltip, backed by the
 * `--chart-*` CSS variables in globals.css (which flip with the .dark class).
 * recharts consumes the CSS-var strings directly in the browser, so charts stay
 * in sync with light/dark without re-rendering on theme change.
 */
export const CHART = {
  grid: 'var(--chart-grid)',
  axis: 'var(--chart-axis)',
  tick: 'var(--chart-tick)',
  cursor: 'var(--chart-cursor)',
  tooltipBg: 'var(--chart-tooltip-bg)',
  tooltipText: 'var(--chart-tooltip-text)',
  tooltipBorder: 'var(--chart-tooltip-border)',
} as const;

/** Distinct, theme-aware series colours (teal, terracotta, blue, violet, amber, green). */
export const CHART_SERIES: string[] = [
  'var(--chart-series-1)',
  'var(--chart-series-2)',
  'var(--chart-series-3)',
  'var(--chart-series-4)',
  'var(--chart-series-5)',
  'var(--chart-series-6)',
];

/** Shared axis tick style — uses the higher-contrast tick token. */
export const chartAxisTick = { fontSize: 11, fill: CHART.tick } as const;

/** contentStyle for recharts' default Tooltip (used where the default label/value layout is fine, e.g. Donut). */
export const chartTooltipStyle = {
  background: CHART.tooltipBg,
  border: `1px solid ${CHART.tooltipBorder}`,
  borderRadius: 8,
  fontSize: 12,
  color: CHART.tooltipText,
  boxShadow: 'var(--shadow-card)',
} as const;

type TooltipEntry = { name?: string | number; value?: number | string; color?: string };

export interface ChartTooltipProps {
  active?: boolean;
  label?: string | number;
  payload?: TooltipEntry[];
  /** Optional value formatter (e.g. INR / minutes). */
  formatValue?: (v: number) => string;
}

/**
 * Richer custom tooltip for line/bar charts: a muted label header, then each
 * series value with a colour swatch and tabular figures. Pass to recharts via
 * `content={<ChartTooltip formatValue={fmt} />}`.
 */
export function ChartTooltip({ active, label, payload, formatValue }: ChartTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div
      style={{
        background: CHART.tooltipBg,
        border: `1px solid ${CHART.tooltipBorder}`,
        borderRadius: 8,
        padding: '8px 10px',
        fontSize: 12,
        color: CHART.tooltipText,
        boxShadow: 'var(--shadow-card)',
      }}
    >
      {label != null && label !== '' ? (
        <div style={{ color: 'var(--text-muted)', marginBottom: 4 }}>{label}</div>
      ) : null}
      {payload.map((entry, i) => {
        const raw = entry.value;
        const num = typeof raw === 'number' ? raw : Number(raw);
        const text =
          formatValue && Number.isFinite(num) ? formatValue(num) : String(raw ?? '');
        return (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span
              aria-hidden
              style={{
                width: 8,
                height: 8,
                borderRadius: 2,
                background: entry.color ?? CHART.tick,
                display: 'inline-block',
              }}
            />
            <span style={{ fontVariantNumeric: 'tabular-nums' }}>{text}</span>
          </div>
        );
      })}
    </div>
  );
}

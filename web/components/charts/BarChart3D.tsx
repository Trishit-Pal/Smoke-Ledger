'use client';

/*
 * BarChart3D — a pseudo-3D bar chart via CSS perspective/rotate + layered
 * shadow, not a 3D rendering library. Token-driven fill so it themes with
 * light/dark like every other chart. The tilt is a persistent transform, not
 * a one-shot transition — under prefers-reduced-motion it's dropped entirely
 * in favor of flat bars, since a standing perspective effect is itself a
 * motion effect some users need off.
 */

import * as React from 'react';
import { useReduceMotion } from '@web/hooks/useReduceMotion';
import { CHART_SERIES } from './chartTheme';

export interface BarChart3DDatum {
  label: string;
  value: number;
}

export interface BarChart3DProps {
  data: BarChart3DDatum[];
  color?: string;
  /** Formats the per-bar value (visible + aria), e.g. discreet masking. Default: String. */
  formatValue?: (v: number) => string;
}

export function BarChart3D({ data, color = CHART_SERIES[0], formatValue = String }: BarChart3DProps) {
  const reduced = useReduceMotion();

  if (!data.length) {
    return <div className="flex h-52 w-full items-center justify-center text-small text-text-faint">No data available</div>;
  }

  const maxValue = Math.max(...data.map((d) => d.value), 1);

  return (
    <div
      className="scene-3d relative h-52 w-full"
      role="img"
      aria-label={`${data.map((d) => `${d.label} ${formatValue(d.value)}`).join(', ')}`}
    >
      <div
        className="absolute inset-x-4 bottom-8 top-4 flex items-end justify-between gap-sm"
        style={
          reduced
            ? undefined
            : { transform: 'rotateX(18deg) rotateY(-12deg)', transformStyle: 'preserve-3d' }
        }
      >
        {data.map((d, i) => {
          const heightPct = (d.value / maxValue) * 100;
          return (
            <div key={`${d.label}-${i}`} className="flex flex-1 flex-col items-center gap-xs" aria-hidden>
              <div
                className="relative w-full max-w-[52px] rounded-md"
                style={{
                  // Zero days stay flat — a forced min-height would read a
                  // no-smoke day as comparable to a light one, which the app's
                  // honesty mandate rules out.
                  height: `${heightPct}%`,
                  minHeight: d.value > 0 ? 36 : 0,
                  transformOrigin: 'center bottom',
                  background: color,
                  boxShadow: reduced
                    ? undefined
                    : 'rgba(0, 0, 0, 0.35) 8px 12px 24px, rgba(255, 255, 255, 0.08) -4px 0px 12px inset',
                }}
              >
                <div
                  className="absolute inset-y-0 right-0 w-2 rounded-r-md opacity-40"
                  style={{ background: 'linear-gradient(rgb(255, 255, 255), transparent)' }}
                />
              </div>
              <div className="text-center">
                <p className="text-small font-medium text-text nums-tabular">{formatValue(d.value)}</p>
                <p className="editorial-caption-tight">{d.label}</p>
              </div>
            </div>
          );
        })}
      </div>
      <div className="absolute inset-x-6 bottom-2 h-px" style={{ background: 'var(--rule)' }} />
    </div>
  );
}

export default BarChart3D;

'use client';

/*
 * WeekStrip — last 7 days as an editorial mini bar chart that lives inside the
 * dashboard's one inverted (ink) panel. Bars are typographic-thin and rounded,
 * with the day initial under each bar. The current day is the only saturated
 * bar; the rest sit back. No grid lines — the editorial rule above the panel
 * does the framing work.
 *
 * Pure SVG so it inherits theme variables and respects reduced motion. No
 * recharts here on purpose: we want full control over the visual register.
 */

import * as React from 'react';
import { useReduceMotion } from '@web/hooks/useReduceMotion';

export interface WeekStripDatum {
  label: string;
  value: number;
}

export interface WeekStripProps {
  data: WeekStripDatum[];
  inverted?: boolean;
  hidden?: boolean;
}

export function WeekStrip({ data, inverted = false, hidden = false }: WeekStripProps) {
  const reduced = useReduceMotion();
  const max = Math.max(1, ...data.map((d) => d.value));
  const last = data.length - 1;

  // Track colours: inverted panel uses the inverted ink surface theme tokens so
  // bars stay visible against the dark backdrop without redefining the palette.
  const trackColour = inverted ? 'var(--ink-surface-rule)' : 'var(--rule)';
  const restColour = inverted ? 'rgba(230, 234, 239, 0.45)' : 'rgba(11, 15, 20, 0.30)';
  const todayColour = 'var(--accent)';
  const labelColour = inverted ? 'var(--ink-surface-muted)' : 'var(--text-muted)';

  return (
    <div
      className="w-full"
      role="img"
      aria-label={
        hidden
          ? 'Last seven days — counts hidden'
          : `Last seven days: ${data.map((d) => `${d.label} ${d.value}`).join(', ')}`
      }
    >
      <div
        className="grid items-end gap-sm"
        style={{ gridTemplateColumns: `repeat(${data.length}, minmax(0, 1fr))`, height: 96 }}
      >
        {data.map((d, i) => {
          const isLast = i === last;
          const pct = hidden ? 0.3 : Math.max(0.06, d.value / max);
          return (
            <div key={`${d.label}-${i}`} className="relative h-full flex flex-col justify-end items-center">
              {/* track */}
              <span
                aria-hidden
                className="absolute inset-x-0 bottom-0 mx-auto rounded-pill"
                style={{
                  width: 8,
                  height: '100%',
                  background: trackColour,
                  opacity: 0.35,
                }}
              />
              {/* fill */}
              <span
                aria-hidden
                className="relative rounded-pill"
                style={{
                  width: 8,
                  height: `${pct * 100}%`,
                  background: isLast ? todayColour : restColour,
                  transition: reduced ? 'none' : 'height 600ms cubic-bezier(0.16, 1, 0.3, 1)',
                  transitionDelay: `${i * 40}ms`,
                }}
              />
            </div>
          );
        })}
      </div>
      <div
        className="grid gap-sm mt-sm nums-tabular"
        style={{ gridTemplateColumns: `repeat(${data.length}, minmax(0, 1fr))` }}
      >
        {data.map((d, i) => (
          <div key={`l-${i}`} className="text-center">
            <div
              className="text-caption uppercase tracking-wider"
              style={{ color: labelColour, opacity: i === last ? 1 : 0.7 }}
            >
              {d.label}
            </div>
            <div
              className="text-small font-medium nums-tabular"
              style={{ color: i === last ? 'var(--accent)' : labelColour }}
            >
              {hidden ? '••' : d.value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default WeekStrip;

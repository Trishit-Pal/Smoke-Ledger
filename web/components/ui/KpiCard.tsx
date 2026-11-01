'use client';

/*
 * KpiCard — one headline number in a summary strip. Editorial: no raised
 * surface, no glow — a hairline top rule, a small-caps label and a serif
 * numeral, so it sits in the same ledger language as MetricRow. An optional
 * ProgressRing sits to the right.
 */

import * as React from 'react';
import { ProgressRing } from './ProgressRing';

export interface KpiCardProps {
  label: string;
  value: React.ReactNode;
  unit?: string;
  progress?: number;
  /** Ring stroke color — defaults to ProgressRing's own `var(--accent)`. */
  progressColor?: string;
  children?: React.ReactNode;
}

export function KpiCard({ label, value, unit, progress, progressColor, children }: KpiCardProps) {
  return (
    <article className="rule-hair-strong pt-md">
      <div className="flex items-start justify-between gap-md">
        <div className="flex flex-col min-w-0">
          <p className="editorial-caption">{label}</p>
          {/* Wraps so "12 cigarettes" never overflows a 2-up card on a 320px phone. */}
          <div className="mt-sm flex flex-wrap items-end gap-x-xs min-w-0">
            <span className="editorial-numeral--micro nums-tabular break-words min-w-0">{value}</span>
            {unit ? <span className="mb-xs text-small text-text-muted">{unit}</span> : null}
          </div>
        </div>

        {/* One ring, sized by CSS: 40px below sm so a 2-up card on a 320px phone
            keeps room for the numeral, 64px from sm. Quiet (no halo) at every
            size: beside the editorial numeral it is a measure, not a badge. */}
        {progress !== undefined ? (
          <div aria-hidden className="shrink-0">
            <ProgressRing percent={progress} size={64} color={progressColor} ringBg="var(--rule)" className="w-10 sm:w-16" quiet />
          </div>
        ) : null}
      </div>

      {children ? <div className="mt-md">{children}</div> : null}
    </article>
  );
}

export default KpiCard;

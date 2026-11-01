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

        {/* Below sm a 64px ring starves the numeral of width in a 2-up card on a
            320px phone, so phones get a 40px ring (the same reading, smaller). */}
        {progress !== undefined ? (
          <div aria-hidden className="shrink-0">
            <span className="sm:hidden">
              <ProgressRing percent={progress} size={40} strokeWidth={5} color={progressColor} ringBg="var(--rule)" />
            </span>
            <span className="hidden sm:inline">
              <ProgressRing percent={progress} size={64} color={progressColor} ringBg="var(--rule)" />
            </span>
          </div>
        ) : null}
      </div>

      {children ? <div className="mt-md">{children}</div> : null}
    </article>
  );
}

export default KpiCard;

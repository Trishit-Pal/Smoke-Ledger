'use client';

/*
 * KpiCard — a small elevated tile for one headline number + optional
 * ProgressRing. Editorial-depth pilot: opaque token surface with a restrained
 * hover lift, not the glass/blur SaaS-card look. The corner accent wash is a
 * hover-only reveal (resting opacity 0) so teal stays off the surface at rest,
 * honoring the "accent ≤10%, positive-only" restraint.
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
    <article className="elevated elevated-hover group relative overflow-hidden rounded-xl p-lg">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-8 -top-10 h-28 w-28 rounded-full opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-100"
        style={{ background: 'color-mix(in srgb, var(--accent) 20%, transparent)' }}
      />

      <div className="flex items-start justify-between gap-md">
        <div className="flex flex-col">
          <p className="editorial-caption">{label}</p>
          <div className="mt-sm flex items-end gap-xs">
            <span className="text-h1 font-semibold tracking-tight text-text nums-tabular">{value}</span>
            {unit ? <span className="mb-xs text-small text-text-muted">{unit}</span> : null}
          </div>
        </div>

        {progress !== undefined ? (
          <div aria-hidden>
            <ProgressRing percent={progress} size={78} color={progressColor} ringBg="var(--rule)" />
          </div>
        ) : null}
      </div>

      {children ? <div className="mt-md">{children}</div> : null}
    </article>
  );
}

export default KpiCard;

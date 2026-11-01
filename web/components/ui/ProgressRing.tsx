'use client';

/*
 * ProgressRing — a compact SVG ring for percent-shaped data (KPI cards, the
 * dashboard goal verse, GoalCard). Token-driven: the glow always matches the
 * passed `color`, so an at-risk goal in `--warn-earth` actually glows
 * terracotta rather than a hardcoded accent teal.
 */

import * as React from 'react';
import { useReduceMotion } from '@web/hooks/useReduceMotion';
import { ringGlow } from './ringGlow';

export interface ProgressRingProps {
  percent: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
  ringBg?: string;
  /** Lets the caller size the ring from CSS (e.g. `w-10 sm:w-16`); the SVG
   *  scales with its box via viewBox, so one instance serves every breakpoint. */
  className?: string;
  /** No halo. Use where the ring is small or beside a numeral it must not outshine. */
  quiet?: boolean;
}

export function ProgressRing({
  percent,
  size = 78,
  strokeWidth = 7,
  color = 'var(--accent)',
  ringBg = 'var(--rule)',
  className,
  quiet = false,
}: ProgressRingProps) {
  const reduced = useReduceMotion();
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, percent));
  const offset = circumference * (1 - clamped / 100);

  return (
    <div
      className={`relative inline-flex aspect-square items-center justify-center ${className ?? ''}`}
      style={className ? undefined : { width: size, height: size }}
    >
      <svg className="-rotate-90 h-full w-full" viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={ringBg} strokeWidth={strokeWidth} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{
            filter: quiet ? undefined : `drop-shadow(0 0 ${ringGlow(size)}px ${color})`,
            transition: reduced ? 'none' : 'stroke-dashoffset 600ms cubic-bezier(0.22, 1, 0.36, 1)',
          }}
        />
      </svg>
    </div>
  );
}

export default ProgressRing;

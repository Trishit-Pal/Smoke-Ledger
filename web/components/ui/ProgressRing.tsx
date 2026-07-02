'use client';

/*
 * ProgressRing — a compact SVG ring for percent-shaped data (KPI cards, the
 * dashboard goal verse, GoalCard). Token-driven: the glow always matches the
 * passed `color`, so an at-risk goal in `--warn-earth` actually glows
 * terracotta rather than a hardcoded accent teal.
 */

import * as React from 'react';
import { useReduceMotion } from '@web/hooks/useReduceMotion';

export interface ProgressRingProps {
  percent: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
  ringBg?: string;
}

export function ProgressRing({
  percent,
  size = 78,
  strokeWidth = 7,
  color = 'var(--accent)',
  ringBg = 'var(--rule)',
}: ProgressRingProps) {
  const reduced = useReduceMotion();
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, percent));
  const offset = circumference * (1 - clamped / 100);

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" viewBox={`0 0 ${size} ${size}`}>
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
            filter: `drop-shadow(0 0 8px ${color})`,
            transition: reduced ? 'none' : 'stroke-dashoffset 600ms cubic-bezier(0.22, 1, 0.36, 1)',
          }}
        />
      </svg>
    </div>
  );
}

export default ProgressRing;

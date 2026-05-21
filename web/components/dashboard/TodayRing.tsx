'use client';

import * as React from 'react';
import { Text } from '@web/components/ui/Text';

export interface TodayRingProps {
  sticks: number;
  baseline: number | null | undefined;
  spendLabel: string;
  hidden?: boolean;
}

export function TodayRing({ sticks, baseline, spendLabel, hidden = false }: TodayRingProps) {
  const target = baseline && baseline > 0 ? baseline : 10;
  const pct = Math.min(100, Math.round((sticks / target) * 100));
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (pct / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-md py-md">
      <div className="relative flex items-center justify-center">
        <svg width="140" height="140" viewBox="0 0 140 140" aria-hidden>
          <circle
            cx="70"
            cy="70"
            r={radius}
            fill="none"
            stroke="var(--border)"
            strokeWidth="10"
          />
          <circle
            cx="70"
            cy="70"
            r={radius}
            fill="none"
            stroke="var(--accent)"
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            transform="rotate(-90 70 70)"
            className="transition-[stroke-dashoffset] duration-300 ease-out motion-reduce:transition-none"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <Text variant="display" className="font-serif text-[2.5rem] leading-none">
            {hidden ? '••' : sticks}
          </Text>
          <Text variant="caption" muted>
            today
          </Text>
        </div>
      </div>
      <div className="text-center">
        <Text variant="bodyStrong">{hidden ? '•••' : spendLabel}</Text>
        <Text variant="small" muted>
          {baseline ? `Baseline ~${hidden ? '••' : baseline}/day` : 'Set a baseline in onboarding'}
        </Text>
      </div>
    </div>
  );
}

import * as React from 'react';
import { cn } from '@web/components/ui/cn';

type Tone = 'default' | 'warn' | 'danger' | 'success';

export interface ProgressBarProps {
  value: number;
  tone?: Tone;
  height?: number;
  className?: string;
}

const TONE_CLASS: Record<Tone, string> = {
  default: 'bg-accent',
  warn: 'bg-warn',
  danger: 'bg-danger',
  success: 'bg-success',
};

export function ProgressBar({ value, tone = 'default', height = 8, className }: ProgressBarProps) {
  const safe = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(safe)}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn('w-full bg-border rounded-pill overflow-hidden', className)}
      style={{ height }}
    >
      <div
        className={cn('h-full rounded-pill transition-all duration-500', TONE_CLASS[tone])}
        style={{ width: `${safe}%` }}
      />
    </div>
  );
}

export default ProgressBar;

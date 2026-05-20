'use client';

import * as React from 'react';
import { cn } from '@web/components/ui/cn';

export interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  disabled?: boolean;
  className?: string;
}

export function Chip({ label, selected = false, onPress, disabled = false, className }: ChipProps) {
  return (
    <button
      type="button"
      onClick={onPress}
      disabled={disabled}
      aria-pressed={selected}
      className={cn(
        'rounded-pill px-md py-xs text-caption font-medium border transition-all',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
        selected
          ? 'bg-accent-soft border-accent text-accent'
          : 'bg-bg-elevated border-border text-text-muted hover:border-accent/50',
        disabled && 'opacity-50 cursor-not-allowed',
        className,
      )}
    >
      {label}
    </button>
  );
}

export default Chip;

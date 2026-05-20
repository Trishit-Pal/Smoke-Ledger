'use client';

import * as React from 'react';
import { Card } from '@web/components/ui/Card';
import { AnimatedNumber } from '@web/components/anim/AnimatedNumber';
import { cn } from '@web/components/ui/cn';

type Tone = 'default' | 'success' | 'warn' | 'danger';

export interface StatTileProps {
  label: string;
  value: string;
  animatedValue?: number;
  formatAnimated?: (n: number) => string;
  sublabel?: string;
  tone?: Tone;
  hidden?: boolean;
  className?: string;
}

const TONE_CLASS: Record<Tone, string> = {
  default: 'text-text',
  success: 'text-success',
  warn: 'text-warn',
  danger: 'text-danger',
};

export function StatTile({
  label,
  value,
  animatedValue,
  formatAnimated,
  sublabel,
  tone = 'default',
  hidden = false,
  className,
}: StatTileProps) {
  return (
    <Card className={cn('flex-1 flex flex-col', className)}>
      <span className="text-caption uppercase text-text-muted">{label}</span>
      <div className={cn('text-h1 font-bold mt-xs', TONE_CLASS[tone])}>
        {hidden ? (
          <span aria-label="hidden">••••</span>
        ) : animatedValue !== undefined ? (
          <AnimatedNumber value={animatedValue} format={formatAnimated} />
        ) : (
          value
        )}
      </div>
      {sublabel ? (
        <p className="text-small text-text-muted mt-xs">{sublabel}</p>
      ) : null}
    </Card>
  );
}

export default StatTile;

import * as React from 'react';
import { cn } from '@web/components/ui/cn';

type Tone = 'danger' | 'info';

export interface BannerProps {
  tone: Tone;
  children: React.ReactNode;
  className?: string;
}

const TONE_CLASSES: Record<Tone, string> = {
  danger: 'bg-danger/10 border-danger text-danger',
  info: 'bg-bg-elevated border-border text-text',
};

export function Banner({ tone, children, className }: BannerProps) {
  return (
    <div
      role={tone === 'danger' ? 'alert' : 'status'}
      className={cn(
        'rounded-md border px-md py-sm text-small',
        TONE_CLASSES[tone],
        className,
      )}
    >
      {children}
    </div>
  );
}

export default Banner;

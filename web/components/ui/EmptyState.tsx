'use client';

import * as React from 'react';
import { cn } from '@web/components/ui/cn';

export interface EmptyStateProps {
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

/** Editorial empty state: small-caps caption, an italic line, a text action —
 *  no icon badge, no card. */
export function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
  className,
}: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center text-center gap-sm py-xxl', className)}>
      <span className="editorial-caption">{title}</span>
      {description ? (
        <p className="max-w-[40ch] text-small italic text-text-muted">{description}</p>
      ) : null}
      {actionLabel && onAction ? (
        <button
          type="button"
          onClick={onAction}
          className="mt-sm min-h-11 px-lg text-small text-text underline underline-offset-4 decoration-1 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
        >
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}

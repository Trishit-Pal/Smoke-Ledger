'use client';

import * as React from 'react';
import { Inbox } from 'lucide-react';
import { Button } from '@web/components/ui/Button';
import { Text } from '@web/components/ui/Text';
import { cn } from '@web/components/ui/cn';

export interface EmptyStateProps {
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
  className,
}: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center text-center gap-md py-xxl', className)}>
      <div className="w-16 h-16 rounded-full bg-bg-elevated border border-border flex items-center justify-center mb-sm">
        <Inbox className="w-7 h-7 text-text-muted" aria-hidden />
      </div>
      <Text variant="h3">{title}</Text>
      {description ? (
        <Text variant="small" muted className="max-w-sm">
          {description}
        </Text>
      ) : null}
      {actionLabel && onAction ? (
        <Button title={actionLabel} variant="secondary" onPress={onAction} />
      ) : null}
    </div>
  );
}

export default EmptyState;

'use client';

import * as React from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Button } from '@web/components/ui/Button';
import { Text } from '@web/components/ui/Text';

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  loading = false,
  onConfirm,
  onOpenChange,
}: ConfirmDialogProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 z-50" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[min(92vw,24rem)] -translate-x-1/2 -translate-y-1/2 rounded-lg bg-card border border-border p-lg shadow-xl">
          <Dialog.Title asChild>
            <Text variant="h2">{title}</Text>
          </Dialog.Title>
          <Dialog.Description asChild>
            <Text variant="small" muted className="mt-sm">
              {description}
            </Text>
          </Dialog.Description>
          <div className="flex gap-md mt-lg">
            <Button
              title={cancelLabel}
              variant="secondary"
              className="flex-1"
              disabled={loading}
              onPress={() => onOpenChange(false)}
            />
            <Button
              title={confirmLabel}
              variant={destructive ? 'danger' : 'primary'}
              className="flex-1"
              loading={loading}
              onPress={onConfirm}
            />
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

import * as React from 'react';
import { cn } from '@web/components/ui/cn';

export interface DividerProps {
  inset?: number;
  className?: string;
}

export function Divider({ inset, className }: DividerProps) {
  return (
    <hr
      className={cn('border-0 border-t border-border', className)}
      style={inset && inset > 0 ? { marginLeft: `${inset}px` } : undefined}
    />
  );
}

export default Divider;

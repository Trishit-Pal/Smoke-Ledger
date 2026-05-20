import * as React from 'react';
import { cn } from '@web/components/ui/cn';

export interface CardProps {
  children: React.ReactNode;
  className?: string;
  padded?: boolean;
}

export function Card({ children, className, padded = true }: CardProps) {
  return (
    <div
      className={cn(
        'bg-card border border-border rounded-lg',
        padded && 'p-lg',
        className,
      )}
    >
      {children}
    </div>
  );
}

export default Card;

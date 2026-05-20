'use client';

import * as React from 'react';
import { cn } from '@web/components/ui/cn';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

export interface ButtonProps {
  title: string;
  onPress?: () => void;
  variant?: Variant;
  size?: Size;
  disabled?: boolean;
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
  className?: string;
  type?: 'button' | 'submit';
}

const VARIANT_CLASSES: Record<Variant, string> = {
  primary: 'bg-accent text-white hover:opacity-90',
  secondary: 'bg-accent-soft text-accent hover:opacity-90',
  ghost: 'border border-border bg-transparent hover:bg-card text-text',
  danger: 'bg-danger text-white hover:opacity-90',
};

const SIZE_CLASSES: Record<Size, string> = {
  sm: 'h-9 px-3 text-small',
  md: 'h-11 px-4 text-body-strong',
  lg: 'h-13 px-6 text-body-strong',
};

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  leftIcon,
  rightIcon,
  fullWidth = false,
  className,
  type = 'button',
}: ButtonProps) {
  const isDisabled = disabled || loading;
  return (
    <button
      type={type}
      onClick={onPress}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      className={cn(
        'inline-flex items-center justify-center gap-sm rounded-md font-semibold transition-opacity',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
        VARIANT_CLASSES[variant],
        SIZE_CLASSES[size],
        fullWidth && 'w-full',
        isDisabled && 'opacity-50 cursor-not-allowed',
        className,
      )}
    >
      {loading ? (
        <span
          aria-hidden
          className="animate-spin border-2 border-white/30 border-t-white rounded-full w-4 h-4"
        />
      ) : (
        leftIcon
      )}
      <span>{title}</span>
      {!loading && rightIcon}
    </button>
  );
}

export default Button;

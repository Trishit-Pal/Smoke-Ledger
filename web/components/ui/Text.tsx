import * as React from 'react';
import { cn } from '@web/components/ui/cn';

export type TextVariant =
  | 'display'
  | 'h1'
  | 'h2'
  | 'h3'
  | 'body'
  | 'bodyStrong'
  | 'small'
  | 'caption'
  | 'mono';

export interface TextProps extends Pick<
  React.HTMLAttributes<HTMLElement>,
  'id' | 'role' | 'aria-live' | 'aria-describedby'
> {
  variant?: TextVariant;
  muted?: boolean;
  faint?: boolean;
  color?: string;
  className?: string;
  children: React.ReactNode;
  numberOfLines?: number;
}

const VARIANT_MAP: Record<
  TextVariant,
  { tag: keyof JSX.IntrinsicElements; cls: string }
> = {
  display: { tag: 'h1', cls: 'text-display font-bold tracking-tight' },
  h1: { tag: 'h2', cls: 'text-h1 font-bold tracking-tight' },
  h2: { tag: 'h3', cls: 'text-h2 font-semibold' },
  h3: { tag: 'h4', cls: 'text-h3 font-semibold' },
  body: { tag: 'p', cls: 'text-body' },
  bodyStrong: { tag: 'p', cls: 'text-body-strong font-semibold' },
  small: { tag: 'p', cls: 'text-small' },
  caption: { tag: 'span', cls: 'text-caption font-medium tracking-wide' },
  mono: { tag: 'code', cls: 'text-mono font-medium font-mono' },
};

export function Text({
  variant = 'body',
  muted,
  faint,
  color,
  className,
  children,
  numberOfLines,
  id,
  role,
  'aria-live': ariaLive,
  'aria-describedby': ariaDescribedBy,
}: TextProps) {
  const { tag: Tag, cls } = VARIANT_MAP[variant];
  const style: React.CSSProperties = {};
  if (color) style.color = color;
  if (numberOfLines && numberOfLines > 0) {
    style.display = '-webkit-box';
    style.WebkitLineClamp = numberOfLines;
    style.WebkitBoxOrient = 'vertical';
    style.overflow = 'hidden';
  }

  return React.createElement(
    Tag,
    {
      className: cn(
        cls,
        muted && 'text-text-muted',
        faint && 'text-text-faint',
        variant === 'caption' && 'uppercase',
        className,
      ),
      style: Object.keys(style).length > 0 ? style : undefined,
      id,
      role,
      'aria-live': ariaLive,
      'aria-describedby': ariaDescribedBy,
    },
    children,
  );
}

export default Text;

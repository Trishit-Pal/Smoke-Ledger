'use client';

import * as React from 'react';
import { useReduceMotion } from '@web/hooks/useReduceMotion';

export interface StampProps {
  show: boolean;
  children: React.ReactNode;
  color?: string;
  rotate?: number;
  double?: boolean;
  style?: React.CSSProperties;
}

export function Stamp({
  show,
  children,
  color = 'var(--accent-ink)',
  rotate = -6,
  double = true,
  style,
}: StampProps) {
  const reduce = useReduceMotion();
  return (
    <span
      aria-hidden
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        border: `1.5px solid ${color}`,
        color,
        padding: '3px 8px',
        fontFamily: 'var(--font-display)',
        fontStyle: 'italic',
        fontSize: 10,
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.22em',
        borderRadius: 3,
        boxShadow: double
          ? `inset 0 0 0 3px var(--bg-elevated), inset 0 0 0 4px ${color}`
          : 'none',
        opacity: show ? 0.88 : 0,
        transform: show
          ? reduce
            ? 'none'
            : `scale(1) rotate(${rotate}deg)`
          : reduce
            ? 'none'
            : 'scale(1.8) rotate(-30deg)',
        transformOrigin: 'center',
        transition: reduce
          ? 'opacity 180ms'
          : show
            ? 'opacity 240ms ease-out, transform 320ms var(--ease-editorial)'
            : 'opacity 180ms, transform 180ms',
        whiteSpace: 'nowrap',
        ...style,
      }}
    >
      {children}
    </span>
  );
}

export default Stamp;

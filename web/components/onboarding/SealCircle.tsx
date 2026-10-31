'use client';

import * as React from 'react';
import { useReduceMotion } from '@web/hooks/useReduceMotion';

export interface SealCircleProps {
  size?: number;
  label?: string;
  show: boolean;
}

export function SealCircle({
  size = 110,
  label = 'SMOKE · LEDGER · 2026 · ',
  show,
}: SealCircleProps) {
  const reactId = React.useId();
  const pathId = `sealtext-${reactId.replace(/:/g, '')}`;
  const reduce = useReduceMotion();

  return (
    <div
      aria-hidden
      style={{
        position: 'relative',
        width: size,
        height: size,
        opacity: show ? 1 : 0,
        transform: show
          ? reduce
            ? 'none'
            : 'scale(1) rotate(-8deg)'
          : reduce
            ? 'none'
            : 'scale(1.6) rotate(40deg)',
        transformOrigin: 'center',
        transition: reduce
          ? 'opacity 200ms'
          : 'opacity 360ms ease-out, transform 520ms var(--ease-editorial)',
        transitionDelay: reduce ? '0ms' : '600ms',
      }}
    >
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size}>
        <defs>
          <path
            id={pathId}
            d={`M ${size / 2}, ${size / 2}
                m -${size * 0.36}, 0
                a ${size * 0.36}, ${size * 0.36} 0 1, 1 ${size * 0.72}, 0
                a ${size * 0.36}, ${size * 0.36} 0 1, 1 -${size * 0.72}, 0`}
          />
        </defs>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={size * 0.45}
          fill="none"
          stroke="var(--accent)"
          strokeWidth="1.5"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={size * 0.42}
          fill="none"
          stroke="var(--accent)"
          strokeWidth="0.75"
          strokeDasharray="2 3"
        />
        <text
          fill="var(--accent)"
          fontSize={size * 0.085}
          letterSpacing="2"
          fontWeight={600}
        >
          <textPath xlinkHref={`#${pathId}`} startOffset="0">
            {label}
            {label}
          </textPath>
        </text>
        <text
          x={size / 2}
          y={size / 2 + size * 0.06}
          textAnchor="middle"
          fontFamily="var(--font-display)"
          fontStyle="italic"
          fontWeight={500}
          fontSize={size * 0.32}
          fill="var(--accent)"
        >
          SL
        </text>
      </svg>
    </div>
  );
}

export default SealCircle;

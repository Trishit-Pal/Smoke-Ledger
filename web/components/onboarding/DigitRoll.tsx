'use client';

import * as React from 'react';
import { useReduceMotion } from '@web/hooks/useReduceMotion';

export interface DigitRollProps {
  value: number | string;
  delay?: number;
  className?: string;
  style?: React.CSSProperties;
}

export function DigitRoll({ value, delay = 0, className, style }: DigitRollProps) {
  const chars = String(value).split('');
  return (
    <span
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'baseline',
        verticalAlign: 'baseline',
        ...style,
      }}
    >
      {chars.map((c, i) =>
        /\d/.test(c) ? (
          <RollDigit key={`${i}-${c}`} digit={Number(c)} index={i} delay={delay} />
        ) : (
          <span
            key={`${i}-${c}`}
            aria-hidden
            style={{ display: 'inline-block', lineHeight: 0.9 }}
          >
            {c}
          </span>
        ),
      )}
    </span>
  );
}

interface RollDigitProps {
  digit: number;
  index: number;
  delay: number;
}

function RollDigit({ digit, index, delay }: RollDigitProps) {
  const reduce = useReduceMotion();
  return (
    <span
      aria-hidden
      style={{
        display: 'inline-block',
        height: '0.9em',
        overflow: 'hidden',
        lineHeight: 0.9,
        verticalAlign: 'baseline',
      }}
    >
      <span
        style={{
          display: 'block',
          transform: `translateY(-${digit * 0.9}em)`,
          transition: reduce
            ? 'none'
            : `transform 720ms cubic-bezier(0.16, 1, 0.3, 1)`,
          transitionDelay: reduce ? '0ms' : `${delay + index * 35}ms`,
          willChange: 'transform',
        }}
      >
        {Array.from({ length: 10 }, (_, n) => (
          <span key={n} style={{ display: 'block', height: '0.9em', lineHeight: 0.9 }}>
            {n}
          </span>
        ))}
      </span>
    </span>
  );
}

export default DigitRoll;

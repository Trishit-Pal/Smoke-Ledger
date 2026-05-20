'use client';

import * as React from 'react';
import { useReduceMotion } from '@web/hooks/useReduceMotion';

export interface AnimatedNumberProps {
  value: number;
  format?: (n: number) => string;
  duration?: number;
  className?: string;
}

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

export function AnimatedNumber({
  value,
  format,
  duration = 600,
  className,
}: AnimatedNumberProps) {
  const reduced = useReduceMotion();
  const [display, setDisplay] = React.useState<number>(value);
  const previousRef = React.useRef<number>(value);
  const rafRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    if (reduced || duration <= 0) {
      previousRef.current = value;
      setDisplay(value);
      return;
    }

    const from = previousRef.current;
    const to = value;
    if (from === to) return;

    const start = performance.now();
    const tick = (now: number) => {
      const elapsed = now - start;
      const t = Math.min(1, elapsed / duration);
      const eased = easeOutCubic(t);
      const current = from + (to - from) * eased;
      setDisplay(current);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        previousRef.current = to;
        rafRef.current = null;
      }
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [value, duration, reduced]);

  const text = format ? format(display) : String(Math.round(display));
  return <span className={className}>{text}</span>;
}

export default AnimatedNumber;

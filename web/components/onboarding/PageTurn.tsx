'use client';

import * as React from 'react';
import { useReduceMotion } from './useReduceMotion';

export interface PageTurnProps {
  stepKey: string;
  direction?: 1 | -1;
  children: React.ReactNode;
}

type Phase = 'in' | 'out' | 'enter';

export function PageTurn({ stepKey, direction = 1, children }: PageTurnProps) {
  const [active, setActive] = React.useState(stepKey);
  const [phase, setPhase] = React.useState<Phase>('in');
  const reduce = useReduceMotion();

  React.useEffect(() => {
    if (stepKey === active) return;
    setPhase('out');
    const t = setTimeout(
      () => {
        setActive(stepKey);
        setPhase('enter');
        requestAnimationFrame(() => setPhase('in'));
      },
      reduce ? 0 : 240,
    );
    return () => clearTimeout(t);
  }, [stepKey, active, reduce]);

  const out = phase === 'out';
  const enter = phase === 'enter';

  return (
    <div style={{ perspective: 1400, transformStyle: 'preserve-3d', minHeight: 0 }}>
      <div
        key={active}
        style={{
          opacity: out ? 0 : enter ? 0 : 1,
          transform: out
            ? `rotateX(-6deg) translateY(${-12 * direction}px)`
            : enter
              ? `rotateX(6deg) translateY(${12 * direction}px)`
              : 'rotateX(0deg) translateY(0)',
          transformOrigin: 'top center',
          transition: reduce
            ? 'none'
            : 'opacity 320ms cubic-bezier(0.16, 1, 0.3, 1), transform 360ms cubic-bezier(0.16, 1, 0.3, 1)',
          willChange: 'opacity, transform',
        }}
      >
        {children}
      </div>
    </div>
  );
}

export default PageTurn;

import * as React from 'react';

export interface PaperEdgeProps {
  side: 'top' | 'bottom';
  color?: string;
}

const TEETH = 28;

function buildPath(side: 'top' | 'bottom'): string {
  const segments = Array.from(
    { length: TEETH },
    (_, i) => `L${(i + 0.5) * (100 / TEETH)},${(i % 2) * 8 + 4}`,
  ).join(' ');
  return side === 'top'
    ? `M0,12 ${segments} L100,12 L100,0 L0,0 Z`
    : `M0,0 ${segments} L100,0 L100,12 L0,12 Z`;
}

export function PaperEdge({ side, color = 'var(--bg)' }: PaperEdgeProps) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 100 12"
      preserveAspectRatio="none"
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        [side]: -1,
        height: 10,
        width: '100%',
        display: 'block',
        pointerEvents: 'none',
      }}
    >
      <path d={buildPath(side)} fill={color} />
    </svg>
  );
}

export default PaperEdge;

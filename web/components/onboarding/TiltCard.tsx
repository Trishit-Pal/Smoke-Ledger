'use client';

import * as React from 'react';
import { useReduceMotion } from '@web/hooks/useReduceMotion';

export interface TiltCardProps {
  children: React.ReactNode;
  max?: number;
  lift?: number;
  glare?: boolean;
  onClick?: () => void;
  ariaLabel?: string;
  className?: string;
  style?: React.CSSProperties;
}

interface TiltState {
  x: number;
  y: number;
  hover: boolean;
  px: number;
  py: number;
}

const REST: TiltState = { x: 0, y: 0, hover: false, px: 0.5, py: 0.5 };

export function TiltCard({
  children,
  max = 6,
  lift = 10,
  glare = false,
  onClick,
  ariaLabel,
  className,
  style,
}: TiltCardProps) {
  const ref = React.useRef<HTMLDivElement | null>(null);
  const [tilt, setTilt] = React.useState<TiltState>(REST);
  const reduce = useReduceMotion();

  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (reduce || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;
    setTilt({ x: -(py - 0.5) * max, y: (px - 0.5) * max, hover: true, px, py });
  };
  const onLeave = () => setTilt((s) => ({ ...s, x: 0, y: 0, hover: false }));

  const handleKey = onClick
    ? (e: React.KeyboardEvent<HTMLDivElement>) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }
    : undefined;

  return (
    <div
      ref={ref}
      role={onClick ? 'button' : undefined}
      aria-label={ariaLabel}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={handleKey}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      className={className}
      style={{
        transformStyle: 'preserve-3d',
        transform: reduce
          ? 'none'
          : `perspective(900px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg) translateZ(${
              tilt.hover ? lift : 0
            }px)`,
        transition: reduce
          ? 'none'
          : tilt.hover
            ? 'transform 90ms ease-out, box-shadow 200ms ease-out'
            : 'transform 480ms cubic-bezier(0.16, 1, 0.3, 1), box-shadow 280ms ease-out',
        boxShadow: tilt.hover
          ? `0 ${20 + lift}px ${30 + lift * 2}px -10px rgba(11, 15, 20, 0.18), 0 4px 12px rgba(11, 15, 20, 0.06)`
          : '0 1px 0 rgba(11, 15, 20, 0.02)',
        cursor: onClick ? 'pointer' : undefined,
        position: 'relative',
        ...style,
      }}
    >
      {children}
      {glare && tilt.hover && !reduce ? (
        <div
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            borderRadius: 'inherit',
            background: `radial-gradient(circle at ${tilt.px * 100}% ${tilt.py * 100}%, rgba(255,255,255,0.18), transparent 50%)`,
            mixBlendMode: 'overlay',
            transition: 'opacity 200ms',
          }}
        />
      ) : null}
    </div>
  );
}

export default TiltCard;

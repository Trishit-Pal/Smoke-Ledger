'use client';

/*
 * ConfettiBurst — one-shot paper-fleck confetti.
 *
 * Renders a fixed number of hairline rectangles in ink / teal / terracotta
 * (the editorial palette — never balloons or starbursts). Each fleck has a
 * randomised end position, rotation, and small initial delay so the burst
 * feels organic without re-running on every render.
 *
 * Memoised on `seed` (or mount) so the random distribution is stable for the
 * life of the burst. Pass a new `seed` value (e.g. Date.now()) to re-randomise
 * for a fresh burst.
 */

import * as React from 'react';

export interface ConfettiBurstProps {
  active: boolean;
  /** Number of flecks. Default 18. Keep small for editorial restraint. */
  count?: number;
  /** Re-randomise distribution when this value changes. */
  seed?: number;
  className?: string;
}

interface Fleck {
  x: number;
  rot: number;
  d: number;
  dx: number;
  dy: number;
  rotEnd: number;
  color: string;
  w: number;
  h: number;
}

const PALETTE = ['var(--accent)', 'var(--text)', 'var(--warn-earth)'];

function buildFlecks(count: number, _seed: number): Fleck[] {
  // Note: Math.random() is fine here — the seed param just forces React to
  // recompute via useMemo deps. We don't need a deterministic RNG; we just
  // need the distribution to be stable for the burst's lifetime.
  return Array.from({ length: count }, (_, i) => ({
    x: 50 + (Math.random() - 0.5) * 30,
    rot: Math.random() * 360,
    d: Math.random() * 0.3,
    dx: (Math.random() - 0.5) * 220,
    dy: 140 + Math.random() * 120,
    rotEnd: 360 + Math.random() * 360,
    color: PALETTE[i % PALETTE.length],
    w: 2,
    h: 6 + Math.random() * 4,
  }));
}

export function ConfettiBurst({ active, count = 18, seed = 0, className }: ConfettiBurstProps) {
  const flecks = React.useMemo(() => buildFlecks(count, seed), [count, seed]);
  if (!active) return null;
  return (
    <div
      aria-hidden
      className={className}
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        overflow: 'visible',
      }}
    >
      {flecks.map((f, i) => (
        <span
          key={i}
          style={
            {
              position: 'absolute',
              left: `${f.x}%`,
              top: '0%',
              width: f.w,
              height: f.h,
              background: f.color,
              transformOrigin: 'center',
              animation: `character-confetti-burst 1400ms cubic-bezier(.2,.6,.3,1) ${f.d}s forwards`,
              ['--cb-dx' as string]: `${f.dx}px`,
              ['--cb-dy' as string]: `${f.dy}px`,
              ['--cb-rot-e' as string]: `${f.rotEnd}deg`,
              ['--cb-rot-s' as string]: `${f.rot}deg`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}

export default ConfettiBurst;

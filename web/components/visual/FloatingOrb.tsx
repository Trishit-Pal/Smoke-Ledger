'use client';

/*
 * FloatingOrb — a single restrained, token-based ambient glow. Not decoration
 * for its own sake: used once, behind the dashboard's headline numeral, as a
 * soft ink wash rather than a SaaS-style animated gradient ball. Bakes
 * opacity into the color-mix rather than a separate opacity value, and skips
 * any white core / box-shadow / 3D-translate treatment.
 */

import * as React from 'react';

export interface FloatingOrbProps {
  className?: string;
  size?: number;
}

export function FloatingOrb({ className = '', size = 200 }: FloatingOrbProps) {
  return (
    <div
      aria-hidden
      className={`pointer-events-none animate-float-slow rounded-full ${className}`}
      style={{
        width: size,
        height: size,
        background:
          'radial-gradient(circle at 50% 50%, color-mix(in srgb, var(--accent) 16%, transparent), transparent 70%)',
      }}
    />
  );
}

export default FloatingOrb;

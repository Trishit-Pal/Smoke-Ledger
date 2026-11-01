/**
 * Halo radius for a ProgressRing. The glow shipped fixed at 8px, which on a
 * 64px ring is 1/8 of the size but on a 40px phone ring reads as a 20% badge
 * glow (the gamified anti-reference in PRODUCT.md). Scale it with the ring, and
 * let a caller switch it off under a size where any glow reads as decoration.
 */
export function ringGlow(size: number, opts: { quietBelow?: number } = {}): number {
  if (opts.quietBelow !== undefined && size < opts.quietBelow) return 0;
  return Math.round(size / 8);
}

/**
 * Halo radius for a ProgressRing. The glow shipped fixed at 8px, which on a
 * 64px ring is 1/8 of the size but on a 40px phone ring reads as a 20% badge
 * glow (the gamified anti-reference in PRODUCT.md). Scale it with the ring, and
 * let the caller switch it off where any glow reads as decoration; the caller
 * decides because the rendered size may come from CSS, not from `size`.
 */
export function ringGlow(size: number, opts: { quiet?: boolean } = {}): number {
  if (opts.quiet) return 0;
  return Math.round(size / 8);
}

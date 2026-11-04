/**
 * Dimensions of the no-smoking sign, in sign-local units (ring centred at the
 * origin, lying in the XY plane). Dimensions only: colour comes from CSS
 * custom properties at the call site.
 */

export interface SignParts {
  /** Torus: `radius` is centre-line radius, `tube` the tube radius. */
  ring: { radius: number; tube: number };
  /**
   * Bar lies along +X before rotation; rotate it by `angleRad` about Z.
   * Negate the angle for the usual top-left to bottom-right slash.
   */
  bar: { length: number; thickness: number; angleRad: number };
}

const RING_RADIUS = 1;
const RING_TUBE = 0.11;

export function signParts(): SignParts {
  return {
    ring: { radius: RING_RADIUS, tube: RING_TUBE },
    // Spans the full ring so its ends tuck into the tube.
    bar: { length: 2 * RING_RADIUS, thickness: 0.15, angleRad: Math.PI / 4 },
  };
}

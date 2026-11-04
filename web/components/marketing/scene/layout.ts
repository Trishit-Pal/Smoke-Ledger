/** Viewports narrower than this aspect ratio (portrait phones) get the centred, dimmer layout. */
export const NARROW_ASPECT = 1;

type Vec3 = readonly [number, number, number];

export interface Layout {
  lungs: Vec3;
  lungScale: number;
  sign: Vec3;
  signScale: number;
  /** Camera look-at x. */
  lookX: number;
  /** Opacity multiplier. */
  dim: number;
}

// Desktop sits right and back so centred content stays clear; narrow viewports centre it, dimmer.
export const LAYOUT: Record<'wide' | 'narrow', Layout> = {
  wide: { lungs: [19, -0.5, -4], lungScale: 4.1, sign: [-13, 7.5, -10], signScale: 2, lookX: 4, dim: 1 },
  narrow: { lungs: [0, -1, -6], lungScale: 4.2, sign: [-3.4, 8.2, -10], signScale: 1.5, lookX: 0, dim: 0.65 },
};

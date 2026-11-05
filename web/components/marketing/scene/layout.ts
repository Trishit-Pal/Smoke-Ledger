import { LOBE_HALF_AXES, LUNG_PLACEMENT } from './lungs';

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

/** The scene camera: it sits on the z axis looking at the lungs' depth. */
export const CAMERA = { fov: 50, z: 22 } as const;
/** Vertical safety margin (% of viewport) for the camera orbit, the breath and the sway. */
const LUNG_TOP_MARGIN_PCT = 6;

/**
 * Where the top of the desktop lungs lands on screen, as a percentage from the
 * viewport top (0 = top). Derived from the same placement the scene uses: the
 * lobes rise to centreY + half-height in lung-pair space, scaled and offset by
 * LAYOUT.wide, seen from CAMERA at the lungs' depth.
 */
export function lungTopPercent(): number {
  const { lungs, lungScale } = LAYOUT.wide;
  const topY = lungs[1] + lungScale * (LUNG_PLACEMENT.centreY + LOBE_HALF_AXES.y);
  const halfViewHeight = (CAMERA.z - lungs[2]) * Math.tan((CAMERA.fov / 2) * (Math.PI / 180));
  return 50 - (topY / halfViewHeight) * 50;
}

/**
 * The milestone note: fixed in the right gutter, ABOVE the desktop lungs, so it
 * never sits over the glass nor near the bottom-right Ask dock. Its bottom edge
 * is pinned a margin above the lung top and the text grows upward. `.page-column`
 * caps at 60rem inside the main area (viewport minus the 15rem sidebar), leaving
 * (100vw - 75rem) / 2 a side: 168px at 1536. The width is that gutter less a
 * margin (max 14rem), so it never reaches the column; below 1536 it is not shown.
 */
export const OVERLAY_ANCHOR = {
  bottom: `${(100 - (lungTopPercent() - LUNG_TOP_MARGIN_PCT)).toFixed(1)}%`,
  right: '1.5rem',
  width: 'min(14rem, calc((100vw - 75rem) / 2 - 2rem))',
} as const;

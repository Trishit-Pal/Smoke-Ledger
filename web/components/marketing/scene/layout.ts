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
  return lungEdgePercent(LOBE_HALF_AXES.y);
}

/** The lungs' lower edge, the same way: % from the viewport top. */
export function lungBottomPercent(): number {
  return lungEdgePercent(-LOBE_HALF_AXES.y);
}

function lungEdgePercent(halfHeightOffset: number): number {
  const { lungs, lungScale } = LAYOUT.wide;
  const edgeY = lungs[1] + lungScale * (LUNG_PLACEMENT.centreY + halfHeightOffset);
  const halfViewHeight = (CAMERA.z - lungs[2]) * Math.tan((CAMERA.fov / 2) * (Math.PI / 180));
  return 50 - (edgeY / halfViewHeight) * 50;
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

/**
 * The jar of money kept: in the same right gutter, BELOW the lungs, above the
 * bottom-right Ask dock, shown only where the note is (>= 1536px) and tall enough
 * to hold the jar, its label and the dock (JAR_MIN_HEIGHT_PX). The jar is geometry
 * pinned to the camera; the label is DOM, centred under it in the note's column.
 */
export const JAR_MIN_WIDTH_PX = 1536;
export const JAR_HEIGHT_PX = 64;
const JAR_RIGHT_PX = 24; // OVERLAY_ANCHOR.right: 1.5rem
const JAR_LABEL_MAX_PX = 224; // 14rem, as OVERLAY_ANCHOR.width
const JAR_LABEL_GAP_PX = 8;
const JAR_LABEL_LINE_PX = 20;
/** The dock: 1.5rem off the bottom and about 3.5rem tall, plus 1rem of air. */
const DOCK_CLEAR_PX = 96;
/** Air under the lungs for the orbit, the breath and the sway (the scene projects a little higher). */
const LUNG_BOTTOM_MARGIN_PCT = 3;
const JAR_TOP_PCT = lungBottomPercent() + LUNG_BOTTOM_MARGIN_PCT;

/** Shortest viewport whose band under the lungs holds jar + label + dock; a multiple of 10. */
export const JAR_MIN_HEIGHT_PX =
  Math.ceil((JAR_HEIGHT_PX + JAR_LABEL_GAP_PX + JAR_LABEL_LINE_PX + DOCK_CLEAR_PX) / (1 - JAR_TOP_PCT / 100) / 10) * 10;

export const JAR_ANCHOR = {
  top: `${JAR_TOP_PCT.toFixed(1)}%`,
  labelTop: `calc(${JAR_TOP_PCT.toFixed(1)}% + ${JAR_HEIGHT_PX + JAR_LABEL_GAP_PX}px)`,
  right: OVERLAY_ANCHOR.right,
  width: OVERLAY_ANCHOR.width,
} as const;

export interface JarPlacement {
  /** Horizontal centre of the jar and its label, px from the viewport left. */
  centreXPx: number;
  /** Top of the jar, px from the viewport top. */
  topPx: number;
  heightPx: number;
}

/** Where the jar goes for a viewport, or null where there is no room for it. */
export function jarPlacement(viewportWidth: number, viewportHeight: number): JarPlacement | null {
  if (viewportWidth < JAR_MIN_WIDTH_PX || viewportHeight < JAR_MIN_HEIGHT_PX) return null;
  const labelWidth = Math.min(JAR_LABEL_MAX_PX, (viewportWidth - 1200) / 2 - 32); // 75rem, 2rem: see OVERLAY_ANCHOR
  return {
    centreXPx: viewportWidth - JAR_RIGHT_PX - labelWidth / 2,
    topPx: (JAR_TOP_PCT / 100) * viewportHeight,
    heightPx: JAR_HEIGHT_PX,
  };
}

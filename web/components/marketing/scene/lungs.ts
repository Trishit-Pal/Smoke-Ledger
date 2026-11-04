/**
 * Pure lung geometry helpers (no three.js).
 *
 * Lobe local space: y up, origin at the lobe centre. +x points MEDIALLY (towards
 * the midline/heart) for both sides; the caller mirrors the right lobe by
 * placement. The lobe is an ellipsoid with half-axes LOBE_HALF_AXES, displaced
 * radially by lobeRadiusAt. The left lobe carries a cardiac notch: a smooth
 * dent on its medial, lower face.
 *
 * Surface parameters: u in [0,1] is the azimuth about the y axis (0 = +x,
 * 0.25 = +z); v in [0,1] is the polar angle (0 = top +y, 1 = bottom -y).
 * Direction = (sin(pi v) cos(2 pi u), cos(pi v), sin(pi v) sin(2 pi u)).
 * The surface point is dir * lobeRadiusAt(...) scaled componentwise by the
 * half-axes, so lobeRadiusAt is a multiplier on the unit ellipsoid (1 = plain).
 */

export type LobeSide = 'left' | 'right';
export type Vec3 = [number, number, number];

/** Half-extents of the undisplaced lobe ellipsoid (a tall, narrow lobe). */
export const LOBE_HALF_AXES = { x: 0.5, y: 0.9, z: 0.4 } as const;

/** Cardiac notch on the left lobe: centre in (u, v), radial depth and angular width (rad). */
export const CARDIAC_NOTCH = { u: 0, v: 0.74, depth: 0.55, sigma: 0.5 } as const;

/** Unit direction for surface parameters (u, v); see the file header. */
export function lobeDirection(u: number, v: number): Vec3 {
  const theta = 2 * Math.PI * u;
  const phi = Math.PI * v;
  return [Math.sin(phi) * Math.cos(theta), Math.cos(phi), Math.sin(phi) * Math.sin(theta)];
}

const NOTCH_DIR = lobeDirection(CARDIAC_NOTCH.u, CARDIAC_NOTCH.v);

function dot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

const smoothstep = (a: number, b: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/**
 * Anatomy shared by both lobes: a narrower apex, a flattened medial face, a
 * dished (concave) base and a faint oblique fissure groove on the lateral side.
 */
function lobeShape(dir: Vec3): number {
  const [x, y] = dir;
  const apex = 1 - 0.16 * smoothstep(0.55, 1, y);
  const medialFlat = 1 - 0.16 * Math.max(0, x) ** 3;
  const baseDish = 1 - 0.22 * Math.max(0, -y) ** 8;
  const fissureOffset = 0.9 * y + 0.35 * x - 0.1;
  const fissure = x < 0 ? 1 - 0.05 * Math.exp(-((fissureOffset / 0.07) ** 2)) : 1;
  return apex * medialFlat * baseDish * fissure;
}

/**
 * Radial multiplier of the unit ellipsoid along the UNIT direction `dir`
 * (the normalised position, NOT the uv: three's SphereGeometry puts its uv
 * origin on the -x face, so callers must displace by direction).
 */
export function lobeRadiusAlong(side: LobeSide, dir: Vec3): number {
  const shape = lobeShape(dir);
  if (side === 'right') return shape;
  const angle = Math.acos(Math.min(1, Math.max(-1, dot(dir, NOTCH_DIR))));
  return shape * (1 - CARDIAC_NOTCH.depth * Math.exp(-(angle * angle) / (2 * CARDIAC_NOTCH.sigma ** 2)));
}

/** Displaced surface radius (multiplier of the unit ellipsoid) at surface parameters (u, v). */
export function lobeRadiusAt(side: LobeSide, u: number, v: number): number {
  return lobeRadiusAlong(side, lobeDirection(u, v));
}

/** True when the local-space point lies inside the lobe's displaced volume. */
export function insideLobe(side: LobeSide, x: number, y: number, z: number): boolean {
  const px = x / LOBE_HALF_AXES.x;
  const py = y / LOBE_HALF_AXES.y;
  const pz = z / LOBE_HALF_AXES.z;
  const r = Math.hypot(px, py, pz);
  if (r === 0) return true;
  return r <= lobeRadiusAlong(side, [px / r, py / r, pz / r]);
}

/**
 * Lung-pair space (where bronchialTree lives) to lobe-local space. The left
 * lobe sits at +offsetX and is mirrored so its local +x (medial) faces the
 * midline; the right lobe sits at -offsetX unmirrored.
 */
export const LUNG_PLACEMENT = { offsetX: 0.56, centreY: -0.12 } as const;

export function pairToLobe(side: LobeSide, p: Vec3): Vec3 {
  const x = side === 'left' ? LUNG_PLACEMENT.offsetX - p[0] : p[0] + LUNG_PLACEMENT.offsetX;
  return [x, p[1] - LUNG_PLACEMENT.centreY, p[2]];
}

export function lobeToPair(side: LobeSide, p: Vec3): Vec3 {
  const x = side === 'left' ? LUNG_PLACEMENT.offsetX - p[0] : p[0] - LUNG_PLACEMENT.offsetX;
  return [x, p[1] + LUNG_PLACEMENT.centreY, p[2]];
}

export interface Branch {
  /** Polyline from the proximal to the distal end, in lung-pair space (y up, x lateral). */
  points: Vec3[];
  radius: number;
  /** 0 = trachea, 1 = main bronchi, ... depth = terminal branches. */
  level: number;
}

const TRACHEA_RADIUS = 0.07;
const TRACHEA_LENGTH = 0.5;
const TRACHEA_TOP_Y = 0.85;
const RADIUS_TAPER = 0.72;
const LENGTH_TAPER = 0.74;
const MAIN_BRONCHUS_SPLAY = 0.62; // rad from straight down, outwards
const CHILD_SPLAY = 0.5; // rad either side of the parent direction
const CHILD_DEPTH_TILT = 0.18; // alternating z lean so the tree is not flat

function rotateXY(dir: Vec3, angle: number): Vec3 {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return [dir[0] * c - dir[1] * s, dir[0] * s + dir[1] * c, dir[2]];
}

function normalise(v: Vec3): Vec3 {
  const n = Math.hypot(v[0], v[1], v[2]);
  return [v[0] / n, v[1] / n, v[2] / n];
}

/**
 * Deterministic bronchial tree: a trachea, then a binary tree of `depth`
 * levels down each side (1 + 2 * (2^depth - 1) branches), listed trachea
 * first then level by level. Radius shrinks strictly with level.
 */
export function bronchialTree(depth: number): Branch[] {
  const bottom: Vec3 = [0, TRACHEA_TOP_Y - TRACHEA_LENGTH, 0];
  const branches: Branch[] = [
    { points: [[0, TRACHEA_TOP_Y, 0], bottom], radius: TRACHEA_RADIUS, level: 0 },
  ];

  interface Tip {
    from: Vec3;
    dir: Vec3;
  }
  let tips: Tip[] = [
    { from: bottom, dir: rotateXY([0, -1, 0], MAIN_BRONCHUS_SPLAY) },
    { from: bottom, dir: rotateXY([0, -1, 0], -MAIN_BRONCHUS_SPLAY) },
  ];

  for (let level = 1; level <= depth; level++) {
    const radius = TRACHEA_RADIUS * RADIUS_TAPER ** level;
    const length = TRACHEA_LENGTH * LENGTH_TAPER ** level;
    const next: Tip[] = [];
    tips.forEach((tip, i) => {
      const end: Vec3 = [
        tip.from[0] + tip.dir[0] * length,
        tip.from[1] + tip.dir[1] * length,
        tip.from[2] + tip.dir[2] * length,
      ];
      branches.push({ points: [tip.from, end], radius, level });
      const lean = (i % 2 === 0 ? 1 : -1) * CHILD_DEPTH_TILT;
      for (const splay of [CHILD_SPLAY, -CHILD_SPLAY]) {
        const d = rotateXY(tip.dir, splay);
        next.push({ from: end, dir: normalise([d[0], d[1], d[2] + (splay > 0 ? lean : -lean)]) });
      }
    });
    tips = next;
  }
  return branches;
}

/** How far inside the glass an airway must end (1 = exactly on the surface). */
const AIRWAY_FIT_MARGIN = 0.92;

/**
 * Keep only the airways that stay inside the glass: the trachea always, then
 * any branch whose end sits inside its lobe (shrunk by AIRWAY_FIT_MARGIN) and
 * whose parent was kept. Branches are skipped rather than bent so the shape
 * stays deterministic. Returns a new array; the input is never mutated.
 */
export function fitAirways(tree: Branch[]): Branch[] {
  const droppedStarts = new Set<Vec3>();
  return tree.filter((b, i) => {
    if (i === 0) return true;
    const start = b.points[0];
    const end = b.points[b.points.length - 1];
    const side: LobeSide = end[0] >= 0 ? 'left' : 'right';
    const [x, y, z] = pairToLobe(side, end);
    const fits = insideLobe(side, x / AIRWAY_FIT_MARGIN, y / AIRWAY_FIT_MARGIN, z / AIRWAY_FIT_MARGIN);
    if (!fits || droppedStarts.has(start)) {
      droppedStarts.add(end);
      return false;
    }
    return true;
  });
}

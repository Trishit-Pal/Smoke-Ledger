import type * as THREE_NS from 'three';

import { exhaleWeight } from './breath';
import type { DisposeBin } from './disposables';
import { LOBE_HALF_AXES, LUNG_PLACEMENT, insideLobe, type LobeSide, type Vec3 } from './lungs';
import type { SceneTokens, ThreeNs } from './tokens';

export interface Haze {
  points: THREE_NS.Points;
  /**
   * Advance by `dtSeconds` at breath time `tSeconds`; `density` (0..1, from
   * hazeDensity) scales how much of the haze is still visible.
   */
  update(dtSeconds: number, tSeconds: number, density: number): void;
  retheme(tokens: SceneTokens, dim: number): void;
}

const SPRITE_SIZE = 64;
const POINT_SIZE = 0.75; // world units
const BASE_ALPHA = 0.55;
const PROGRESS_PER_EXHALE_SECOND = 0.16; // mean; each particle varies around it
// Discreet has no breath, so no stop-start: a constant push at about half the exhale's mean weight.
const DISCREET_PUSH = 0.5;
// Light theme: how far the haze tint moves from the dark ink towards the page colour (mist, not soot).
const LIGHT_MIST_MIX = 0.55;

// Path out of the chest, in lung-pair space: seed -> carina -> trachea top -> out.
const CARINA: Vec3 = [0, 0.35, 0];
const TRACHEA_TOP: Vec3 = [0, 0.85, 0];
const OUT: Vec3 = [0, 1.55, 0.1];
const CARINA_AT = 0.55;
const TOP_AT = 0.8;
// Discreet mode has no chest: a plain slow rise through a loose cloud.
const CLOUD_HALF = { x: 1.5, y: 0.9, z: 0.5 } as const;
const CLOUD_RISE = 1.3;

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/**
 * Rejection-sample a point inside a random lobe and write it, in lung-pair
 * space, to out[at..at+2]. Allocation-free: respawns happen all through the loop.
 */
function seedInLobes(out: Float32Array, at: number): void {
  const left = Math.random() < 0.5;
  const side: LobeSide = left ? 'left' : 'right';
  let x = 0;
  let y = 0;
  let z = 0;
  for (let tries = 0; tries < 40; tries++) {
    const cx = (Math.random() * 2 - 1) * LOBE_HALF_AXES.x;
    const cy = (Math.random() * 2 - 1) * LOBE_HALF_AXES.y;
    const cz = (Math.random() * 2 - 1) * LOBE_HALF_AXES.z;
    if (insideLobe(side, cx, cy, cz)) {
      x = cx;
      y = cy;
      z = cz;
      break;
    }
  }
  // Lobe-local to pair space (the inverse of pairToLobe, inlined to skip its array).
  out[at] = left ? LUNG_PLACEMENT.offsetX - x : x - LUNG_PLACEMENT.offsetX;
  out[at + 1] = y + LUNG_PLACEMENT.centreY;
  out[at + 2] = z;
}

function seedInCloud(out: Float32Array, at: number): void {
  out[at] = (Math.random() * 2 - 1) * CLOUD_HALF.x;
  out[at + 1] = (Math.random() * 2 - 1) * CLOUD_HALF.y;
  out[at + 2] = (Math.random() * 2 - 1) * CLOUD_HALF.z;
}

/** Soft round alpha falloff; white so the material colour tints it. */
function buildSprite(THREE: ThreeNs, bin: DisposeBin): THREE_NS.DataTexture {
  const data = new Uint8Array(SPRITE_SIZE * SPRITE_SIZE * 4);
  const mid = (SPRITE_SIZE - 1) / 2;
  for (let y = 0; y < SPRITE_SIZE; y++) {
    for (let x = 0; x < SPRITE_SIZE; x++) {
      const d = Math.hypot(x - mid, y - mid) / mid;
      const a = Math.max(0, 1 - d) ** 1.6;
      data.set([255, 255, 255, Math.round(a * 255)], (y * SPRITE_SIZE + x) * 4);
    }
  }
  const tex = bin.track(new THREE.DataTexture(data, SPRITE_SIZE, SPRITE_SIZE));
  tex.needsUpdate = true;
  return tex;
}

/**
 * Grey smoke that lives in the lobes and, on each exhale, drifts up the
 * airways and out, fading as it goes. `discreet` swaps the chest for a neutral
 * cloud with the same slow rise.
 */
export function buildHaze(
  THREE: ThreeNs,
  bin: DisposeBin,
  count: number,
  discreet: boolean,
  tokens: SceneTokens,
): Haze {
  const seed = discreet ? seedInCloud : seedInLobes;
  const seeds = new Float32Array(count * 3);
  const progress = new Float32Array(count);
  const rate = new Float32Array(count);
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 4); // RGBA: alpha carries the fade

  const respawn = (i: number, startProgress: number) => {
    seed(seeds, i * 3);
    progress[i] = startProgress;
    rate[i] = PROGRESS_PER_EXHALE_SECOND * (0.6 + Math.random() * 0.8);
  };
  for (let i = 0; i < count; i++) respawn(i, Math.random() * 0.9);

  const geo = bin.track(new THREE.BufferGeometry());
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 4));

  const mat = bin.track(
    new THREE.PointsMaterial({
      size: POINT_SIZE,
      map: buildSprite(THREE, bin),
      vertexColors: true,
      transparent: true,
      depthWrite: false,
    }),
  );
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false; // positions move every frame; the bounds never get recomputed

  let tint = tokens.ink.clone();
  let opacity = 1;

  /** Write the point `k` of the way from (ax, ay, az) to `to` into positions[at..]. */
  const writeLerp = (at: number, ax: number, ay: number, az: number, to: Vec3, k: number): void => {
    positions[at] = lerp(ax, to[0], k);
    positions[at + 1] = lerp(ay, to[1], k);
    positions[at + 2] = lerp(az, to[2], k);
  };

  // No per-frame arrays or objects: everything is written straight into `positions`.
  const place = (i: number, s: number): void => {
    const at = i * 3;
    const sx = seeds[at];
    const sy = seeds[at + 1];
    const sz = seeds[at + 2];
    if (discreet) {
      positions[at] = sx + Math.sin(s * 6 + sy * 4) * 0.08;
      positions[at + 1] = sy + s * CLOUD_RISE;
      positions[at + 2] = sz;
    } else if (s < CARINA_AT) {
      writeLerp(at, sx, sy, sz, CARINA, smooth(0, 1, s / CARINA_AT));
    } else if (s < TOP_AT) {
      writeLerp(at, CARINA[0], CARINA[1], CARINA[2], TRACHEA_TOP, (s - CARINA_AT) / (TOP_AT - CARINA_AT));
    } else {
      writeLerp(at, TRACHEA_TOP[0], TRACHEA_TOP[1], TRACHEA_TOP[2], OUT, (s - TOP_AT) / (1 - TOP_AT));
    }
  };

  const update = (dt: number, t: number, density: number): void => {
    const push = (discreet ? DISCREET_PUSH : exhaleWeight(t)) * dt;
    for (let i = 0; i < count; i++) {
      progress[i] += push * rate[i];
      if (progress[i] >= 1) respawn(i, 0);
      const s = progress[i];
      place(i, s);
      // Fade in off the lung wall, out along the airway.
      const alpha = BASE_ALPHA * smooth(0, 0.12, s) * (1 - smooth(CARINA_AT, 1, s)) * density * opacity;
      colors[i * 4] = tint.r;
      colors[i * 4 + 1] = tint.g;
      colors[i * 4 + 2] = tint.b;
      colors[i * 4 + 3] = alpha;
    }
    geo.attributes.position.needsUpdate = true;
    geo.attributes.color.needsUpdate = true;
  };

  const retheme = (t: SceneTokens, dim: number) => {
    tint.copy(t.ink);
    if (t.isLight) tint.lerp(t.bg, LIGHT_MIST_MIX);
    opacity = dim;
  };

  return { points, update, retheme };
}

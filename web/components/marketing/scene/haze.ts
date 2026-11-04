import type * as THREE_NS from 'three';

import { exhaleWeight } from './breath';
import type { DisposeBin } from './disposables';
import { LOBE_HALF_AXES, insideLobe, lobeToPair, type LobeSide, type Vec3 } from './lungs';
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

/** Rejection-sample a point inside a random lobe, returned in lung-pair space. */
function seedInLobes(): Vec3 {
  const side: LobeSide = Math.random() < 0.5 ? 'left' : 'right';
  for (let tries = 0; tries < 40; tries++) {
    const x = (Math.random() * 2 - 1) * LOBE_HALF_AXES.x;
    const y = (Math.random() * 2 - 1) * LOBE_HALF_AXES.y;
    const z = (Math.random() * 2 - 1) * LOBE_HALF_AXES.z;
    if (insideLobe(side, x, y, z)) return lobeToPair(side, [x, y, z]);
  }
  return lobeToPair(side, [0, 0, 0]);
}

function seedInCloud(): Vec3 {
  return [
    (Math.random() * 2 - 1) * CLOUD_HALF.x,
    (Math.random() * 2 - 1) * CLOUD_HALF.y,
    (Math.random() * 2 - 1) * CLOUD_HALF.z,
  ];
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
    seeds.set(seed(), i * 3);
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

  const place = (i: number, s: number): void => {
    const sx = seeds[i * 3];
    const sy = seeds[i * 3 + 1];
    const sz = seeds[i * 3 + 2];
    let x: number;
    let y: number;
    let z: number;
    if (discreet) {
      x = sx + Math.sin(s * 6 + sy * 4) * 0.08;
      y = sy + s * CLOUD_RISE;
      z = sz;
    } else if (s < CARINA_AT) {
      const k = smooth(0, 1, s / CARINA_AT);
      [x, y, z] = [lerp(sx, CARINA[0], k), lerp(sy, CARINA[1], k), lerp(sz, CARINA[2], k)];
    } else if (s < TOP_AT) {
      const k = (s - CARINA_AT) / (TOP_AT - CARINA_AT);
      [x, y, z] = [lerp(CARINA[0], TRACHEA_TOP[0], k), lerp(CARINA[1], TRACHEA_TOP[1], k), lerp(CARINA[2], TRACHEA_TOP[2], k)];
    } else {
      const k = (s - TOP_AT) / (1 - TOP_AT);
      [x, y, z] = [lerp(TRACHEA_TOP[0], OUT[0], k), lerp(TRACHEA_TOP[1], OUT[1], k), lerp(TRACHEA_TOP[2], OUT[2], k)];
    }
    positions[i * 3] = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = z;
  };

  const update = (dt: number, t: number, density: number): void => {
    const push = exhaleWeight(t) * dt;
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
    tint = t.ink.clone();
    opacity = dim;
  };

  return { points, update, retheme };
}

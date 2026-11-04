import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as THREE from 'three';
import { buildHaze } from '@web/components/marketing/scene/haze';
import { DisposeBin } from '@web/components/marketing/scene/disposables';
import { BREATH_PERIOD_S } from '@web/components/marketing/scene/breath';
import type { SceneTokens } from '@web/components/marketing/scene/tokens';

const TOKENS: SceneTokens = {
  bg: new THREE.Color(0, 0, 0),
  ink: new THREE.Color(0.5, 0.5, 0.5),
  accent: new THREE.Color(0, 1, 1),
  warn: new THREE.Color(1, 0.5, 0.3),
  isLight: false,
};

function run(count: number, discreet: boolean) {
  const bin = new DisposeBin();
  const haze = buildHaze(THREE, bin, count, discreet, TOKENS);
  const geo = haze.points.geometry;
  // Several full breaths at ~60 fps so particles travel, respawn and fade.
  for (let t = 0; t < BREATH_PERIOD_S * 8; t += 1 / 60) haze.update(1 / 60, t, 1);
  return { haze, bin, pos: geo.attributes.position.array as Float32Array, col: geo.attributes.color.array as Float32Array };
}

describe('buildHaze', () => {
  it.each([false, true])('keeps every position finite and every alpha in 0..0.55 (discreet=%s)', (discreet) => {
    const { pos, col } = run(120, discreet);
    expect(pos.every(Number.isFinite)).toBe(true);
    for (let i = 3; i < col.length; i += 4) {
      expect(col[i]).toBeGreaterThanOrEqual(0);
      expect(col[i]).toBeLessThanOrEqual(0.55 + 1e-6); // float32 rounding
    }
  });

  it('allocates one vertex per requested particle', () => {
    const { pos, col } = run(84, false);
    expect(pos.length).toBe(84 * 3);
    expect(col.length).toBe(84 * 4);
  });

  it('writes in place: the attribute arrays are the same buffers before and after an update', () => {
    const bin = new DisposeBin();
    const haze = buildHaze(THREE, bin, 50, false, TOKENS);
    const before = haze.points.geometry.attributes.position.array;
    haze.update(1 / 60, 3, 1);
    expect(haze.points.geometry.attributes.position.array).toBe(before);
  });

  it('thins to nothing visible when the density is 0', () => {
    const bin = new DisposeBin();
    const haze = buildHaze(THREE, bin, 50, false, TOKENS);
    haze.update(1 / 60, 3, 0);
    const col = haze.points.geometry.attributes.color.array as Float32Array;
    for (let i = 3; i < col.length; i += 4) expect(col[i]).toBe(0);
  });

  it('has no per-frame array or object allocation in the animation loop', () => {
    const full = readFileSync(join(__dirname, '..', 'components', 'marketing', 'scene', 'haze.ts'), 'utf8');
    // Everything from the seeders and respawn through update: the paths that run while animating.
    const src = full
      .slice(full.indexOf('function seedInLobes'), full.indexOf('function buildSprite'))
      .concat(full.slice(full.indexOf('const respawn')))
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*$/gm, '');
    expect(src).not.toMatch(/\]\s*=\s*\[/); // [x, y, z] = [...] destructuring
    expect(src).not.toMatch(/\.set\(\s*\[/); // typedArray.set([...])
    expect(src).not.toMatch(/\bseed\(\)/); // seeders write into an out-parameter
  });
});

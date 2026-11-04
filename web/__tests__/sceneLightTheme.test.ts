import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { buildHaze } from '@web/components/marketing/scene/haze';
import { DisposeBin } from '@web/components/marketing/scene/disposables';
import { AIRWAY_OPACITY, LOBE_OPACITY } from '@web/components/marketing/scene/lungMeshes';
import { LIGHT_INK_DARKEN } from '@web/components/marketing/scene/tokens';
import { exhaleWeight } from '@web/components/marketing/scene/breath';
import type { SceneTokens } from '@web/components/marketing/scene/tokens';

const LIGHT: SceneTokens = {
  bg: new THREE.Color(0.9, 0.9, 0.9),
  ink: new THREE.Color(0.1, 0.1, 0.1),
  accent: new THREE.Color(0, 1, 1),
  warn: new THREE.Color(1, 0.5, 0.3),
  isLight: true,
};

describe('light theme stays a soft silhouette, not soot', () => {
  it('keeps the light lobes translucent', () => {
    expect(LOBE_OPACITY.light).toBeLessThanOrEqual(0.35);
    expect(LOBE_OPACITY.light).toBeGreaterThan(0.1);
  });

  it('keeps the light airways soft enough that muted text over them holds AA', () => {
    expect(AIRWAY_OPACITY.light).toBeLessThanOrEqual(0.5);
  });

  it('pulls the light ink only part-way towards black', () => {
    expect(LIGHT_INK_DARKEN).toBeLessThanOrEqual(0.45);
  });

  it('tints the light haze towards the page colour, so it reads as mist', () => {
    const haze = buildHaze(THREE, new DisposeBin(), 20, false, LIGHT);
    haze.retheme(LIGHT, 1);
    haze.update(1 / 60, 3, 1);
    const col = haze.points.geometry.attributes.color.array as Float32Array;
    // ink is 0.1, bg is 0.9: a mist tint sits clearly above the raw ink.
    expect(col[0]).toBeGreaterThan(0.4);
    expect(col[0]).toBeLessThan(0.9);
  });
});

describe('discreet haze has no breathing tell', () => {
  const INHALE_T = 0; // exhaleWeight(0) === 0: the lungs are breathing in
  const snapshot = (discreet: boolean) => {
    const haze = buildHaze(THREE, new DisposeBin(), 30, discreet, LIGHT);
    const pos = haze.points.geometry.attributes.position.array as Float32Array;
    haze.update(1 / 60, INHALE_T, 1); // fills the positions
    const before = Float32Array.from(pos);
    haze.update(1, INHALE_T, 1);
    return { before, after: pos };
  };

  it('is an inhale at the probe time', () => {
    expect(exhaleWeight(INHALE_T)).toBe(0);
  });

  it('keeps drifting during an inhale in discreet mode', () => {
    const { before, after } = snapshot(true);
    expect(Array.from(after)).not.toEqual(Array.from(before));
  });

  it('still waits for the exhale in the lung scene', () => {
    const { before, after } = snapshot(false);
    expect(Array.from(after)).toEqual(Array.from(before));
  });
});

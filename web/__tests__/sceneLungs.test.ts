import { describe, it, expect } from 'vitest';
import {
  CARDIAC_NOTCH,
  LOBE_HALF_AXES,
  bronchialTree,
  fitAirways,
  insideLobe,
  lobeDirection,
  lobeRadiusAt,
  lobeToPair,
  pairToLobe,
} from '@web/components/marketing/scene/lungs';

/** A local-space point at `frac` of the displaced surface along (u, v). */
function surfacePoint(side: 'left' | 'right', u: number, v: number, frac: number) {
  const [dx, dy, dz] = lobeDirection(u, v);
  const r = lobeRadiusAt(side, u, v) * frac;
  return [dx * r * LOBE_HALF_AXES.x, dy * r * LOBE_HALF_AXES.y, dz * r * LOBE_HALF_AXES.z] as const;
}

describe('insideLobe', () => {
  it('has the centre inside and a far point outside', () => {
    expect(insideLobe('left', 0, 0, 0)).toBe(true);
    expect(insideLobe('right', 0, 0, 0)).toBe(true);
    expect(insideLobe('left', 5, 5, 5)).toBe(false);
    expect(insideLobe('right', 0, 3, 0)).toBe(false);
  });

  it('agrees with the displacement: 0.95 of the surface is inside, 1.05 is outside', () => {
    for (const side of ['left', 'right'] as const) {
      for (let ui = 0; ui < 12; ui++) {
        for (let vi = 1; vi < 8; vi++) {
          const u = ui / 12;
          const v = vi / 8;
          expect(insideLobe(side, ...surfacePoint(side, u, v, 0.95))).toBe(true);
          expect(insideLobe(side, ...surfacePoint(side, u, v, 1.05))).toBe(false);
        }
      }
    }
  });

  it('carves the cardiac notch out of the left lobe only', () => {
    const [x, y, z] = surfacePoint('right', CARDIAC_NOTCH.u, CARDIAC_NOTCH.v, 0.8);
    expect(insideLobe('right', x, y, z)).toBe(true);
    expect(insideLobe('left', x, y, z)).toBe(false);
  });

  it('keeps the lateral side of both lobes full', () => {
    // u = 0.5 faces away from the notch (lateral).
    const [x, y, z] = surfacePoint('right', 0.5, 0.4, 0.95);
    expect(insideLobe('left', x, y, z)).toBe(true);
  });
});

describe('fitAirways', () => {
  const FIT_MARGIN = 0.92;

  it.each([3, 4])('keeps only airways that end inside their lobe at depth %i', (depth) => {
    const kept = fitAirways(bronchialTree(depth));
    expect(kept[0].level).toBe(0);
    for (const b of kept.slice(1)) {
      const end = b.points[b.points.length - 1];
      const side = end[0] >= 0 ? 'left' : 'right';
      const [x, y, z] = pairToLobe(side, end);
      expect(insideLobe(side, x / FIT_MARGIN, y / FIT_MARGIN, z / FIT_MARGIN)).toBe(true);
    }
  });

  it('keeps the main bronchi and most of the tree', () => {
    const tree = bronchialTree(4);
    const kept = fitAirways(tree);
    expect(kept.filter((b) => b.level === 1)).toHaveLength(2);
    expect(kept.length).toBeGreaterThanOrEqual(tree.length * 0.6);
  });

  it('drops the children of a dropped branch and never mutates its input', () => {
    const tree = bronchialTree(4);
    const snapshot = JSON.stringify(tree);
    const kept = fitAirways(tree);
    expect(JSON.stringify(tree)).toBe(snapshot);
    const ends = new Set(kept.map((b) => b.points[b.points.length - 1]));
    for (const b of kept.slice(1)) {
      if (b.level > 1) expect(ends.has(b.points[0])).toBe(true);
    }
  });

  it('round-trips pair space and lobe space', () => {
    for (const side of ['left', 'right'] as const) {
      const p: [number, number, number] = [0.3, 0.2, -0.1];
      const back = lobeToPair(side, pairToLobe(side, p));
      back.forEach((c, i) => expect(c).toBeCloseTo(p[i], 9));
    }
  });
});

describe('bronchialTree', () => {
  it.each([3, 4])('has 1 + 2 * (2^depth - 1) branches at depth %i', (depth) => {
    expect(bronchialTree(depth)).toHaveLength(1 + 2 * (2 ** depth - 1));
  });

  it('starts with the trachea and tapers strictly with depth', () => {
    const tree = bronchialTree(4);
    const byLevel = new Map<number, number[]>();
    for (const b of tree) byLevel.set(b.level, [...(byLevel.get(b.level) ?? []), b.radius]);
    expect(tree[0].level).toBe(0);
    expect([...byLevel.keys()]).toEqual([0, 1, 2, 3, 4]);
    let prev = Infinity;
    for (const level of [0, 1, 2, 3, 4]) {
      const radii = byLevel.get(level)!;
      expect(new Set(radii).size).toBe(1);
      expect(radii[0]).toBeLessThan(prev);
      expect(radii[0]).toBeGreaterThan(0);
      prev = radii[0];
    }
  });

  it('gives every branch at least two finite points', () => {
    for (const b of bronchialTree(3)) {
      expect(b.points.length).toBeGreaterThanOrEqual(2);
      for (const p of b.points) for (const c of p) expect(Number.isFinite(c)).toBe(true);
    }
  });

  it('is deterministic across calls', () => {
    expect(bronchialTree(4)).toEqual(bronchialTree(4));
  });
});

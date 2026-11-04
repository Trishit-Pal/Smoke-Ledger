import { describe, it, expect } from 'vitest';
import { hazeCountFor, pickSceneTier, QUIET_HAZE_FACTOR, SCENE_BUDGET } from '@web/lib/sceneTier';

const DESKTOP = { coarsePointer: false, hardwareConcurrency: 8, deviceMemory: 8, saveData: false };

describe('pickSceneTier', () => {
  it('gives a capable desktop the standard tier', () => {
    expect(pickSceneTier(DESKTOP)).toBe('standard');
  });

  it('treats unknown capabilities as capable (Safari/Firefox omit deviceMemory)', () => {
    expect(pickSceneTier({ coarsePointer: false })).toBe('standard');
  });

  it.each([
    ['a touch device', { ...DESKTOP, coarsePointer: true }],
    ['a 4-core CPU', { ...DESKTOP, hardwareConcurrency: 4 }],
    ['4 GB of memory', { ...DESKTOP, deviceMemory: 4 }],
  ])('drops to lite on %s', (_label, env) => {
    expect(pickSceneTier(env)).toBe('lite');
  });

  it('renders nothing when the user asked to save data', () => {
    expect(pickSceneTier({ ...DESKTOP, saveData: true })).toBe('off');
    expect(pickSceneTier({ coarsePointer: true, saveData: true })).toBe('off');
  });
});

describe('SCENE_BUDGET', () => {
  it('pins the exact budget of each tier', () => {
    expect(SCENE_BUDGET.standard).toMatchObject({
      dprCap: 2, hazeParticles: 420, bronchiDepth: 4, lobeSegments: 64,
      bloom: true, parallax: true, frameIntervalMs: 0,
    });
    expect(SCENE_BUDGET.lite).toMatchObject({
      dprCap: 1, hazeParticles: 140, bronchiDepth: 3, lobeSegments: 40,
      bloom: false, parallax: false, frameIntervalMs: 33,
    });
  });

  it('no longer carries the legacy shard and particle counts', () => {
    for (const budget of Object.values(SCENE_BUDGET)) {
      expect(budget).not.toHaveProperty('shards');
      expect(budget).not.toHaveProperty('particles');
    }
  });

  it('lite is strictly cheaper than standard on every axis', () => {
    const { standard, lite } = SCENE_BUDGET;
    expect(lite.dprCap).toBeLessThan(standard.dprCap);
    expect(lite.hazeParticles).toBeLessThan(standard.hazeParticles);
    expect(lite.bronchiDepth).toBeLessThan(standard.bronchiDepth);
    expect(lite.lobeSegments).toBeLessThan(standard.lobeSegments);
    expect(lite.bloom).toBe(false);
    expect(lite.parallax).toBe(false);
    expect(lite.frameIntervalMs).toBeGreaterThan(standard.frameIntervalMs);
  });
});

describe('hazeCountFor', () => {
  it('keeps the full haze at full strength', () => {
    expect(hazeCountFor(SCENE_BUDGET.standard, false)).toBe(420);
    expect(hazeCountFor(SCENE_BUDGET.lite, false)).toBe(140);
  });

  it('thins the haze to 60% on the quiet tier, on every device tier', () => {
    expect(QUIET_HAZE_FACTOR).toBe(0.6);
    expect(hazeCountFor(SCENE_BUDGET.standard, true)).toBe(252);
    expect(hazeCountFor(SCENE_BUDGET.lite, true)).toBe(84);
  });
});

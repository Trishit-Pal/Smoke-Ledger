import { describe, it, expect } from 'vitest';
import { pickSceneTier, SCENE_BUDGET } from '@web/lib/sceneTier';

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
  it('lite is strictly cheaper than standard on every axis', () => {
    const { standard, lite } = SCENE_BUDGET;
    expect(lite.dprCap).toBeLessThan(standard.dprCap);
    expect(lite.particles).toBeLessThan(standard.particles);
    expect(lite.shards).toBeLessThan(standard.shards);
    expect(lite.bloom).toBe(false);
    expect(lite.parallax).toBe(false);
    expect(lite.frameIntervalMs).toBeGreaterThan(standard.frameIntervalMs);
  });
});

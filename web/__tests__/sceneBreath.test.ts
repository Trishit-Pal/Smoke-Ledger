import { describe, it, expect } from 'vitest';
import {
  BREATH_AMPLITUDE,
  BREATH_PERIOD_S,
  HAZE_FLOOR,
  SCENE_CLEAR_KEY,
  breathPhase,
  breathScale,
  hazeDensity,
  sceneClearStart,
} from '@web/components/marketing/scene/breath';

function fakeStorage(initial?: string) {
  const data = new Map<string, string>();
  if (initial !== undefined) data.set(SCENE_CLEAR_KEY, initial);
  return {
    data,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
  };
}

describe('breath', () => {
  it('repeats with the breath period', () => {
    expect(BREATH_PERIOD_S).toBe(5.5);
    for (const t of [0, 1.3, 4.9]) {
      expect(breathPhase(t)).toBeCloseTo(breathPhase(t + BREATH_PERIOD_S), 9);
    }
  });

  it('keeps the phase within -1..1 and the scale within 0.96..1.04', () => {
    for (let t = 0; t < 30; t += 0.07) {
      expect(Math.abs(breathPhase(t))).toBeLessThanOrEqual(1);
      const s = breathScale(t);
      expect(s).toBeGreaterThanOrEqual(1 - BREATH_AMPLITUDE - 1e-12);
      expect(s).toBeLessThanOrEqual(1 + BREATH_AMPLITUDE + 1e-12);
    }
    expect(BREATH_AMPLITUDE).toBe(0.04);
  });
});

describe('hazeDensity', () => {
  it('starts full, never rises, and settles at the floor without going below it', () => {
    expect(hazeDensity(0)).toBe(1);
    let prev = 1;
    for (let t = 0; t <= 600; t += 5) {
      const d = hazeDensity(t);
      expect(d).toBeLessThanOrEqual(prev);
      expect(d).toBeGreaterThanOrEqual(HAZE_FLOOR);
      prev = d;
    }
    expect(hazeDensity(1e6)).toBeCloseTo(HAZE_FLOOR, 6);
    expect(HAZE_FLOOR).toBe(0.08);
  });

  it('treats a negative elapsed time as full haze', () => {
    expect(hazeDensity(-50)).toBe(1);
  });
});

describe('sceneClearStart', () => {
  const NOW = 1_700_000_000_000;

  it('writes and returns now on first call, then returns the stored value', () => {
    const s = fakeStorage();
    expect(sceneClearStart(s, NOW)).toBe(NOW);
    expect(s.data.get('scene-clear-start')).toBe(String(NOW));
    expect(sceneClearStart(s, NOW + 5000)).toBe(NOW);
  });

  it('returns now when storage throws', () => {
    const throwing = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };
    expect(sceneClearStart(throwing, NOW)).toBe(NOW);
  });

  it('returns now when only writing throws', () => {
    const s = fakeStorage();
    s.setItem = () => {
      throw new Error('quota');
    };
    expect(sceneClearStart(s, NOW)).toBe(NOW);
  });

  it.each([['garbage', 'abc'], ['empty', ''], ['zero', '0'], ['negative', '-5'], ['future', String(NOW + 60_000)]])(
    'replaces a %s stored value with now',
    (_label, stored) => {
      const s = fakeStorage(stored);
      expect(sceneClearStart(s, NOW)).toBe(NOW);
      expect(s.data.get(SCENE_CLEAR_KEY)).toBe(String(NOW));
    },
  );
});

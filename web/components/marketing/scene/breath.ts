/**
 * Pure timing helpers for the ambient lungs scene: the slow breath, the haze
 * that thins as the reader stays, and the persisted start of that clearing.
 * No three.js, no DOM; storage is injected so tests can fake it.
 */

/** Seconds per full breath (in + out). Slow and gravitational, no bounce. */
export const BREATH_PERIOD_S = 5.5;
/** Peak deviation of the lung scale from 1 (so scale is within 1 +/- 0.04). */
export const BREATH_AMPLITUDE = 0.04;
/** Haze never fully vanishes, so the scene keeps a trace of its history. */
export const HAZE_FLOOR = 0.08;
/** Time constant (seconds) of the exponential haze decay. */
export const HAZE_TAU_S = 40;
/** sessionStorage key holding the epoch-ms moment the haze started clearing. */
export const SCENE_CLEAR_KEY = 'scene-clear-start';

/** Breath position in -1..1 (sine). 0 at t=0, rising; repeats every BREATH_PERIOD_S. */
export function breathPhase(tSeconds: number): number {
  return Math.sin((2 * Math.PI * tSeconds) / BREATH_PERIOD_S);
}

/** Uniform scale to apply to the lungs: 1 + BREATH_AMPLITUDE * breathPhase. */
export function breathScale(tSeconds: number): number {
  return 1 + BREATH_AMPLITUDE * breathPhase(tSeconds);
}

/**
 * How strongly the lungs are breathing OUT at time t, in 0..1: the falling half
 * of the breath (the slope of breathPhase, sign-flipped and clamped).
 */
export function exhaleWeight(tSeconds: number): number {
  return Math.max(0, -Math.cos((2 * Math.PI * tSeconds) / BREATH_PERIOD_S));
}

/**
 * Haze opacity multiplier in [HAZE_FLOOR, 1]: 1 at elapsed 0, decaying
 * exponentially towards HAZE_FLOOR. Negative elapsed is treated as 0.
 */
export function hazeDensity(elapsedSeconds: number): number {
  const d = HAZE_FLOOR + (1 - HAZE_FLOOR) * Math.exp(-elapsedSeconds / HAZE_TAU_S);
  return Math.min(1, Math.max(HAZE_FLOOR, d));
}

/** The slice of Storage that sceneClearStart needs. */
export interface ClearStartStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/**
 * Epoch-ms moment the haze started clearing. Returns the stored value, or
 * stores and returns `now` when there is none, or it is malformed (not a
 * positive finite number) or in the future. Unavailable or throwing storage
 * (private mode, blocked cookies) yields `now`.
 */
export function sceneClearStart(storage: ClearStartStorage, now: number): number {
  try {
    const stored = Number(storage.getItem(SCENE_CLEAR_KEY));
    if (Number.isFinite(stored) && stored > 0 && stored <= now) return stored;
    storage.setItem(SCENE_CLEAR_KEY, String(now));
  } catch {
    // Storage unavailable: the haze simply restarts each visit.
  }
  return now;
}

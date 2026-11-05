/**
 * The airway light: one slow glow up and back along the bronchial tree when a
 * recovery milestone is newly reached. Pure maths plus a tiny stateful runner;
 * no three.js, no allocation per frame. The caller owns the clock.
 */

export const AIRWAY_LIGHT_MS = 2400;

/** Glow in [0, 1]: ease-in-out up to the midpoint, ease-in-out back, 0 outside the run. */
export function airwayLightLevel(elapsedMs: number): number {
  if (elapsedMs <= 0 || elapsedMs >= AIRWAY_LIGHT_MS) return 0;
  return 0.5 - 0.5 * Math.cos((2 * Math.PI * elapsedMs) / AIRWAY_LIGHT_MS);
}

export interface AirwayLight {
  /** Arm the light; the first drawn frame after this plays it. No-op while armed or running. */
  start(): void;
  /** Call once per drawn frame. Idle until armed; applies 0 exactly once at the end. */
  tick(nowMs: number): void;
}

export function createAirwayLight(apply: (level: number) => void): AirwayLight {
  // The clock starts at the first DRAWN frame, so a request made while the loop is
  // idle-stopped or the tab is hidden still plays in full once the reader is back.
  let armed = false;
  let startedAt = -1;
  return {
    start() {
      if (startedAt < 0) armed = true; // running: no-op
    },
    tick(nowMs) {
      if (armed && startedAt < 0) {
        armed = false;
        startedAt = nowMs;
      }
      if (startedAt < 0) return;
      const elapsed = nowMs - startedAt;
      if (elapsed >= AIRWAY_LIGHT_MS) {
        startedAt = -1;
        apply(0);
        return;
      }
      apply(airwayLightLevel(elapsed));
    },
  };
}

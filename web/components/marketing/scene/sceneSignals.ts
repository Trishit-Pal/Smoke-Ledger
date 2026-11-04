/**
 * What Home tells the scene. A module-level value plus a Set of listeners:
 * no React, no dependency, so the dashboard publishes and the Three.js layer
 * subscribes without either importing the other. `null` = nothing to show
 * (discreet mode, or Home is not mounted).
 */

export type HomeSignals = {
  /** Jar fill in [0, 1). */
  fill: number;
  /** Already masked by the dashboard (••• when totals are hidden). */
  label: string;
  underBaselineYesterday: boolean;
  lastSmokeIso: string | null;
};

type Listener = (s: HomeSignals | null) => void;

let current: HomeSignals | null = null;
const listeners = new Set<Listener>();

export function publishHomeSignals(s: HomeSignals | null): void {
  current = s;
  listeners.forEach((fn) => fn(s));
}

export function subscribeHomeSignals(fn: Listener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function getHomeSignals(): HomeSignals | null {
  return current;
}

/**
 * One-shot "light the airways" request. The overlay asks, the scene answers.
 * three.js loads after first paint, so a request made before the scene has
 * subscribed is held and replayed once to the first subscriber, but only while
 * it is still fresh: a scene that mounts much later (discreet turned off, a
 * remount) must not play a glow for a milestone that was reached long ago.
 */
export const AIRWAY_REQUEST_TTL_MS = 10_000;

const airwayListeners = new Set<() => void>();
let airwayPendingAt: number | null = null;

export function requestAirwayLight(): void {
  if (airwayListeners.size === 0) {
    airwayPendingAt = Date.now();
    return;
  }
  airwayListeners.forEach((fn) => fn());
}

/** Drop a held request nobody picked up (the overlay calls this as it goes away). */
export function cancelAirwayLight(): void {
  airwayPendingAt = null;
}

export function subscribeAirwayLight(fn: () => void): () => void {
  airwayListeners.add(fn);
  const heldAt = airwayPendingAt;
  airwayPendingAt = null;
  if (heldAt !== null && Date.now() - heldAt < AIRWAY_REQUEST_TTL_MS) fn();
  return () => {
    airwayListeners.delete(fn);
  };
}

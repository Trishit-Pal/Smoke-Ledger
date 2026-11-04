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
 * subscribed is held and replayed once to the first subscriber.
 */
const airwayListeners = new Set<() => void>();
let airwayPending = false;

export function requestAirwayLight(): void {
  if (airwayListeners.size === 0) {
    airwayPending = true;
    return;
  }
  airwayListeners.forEach((fn) => fn());
}

export function subscribeAirwayLight(fn: () => void): () => void {
  airwayListeners.add(fn);
  if (airwayPending) {
    airwayPending = false;
    fn();
  }
  return () => {
    airwayListeners.delete(fn);
  };
}

/** What the ambient WebGL scene is allowed to cost on this device. */
export type SceneTier = 'standard' | 'lite' | 'off';

export interface SceneEnv {
  coarsePointer: boolean;
  hardwareConcurrency?: number;
  /** GB, Chromium-only; undefined elsewhere. */
  deviceMemory?: number;
  saveData?: boolean;
}

export interface SceneBudget {
  dprCap: number;
  /** Ambient haze particle count. */
  hazeParticles: number;
  /** Branching levels per side of the bronchial tree. */
  bronchiDepth: number;
  /** Radial/vertical segments of each lobe mesh. */
  lobeSegments: number;
  /** Bloom still also requires the 'full' intensity (brand surfaces). */
  bloom: boolean;
  parallax: boolean;
  /** Minimum ms between drawn frames; 0 = every animation frame. */
  frameIntervalMs: number;
}

export const SCENE_BUDGET: Record<Exclude<SceneTier, 'off'>, SceneBudget> = {
  standard: {
    dprCap: 2, hazeParticles: 420, bronchiDepth: 4, lobeSegments: 64,
    bloom: true, parallax: true, frameIntervalMs: 0,
  },
  lite: {
    dprCap: 1, hazeParticles: 140, bronchiDepth: 3, lobeSegments: 40,
    bloom: false, parallax: false, frameIntervalMs: 33,
  },
};

/** The quiet (product) tier keeps this share of the haze particles. */
export const QUIET_HAZE_FACTOR = 0.6;

export function hazeCountFor(budget: SceneBudget, isQuiet: boolean): number {
  return Math.round(budget.hazeParticles * (isQuiet ? QUIET_HAZE_FACTOR : 1));
}

// ponytail: capability sniffing is a heuristic (cores/memory/pointer), not a benchmark;
// replace with a first-seconds frame-time probe if misclassified devices are reported.
export function pickSceneTier(env: SceneEnv): SceneTier {
  if (env.saveData) return 'off';
  const weak =
    env.coarsePointer ||
    (env.hardwareConcurrency !== undefined && env.hardwareConcurrency <= 4) ||
    (env.deviceMemory !== undefined && env.deviceMemory <= 4);
  return weak ? 'lite' : 'standard';
}

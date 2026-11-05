import type * as THREE_NS from 'three';

import type { DisposeBin } from './disposables';
import { jarPlacement, type JarPlacement } from './layout';
import { grainDue, type MinimalStorage } from './pull';
import { getHomeSignals, subscribeHomeSignals, type HomeSignals } from './sceneSignals';
import type { SceneTokens, ThreeNs } from './tokens';

/**
 * The jar of money kept, on Home only. A glass lathe jar in the lungs' quiet glass
 * language (no transmission, no bloom), an `--accent` fill scaled on y, and one
 * grain of accent light that falls in on a day that came in under baseline.
 * Local units: the jar stands on y = 0, one unit tall, centred on the y axis.
 * `mountJar` keeps it pinned to the camera so it sits exactly under its DOM label.
 */

export interface Jar {
  group: THREE_NS.Group;
  /** Fill level in [0, 1]; anything non-finite counts as 0. Scales the fill mesh on y only. */
  setFill(fill: number): void;
  /** Arm one grain; the first drawn frame after this starts it. No-op while one is falling. */
  dropGrain(): void;
  /** Call once per drawn frame. */
  tick(nowMs: number): void;
  retheme(tokens: SceneTokens): void;
}

export const GRAIN_DROP_MS = 2400;
export const JAR_OPACITY = {
  glass: { dark: 0.6, light: 0.4 },
  fill: { dark: 0.9, light: 0.7 },
  grain: { dark: 0.9, light: 0.8 },
} as const;
const FILL_GLOW = { dark: 0.6, light: 0.4 } as const; // emissive of the accent fill, no bloom
/** Fill column: from just above the base to the shoulder. */
const FILL_BASE = 0.03;
const FILL_HEIGHT = 0.57;
const FILL_RADIUS = 0.37;
const GRAIN_RADIUS = 0.035;
const GRAIN_START_Y = 1.02; // just above the lip
const EDGE_DARKEN = 0.2; // light theme: extra pull towards black for the glass rim
const LATHE_SEGMENTS = 28;
/** Profile, radius then height: a rounded base, straight body, shoulder, neck, lip. */
const PROFILE: ReadonlyArray<readonly [number, number]> = [
  [0, 0],
  [0.3, 0],
  [0.37, 0.02],
  [0.4, 0.07],
  [0.4, 0.6],
  [0.36, 0.68],
  [0.25, 0.74],
  [0.23, 0.8],
  [0.23, 0.92],
  [0.26, 0.94],
  [0.26, 0.97],
];

/** Slow and gravitational: ease-in-out from 0 to 1 over the drop, no spring. */
export function grainProgress(elapsedMs: number): number {
  const u = Math.min(1, Math.max(0, elapsedMs / GRAIN_DROP_MS));
  return 0.5 - 0.5 * Math.cos(Math.PI * u);
}

export function buildJar(THREE: ThreeNs, tokens: SceneTokens, bin: DisposeBin): Jar {
  const group = new THREE.Group();

  const glassMat = bin.track(
    new THREE.MeshPhysicalMaterial({
      metalness: 0,
      transmission: 0, // CI renders WebGL on the CPU: the quiet tier never refracts
      sheen: 1,
      sheenRoughness: 0.5,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      fog: false, // pinned to the camera: distance fog would melt it into the page
    }),
  );
  const glass = new THREE.Mesh(
    bin.track(new THREE.LatheGeometry(PROFILE.map(([r, y]) => new THREE.Vector2(r, y)), LATHE_SEGMENTS)),
    glassMat,
  );
  glass.name = 'jar-glass';

  const fillMat = bin.track(
    new THREE.MeshStandardMaterial({ roughness: 0.5, metalness: 0, transparent: true, depthWrite: false, fog: false }),
  );
  const column = bin.track(new THREE.CylinderGeometry(FILL_RADIUS, FILL_RADIUS, FILL_HEIGHT, 24, 1));
  column.translate(0, FILL_HEIGHT / 2, 0); // grow up from the base when scaled on y
  const fill = new THREE.Mesh(column, fillMat);
  fill.name = 'jar-fill';
  fill.position.y = FILL_BASE;
  fill.scale.y = 0;
  fill.visible = false;

  const grainMat = bin.track(new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, fog: false }));
  const grain = new THREE.Mesh(bin.track(new THREE.SphereGeometry(GRAIN_RADIUS, 12, 8)), grainMat);
  grain.name = 'jar-grain';
  grain.visible = false;

  group.add(glass, fill, grain);

  let level = 0;
  let armed = false;
  let startedAt = -1;
  let grainOpacity: number = JAR_OPACITY.grain.dark;
  const edge = new THREE.Color();

  const setFill = (value: number) => {
    level = Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
    fill.scale.y = level;
    fill.visible = level > 0;
  };

  const retheme = (t: SceneTokens) => {
    const theme = t.isLight ? 'light' : 'dark';
    edge.copy(t.ink);
    if (t.isLight) edge.lerp(new THREE.Color(0, 0, 0), EDGE_DARKEN);
    glassMat.color.copy(t.ink);
    glassMat.sheenColor.copy(edge);
    glassMat.roughness = t.isLight ? 0.55 : 0.15;
    glassMat.specularIntensity = t.isLight ? 0.2 : 1;
    glassMat.opacity = JAR_OPACITY.glass[theme];
    fillMat.color.copy(t.accent);
    fillMat.emissive.copy(t.accent); // under the page veil the lit colour would sink into the page
    fillMat.emissiveIntensity = FILL_GLOW[theme];
    fillMat.opacity = JAR_OPACITY.fill[theme];
    grainMat.color.copy(t.accent);
    grainOpacity = JAR_OPACITY.grain[theme];
  };
  retheme(tokens);

  // The clock starts at the first DRAWN frame (as the airway light does), so a grain armed
  // while the loop is idle-stopped still plays in full once the reader is back.
  const tick = (nowMs: number) => {
    if (armed && startedAt < 0) {
      armed = false;
      startedAt = nowMs;
    }
    if (startedAt < 0) return;
    const elapsed = nowMs - startedAt;
    if (elapsed >= GRAIN_DROP_MS) {
      startedAt = -1;
      grain.visible = false;
      return;
    }
    const surface = FILL_BASE + FILL_HEIGHT * level;
    grain.position.y = GRAIN_START_Y + (surface - GRAIN_START_Y) * grainProgress(elapsed);
    grainMat.opacity = grainOpacity * Math.sin((Math.PI * elapsed) / GRAIN_DROP_MS);
    grain.visible = true;
  };

  return {
    group,
    setFill,
    dropGrain() {
      if (startedAt < 0) armed = true;
    },
    tick,
    retheme,
  };
}

/** Where the jar goes in camera space: pinned to the screen, `JAR_DEPTH` units ahead. */
const JAR_DEPTH = 20;

export interface JarMountOptions {
  /** Reduced motion: the grain never runs (the scene itself renders nothing then). */
  reduce: { matches: boolean };
  /** Restart an idle-stopped render loop. */
  wake(): void;
  storage?: () => MinimalStorage | null;
  /** The reader's calendar day, YYYY-MM-DD. */
  today?: () => string;
}

export interface JarMount {
  /** Re-place for the layout and viewport; defaults to the window. Hides the jar where there is no room. */
  place(wide: boolean, viewportWidth?: number, viewportHeight?: number): void;
  retheme(tokens: SceneTokens): void;
  tick(nowMs: number): void;
  /** Start following Home's signals; returns the unsubscribe. Call once the render loop exists. */
  subscribe(): () => void;
}

function sessionStore(): MinimalStorage | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function localYmd(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * The jar exists only while Home holds signals AND the viewport has room for it (wide layout,
 * >= 1536px, tall enough); otherwise nothing is built or drawn. Camera-pinned, so the camera is
 * added to the scene (a camera outside the scene does not draw its children).
 */
export function mountJar(
  THREE: ThreeNs,
  bin: DisposeBin,
  scene: THREE_NS.Scene,
  camera: THREE_NS.PerspectiveCamera,
  tokens: SceneTokens,
  opts: JarMountOptions,
): JarMount {
  scene.add(camera);
  const storage = opts.storage ?? sessionStore;
  const today = opts.today ?? localYmd;
  let jar: Jar | null = null;
  let current = tokens;
  let latest: HomeSignals | null = null;
  let placement: (JarPlacement & { viewportWidth: number; viewportHeight: number }) | null = null;
  let raf = 0;

  const refresh = () => {
    if (!latest || !placement) {
      if (jar) camera.remove(jar.group);
      return;
    }
    jar ??= buildJar(THREE, current, bin);
    const { viewportWidth: vw, viewportHeight: vh } = placement;
    const halfHeight = JAR_DEPTH * Math.tan((camera.fov / 2) * (Math.PI / 180));
    const halfWidth = (halfHeight * vw) / vh;
    jar.group.scale.setScalar((placement.heightPx * 2 * halfHeight) / vh); // the jar is one unit tall
    jar.group.position.set(
      (placement.centreXPx / vw * 2 - 1) * halfWidth,
      (1 - ((placement.topPx + placement.heightPx) / vh) * 2) * halfHeight,
      -JAR_DEPTH,
    );
    jar.setFill(latest.fill);
    if (jar.group.parent !== camera) camera.add(jar.group);
  };

  return {
    place(wide, vw = window.innerWidth, vh = window.innerHeight) {
      const p = wide ? jarPlacement(vw, vh) : null;
      placement = p && { ...p, viewportWidth: vw, viewportHeight: vh };
      refresh();
    },
    retheme(t) {
      current = t;
      jar?.retheme(t);
    },
    tick: (nowMs) => jar?.tick(nowMs),
    subscribe() {
      const apply = (s: HomeSignals | null) => {
        cancelAnimationFrame(raf);
        raf = 0;
        if (!s) {
          // Home clears then republishes in one tick: let the clear land on the next frame.
          raf = requestAnimationFrame(() => {
            raf = 0;
            latest = null;
            refresh();
          });
          return;
        }
        latest = s;
        refresh();
        // The grain rides only a jar that is on screen, and never under reduced motion.
        if (!jar || jar.group.parent !== camera || !s.underBaselineYesterday || opts.reduce.matches) return;
        const store = storage();
        if (store && grainDue(store, true, today())) {
          jar.dropGrain();
          opts.wake();
        }
      };
      const first = getHomeSignals();
      if (first) apply(first); // the store does not replay
      const off = subscribeHomeSignals(apply);
      return () => {
        off();
        cancelAnimationFrame(raf);
        raf = 0;
        if (jar) camera.remove(jar.group);
      };
    },
  };
}

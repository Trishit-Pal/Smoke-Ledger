import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DisposeBin } from '@web/components/marketing/scene/disposables';
import {
  GRAIN_DROP_MS,
  buildJar,
  grainProgress,
  mountJar,
  type JarMount,
} from '@web/components/marketing/scene/jarMesh';
import { JarLabel, JarLabelNote, jarLabelEnabled } from '@web/components/marketing/scene/JarLabel';
import {
  JAR_ANCHOR,
  JAR_HEIGHT_PX,
  JAR_MIN_HEIGHT_PX,
  JAR_MIN_WIDTH_PX,
  OVERLAY_ANCHOR,
  jarPlacement,
  lungBottomPercent,
  lungTopPercent,
} from '@web/components/marketing/scene/layout';
import { GRAIN_DAY_KEY, type MinimalStorage } from '@web/components/marketing/scene/pull';
import { publishHomeSignals, type HomeSignals } from '@web/components/marketing/scene/sceneSignals';
import type { SceneTokens } from '@web/components/marketing/scene/tokens';

const MARKETING = join(__dirname, '..', 'components', 'marketing');
const read = (...p: string[]) => readFileSync(join(MARKETING, ...p), 'utf8');
const stripComments = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\s\/\/.*$/gm, '');
const COLOUR_LITERAL = /#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(|\b0x[0-9a-fA-F]{6}\b/;

const tokens = (isLight: boolean): SceneTokens => ({
  bg: new THREE.Color(isLight ? '#ffffff' : '#000000'),
  ink: new THREE.Color('#888888'),
  accent: new THREE.Color(isLight ? '#0a7a70' : '#2fa39b'),
  warn: new THREE.Color('#d08267'),
  isLight,
});

const signals = (over: Partial<HomeSignals> = {}): HomeSignals => ({
  fill: 0.4,
  label: '₹1,234',
  underBaselineYesterday: false,
  lastSmokeIso: null,
  ...over,
});

const meshNamed = (group: THREE.Object3D, name: string): THREE.Mesh => {
  const found = group.getObjectByName(name);
  if (!found) throw new Error(`no ${name}`);
  return found as THREE.Mesh;
};

function memoryStorage(): MinimalStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
}

describe('buildJar', () => {
  it('builds a glass jar, a fill and a grain, each named', () => {
    const jar = buildJar(THREE, tokens(false), new DisposeBin());
    for (const name of ['jar-glass', 'jar-fill', 'jar-grain']) expect(jar.group.getObjectByName(name)).toBeDefined();
    expect(meshNamed(jar.group, 'jar-glass').geometry).toBeInstanceOf(THREE.LatheGeometry);
  });

  it('setFill clamps to [0, 1], treats non-finite as 0, and scales only the fill mesh on y', () => {
    const jar = buildJar(THREE, tokens(false), new DisposeBin());
    const fill = meshNamed(jar.group, 'jar-fill');
    const glass = meshNamed(jar.group, 'jar-glass');
    const cases: Array<[number, number]> = [
      [0.4, 0.4],
      [-3, 0],
      [7, 1],
      [Number.NaN, 0],
      [Number.POSITIVE_INFINITY, 0],
      [Number.NEGATIVE_INFINITY, 0],
    ];
    for (const [input, expected] of cases) {
      jar.setFill(input);
      expect(fill.scale.y).toBe(expected);
      expect(fill.scale.x).toBe(1);
      expect(fill.scale.z).toBe(1);
      expect(glass.scale.toArray()).toEqual([1, 1, 1]);
    }
  });

  it('shows no fill at 0 and some fill above it', () => {
    const jar = buildJar(THREE, tokens(false), new DisposeBin());
    const fill = meshNamed(jar.group, 'jar-fill');
    jar.setFill(0);
    expect(fill.visible).toBe(false);
    jar.setFill(0.2);
    expect(fill.visible).toBe(true);
  });

  it('sends every geometry and material through the dispose bin', () => {
    const bin = new DisposeBin();
    const jar = buildJar(THREE, tokens(false), bin);
    const disposables: Array<{ dispose(): void }> = [];
    jar.group.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      disposables.push(m.geometry, m.material as THREE.Material);
    });
    expect(disposables.length).toBeGreaterThanOrEqual(6);
    const spies = disposables.map((d) => vi.spyOn(d, 'dispose'));
    bin.disposeAll();
    for (const spy of spies) expect(spy).toHaveBeenCalled();
  });

  it('retheme re-reads the tokens: accent fill, lower opacity on light', () => {
    const jar = buildJar(THREE, tokens(false), new DisposeBin());
    const glass = meshNamed(jar.group, 'jar-glass').material as THREE.MeshPhysicalMaterial;
    const fill = meshNamed(jar.group, 'jar-fill').material as THREE.MeshStandardMaterial;
    const darkAccent = tokens(false).accent;
    expect(fill.color.getHex()).toBe(darkAccent.getHex());
    const darkGlass = glass.opacity;
    const darkFill = fill.opacity;
    const light = tokens(true);
    jar.retheme(light);
    expect(fill.color.getHex()).toBe(light.accent.getHex());
    expect(glass.opacity).toBeLessThan(darkGlass);
    expect(fill.opacity).toBeLessThan(darkFill);
  });

  it('uses the quiet material: no transmission, no fog, and no bloom needed', () => {
    const jar = buildJar(THREE, tokens(false), new DisposeBin());
    const glass = meshNamed(jar.group, 'jar-glass').material as THREE.MeshPhysicalMaterial;
    expect(glass.transmission).toBe(0);
    expect(glass.transparent).toBe(true);
    expect(glass.fog).toBe(false);
  });
});

describe('the grain', () => {
  it('eases in and out over about 2.4 s', () => {
    expect(GRAIN_DROP_MS).toBe(2400);
    expect(grainProgress(0)).toBe(0);
    expect(grainProgress(GRAIN_DROP_MS / 2)).toBeCloseTo(0.5, 6);
    expect(grainProgress(GRAIN_DROP_MS)).toBe(1);
    expect(grainProgress(GRAIN_DROP_MS * 0.1)).toBeLessThan(0.1); // slow start
    expect(grainProgress(GRAIN_DROP_MS * 0.9)).toBeGreaterThan(0.9); // slow arrival
  });

  it('only arms on dropGrain; the first rendered tick stamps the start; it ends hidden', () => {
    const jar = buildJar(THREE, tokens(false), new DisposeBin());
    const grain = meshNamed(jar.group, 'jar-grain');
    jar.setFill(0.5);
    jar.tick(1000);
    expect(grain.visible).toBe(false); // not armed: nothing
    jar.dropGrain();
    expect(grain.visible).toBe(false); // arming alone shows nothing
    jar.tick(500_000); // the first drawn frame, long after arming
    const top = grain.position.y;
    jar.tick(500_000 + GRAIN_DROP_MS / 2);
    expect(grain.visible).toBe(true);
    expect(grain.position.y).toBeLessThan(top); // it fell
    jar.tick(500_000 + GRAIN_DROP_MS + 1);
    expect(grain.visible).toBe(false);
  });

  it('lands on the fill surface: a fuller jar stops the grain higher', () => {
    const landing = (fill: number) => {
      const jar = buildJar(THREE, tokens(false), new DisposeBin());
      jar.setFill(fill);
      jar.dropGrain();
      jar.tick(0);
      jar.tick(GRAIN_DROP_MS - 1);
      return meshNamed(jar.group, 'jar-grain').position.y;
    };
    expect(landing(0.8)).toBeGreaterThan(landing(0.1));
  });
});

describe('mountJar', () => {
  let rafQueue: Array<() => void>;
  let scene: THREE.Scene;
  let camera: THREE.PerspectiveCamera;
  let bin: DisposeBin;
  let mount: JarMount;
  let wake: ReturnType<typeof vi.fn>;
  let storage: ReturnType<typeof memoryStorage>;
  let off: () => void;

  const flushFrame = () => rafQueue.splice(0).forEach((cb) => cb());
  const jarGroup = () => camera.children.find((c) => c.getObjectByName('jar-glass'));
  const setup = (reduce = false) => {
    wake = vi.fn();
    storage = memoryStorage();
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(50, 16 / 9, 0.1, 200);
    bin = new DisposeBin();
    mount = mountJar(THREE, bin, scene, camera, tokens(false), {
      reduce: { matches: reduce },
      wake,
      storage: () => storage,
      today: () => '2026-11-05',
    });
    mount.place(true, 1728, 972);
    off = mount.subscribe();
  };

  beforeEach(() => {
    rafQueue = [];
    vi.stubGlobal('requestAnimationFrame', (cb: () => void) => rafQueue.push(cb));
    vi.stubGlobal('cancelAnimationFrame', (id: number) => {
      if (id > 0 && id <= rafQueue.length) rafQueue[id - 1] = () => {};
    });
    publishHomeSignals(null);
  });
  afterEach(() => {
    off?.();
    publishHomeSignals(null);
    vi.unstubAllGlobals();
  });

  it('has no jar while the store is empty, adds it when published, removes it on null', () => {
    setup();
    expect(jarGroup()).toBeUndefined();
    publishHomeSignals(signals());
    expect(jarGroup()).toBeDefined();
    publishHomeSignals(null);
    expect(jarGroup()).toBeDefined(); // the clear lands on the next frame: no flicker
    flushFrame();
    expect(jarGroup()).toBeUndefined();
  });

  it('has no jar when Home publishes no label (a reader without a baseline)', () => {
    setup();
    publishHomeSignals(signals({ label: '', fill: 0 }));
    expect(jarGroup()).toBeUndefined();
    publishHomeSignals(signals());
    expect(jarGroup()).toBeDefined();
    publishHomeSignals(signals({ label: '' }));
    expect(jarGroup()).toBeUndefined();
  });

  it('survives cleanup-then-republish in one tick without removing the jar', () => {
    setup();
    publishHomeSignals(signals());
    publishHomeSignals(null);
    publishHomeSignals(signals({ fill: 0.6 }));
    flushFrame();
    expect(jarGroup()).toBeDefined();
    expect(meshNamed(jarGroup()!, 'jar-fill').scale.y).toBeCloseTo(0.6, 6);
  });

  it('reads the current signals on subscribe (the store does not replay)', () => {
    publishHomeSignals(signals({ fill: 0.3 }));
    setup();
    expect(jarGroup()).toBeDefined();
    expect(meshNamed(jarGroup()!, 'jar-fill').scale.y).toBeCloseTo(0.3, 6);
  });

  it('follows the fill as Home republishes', () => {
    setup();
    publishHomeSignals(signals({ fill: 0.2 }));
    publishHomeSignals(signals({ fill: 0.5 }));
    expect(meshNamed(jarGroup()!, 'jar-fill').scale.y).toBeCloseTo(0.5, 6);
  });

  it('builds no jar below 1536px wide, on the narrow layout, or when the viewport is too short', () => {
    setup();
    publishHomeSignals(signals());
    mount.place(true, JAR_MIN_WIDTH_PX - 1, 900);
    expect(jarGroup()).toBeUndefined();
    mount.place(false, 1728, 972);
    expect(jarGroup()).toBeUndefined();
    mount.place(true, 1728, JAR_MIN_HEIGHT_PX - 1);
    expect(jarGroup()).toBeUndefined();
    mount.place(true, 1728, 972);
    expect(jarGroup()).toBeDefined();
  });

  it('stops listening after unsubscribe', () => {
    setup();
    off();
    publishHomeSignals(signals());
    expect(jarGroup()).toBeUndefined();
  });

  it('attaches the camera to the scene so a camera-pinned jar is drawn', () => {
    setup();
    expect(camera.parent).toBe(scene);
  });

  it('drops the grain once per grainDue and wakes the loop', () => {
    setup();
    publishHomeSignals(signals({ underBaselineYesterday: true }));
    expect(wake).toHaveBeenCalledTimes(1);
    expect(storage.data.get(GRAIN_DAY_KEY)).toBe('2026-11-05');
    publishHomeSignals(signals({ underBaselineYesterday: true, fill: 0.5 }));
    expect(wake).toHaveBeenCalledTimes(1); // same day: no second grain
    mount.tick(1000);
    mount.tick(1000 + GRAIN_DROP_MS / 2);
    expect(meshNamed(jarGroup()!, 'jar-grain').visible).toBe(true);
  });

  it('drops no grain when yesterday was not under baseline', () => {
    setup();
    publishHomeSignals(signals({ underBaselineYesterday: false }));
    expect(wake).not.toHaveBeenCalled();
    expect(storage.data.size).toBe(0);
  });

  it('never drops the grain under reduced motion, and leaves the day unspent', () => {
    setup(true);
    publishHomeSignals(signals({ underBaselineYesterday: true }));
    expect(wake).not.toHaveBeenCalled();
    expect(storage.data.size).toBe(0);
  });

  it('does not spend the day while the jar is not shown', () => {
    setup();
    mount.place(true, 1200, 900);
    publishHomeSignals(signals({ underBaselineYesterday: true }));
    expect(wake).not.toHaveBeenCalled();
    expect(storage.data.size).toBe(0);
  });

  it('survives blocked storage', () => {
    setup();
    storage.getItem = () => {
      throw new Error('blocked');
    };
    expect(() => publishHomeSignals(signals({ underBaselineYesterday: true }))).not.toThrow();
    expect(wake).not.toHaveBeenCalled();
  });
});

describe('placement', () => {
  it('hides below 1536px wide and below the minimum height', () => {
    expect(jarPlacement(1535, 900)).toBeNull();
    expect(jarPlacement(1536, JAR_MIN_HEIGHT_PX - 1)).toBeNull();
    expect(jarPlacement(1536, JAR_MIN_HEIGHT_PX)).not.toBeNull();
  });

  it.each([
    [1536, 864],
    [1728, 972],
    [1536, 720],
  ])('keeps the jar and its label clear of the column, the lungs and the dock at %ix%i', (vw, vh) => {
    const p = jarPlacement(vw, vh)!;
    expect(p).not.toBeNull();
    const columnRight = 240 + (vw - 240) / 2 + 480; // 15rem sidebar, then the 60rem column centred in the rest
    const labelWidth = Math.min(224, (vw - 1200) / 2 - 32);
    const labelLeft = vw - 24 - labelWidth;
    expect(labelLeft).toBeGreaterThanOrEqual(columnRight);
    expect(p.centreXPx).toBeCloseTo(vw - 24 - labelWidth / 2, 6);
    const jarTop = p.topPx;
    const lungBottom = (lungBottomPercent() / 100) * vh;
    expect(jarTop).toBeGreaterThan(lungBottom);
    const labelBottom = jarTop + p.heightPx + 8 + 20; // gap + one line
    const dockTop = vh - 24 - 56; // right-lg and a ~3.5rem box
    expect(labelBottom).toBeLessThan(dockTop);
  });

  it('sits below the lungs, wholly in the gutter', () => {
    expect(lungBottomPercent()).toBeGreaterThan(lungTopPercent());
    expect(parseFloat(JAR_ANCHOR.top)).toBeGreaterThan(lungBottomPercent());
    expect(JAR_ANCHOR.right).toBe(OVERLAY_ANCHOR.right);
    expect(JAR_ANCHOR.width).toBe(OVERLAY_ANCHOR.width);
    expect(JAR_ANCHOR.labelTop).toContain(`${JAR_HEIGHT_PX + 8}px`); // under the jar, one gap down
  });
});

describe('JarLabelNote', () => {
  const html = renderToStaticMarkup(React.createElement(JarLabelNote, { label: '₹1,234' }));

  it('reads "Kept: <label>" in --text-muted, aria-hidden, from 1536px', () => {
    expect(html).toContain('Kept: ₹1,234');
    expect(html).toContain('var(--text-muted)');
    expect(html).toMatch(/aria-hidden="true"/);
    expect(html).toMatch(/pointer-events:none/);
    expect(html).toMatch(/z-index:2/);
    expect(html).toMatch(/class="[^"]*hidden[^"]*2xl:/);
    expect(html).toContain(`top:${JAR_ANCHOR.labelTop}`);
    expect(html).not.toMatch(COLOUR_LITERAL);
  });

  it('carries only the masked string it is given', () => {
    const masked = renderToStaticMarkup(React.createElement(JarLabelNote, { label: '•••' }));
    expect(masked).toContain('Kept: •••');
  });

  it('hides below the minimum height with the same literal the geometry gate uses', () => {
    expect(html).toContain(`[@media(min-height:${JAR_MIN_HEIGHT_PX}px)]:block`);
  });
});

describe('JarLabel gates', () => {
  it('is enabled only for quiet, non-discreet readers', () => {
    expect(jarLabelEnabled(false, 'quiet')).toBe(true);
    expect(jarLabelEnabled(true, 'quiet')).toBe(false);
    expect(jarLabelEnabled(false, 'full')).toBe(false);
  });

  it('renders nothing on the server (the store is read after mount)', () => {
    expect(renderToStaticMarkup(React.createElement(JarLabel, { intensity: 'quiet' }))).toBe('');
  });

  const src = stripComments(read('scene', 'JarLabel.tsx'));
  it('subscribes like the milestone note: read on subscribe, clear on the next frame', () => {
    expect(src).toMatch(/getHomeSignals\(\)/);
    expect(src).toMatch(/subscribeHomeSignals\(/);
    expect(src).toMatch(/requestAnimationFrame\(/);
    expect(src).toMatch(/cancelAnimationFrame\(/);
  });

  it('shows nothing for an empty label', () => {
    expect(src).toMatch(/label\.length === 0|!label|label === ''/);
  });

  it('uses 2xl, never min-[..], and no colour literals', () => {
    expect(src).not.toMatch(/min-\[/);
    expect(src).not.toMatch(COLOUR_LITERAL);
  });
});

describe('wiring', () => {
  const background = read('SceneBackground.tsx');
  const backdrop = read('SceneBackdrop.tsx');
  const jarSrc = stripComments(read('scene', 'jarMesh.ts'));

  it('mounts the jar for quiet, non-discreet scenes only, and tears it down', () => {
    expect(stripComments(background)).toMatch(/intensity === 'quiet' && !discreet\s*\?\s*mountJar\(/);
    expect(background.match(/mountJar\(/g)).toHaveLength(1);
    expect(background).toMatch(/jar\?\.tick\(/);
    expect(background).toMatch(/jar\?\.place\(/);
    expect(background).toMatch(/jar\?\.retheme\(/);
    expect(background).toMatch(/jar\?\.subscribe\(\)/);
    expect(background).toMatch(/offJar\(\)/);
  });

  it('renders the label from the backdrop', () => {
    expect(backdrop).toMatch(/<JarLabel\s+discreet=\{discreet\}\s+intensity=\{intensity\}\s*\/>/);
  });

  it('keeps SceneBackground.tsx at 400 lines or fewer', () => {
    expect(background.split('\n').length).toBeLessThanOrEqual(401); // trailing newline
  });

  it('has no colour literals in jarMesh.ts and takes its colours from the tokens', () => {
    expect(jarSrc).not.toMatch(COLOUR_LITERAL);
    expect(jarSrc).toMatch(/tokens?\.accent|t\.accent/);
  });
});

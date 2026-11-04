'use client';

/*
 * SceneBackground — a deferred, tokenized WebGL ambient scene pinned to the
 * viewport: a pair of glass lungs that breathe slowly, a grey haze that clears
 * the longer the reader stays, and (brand surfaces only) a faint terracotta
 * no-smoking sign. Reconciled to the brand:
 *   - three.js (+ its bundled addons) is loaded LAZILY inside the mount effect
 *     so it lands in a separate async chunk and never blocks first paint / LCP.
 *   - Every colour comes from the live CSS-var tokens (--bg, --text-muted,
 *     --accent, --warn-earth) via scene/tokens.ts and is re-resolved on a theme
 *     flip (next-themes). No colour literals live in the scene.
 *   - Geometry, haze and the sign are built in scene/*.ts; the pure maths
 *     (breath, haze density, lobe shape, airway tree) is unit-tested there.
 *   - `position: fixed` so it stays put and keeps animating while the page
 *     scrolls over it (content rides a translucent veil above it — see callers).
 *   - `intensity` picks the tier:
 *       'full'  (brand: homepage, login) — full opacity, bloom, the sign.
 *       'quiet' (product: app pages)     — dimmed, NO bloom pass, no sign.
 *   - `discreet` shows only a neutral haze: no lungs, airways or sign.
 *   - Renders nothing under prefers-reduced-motion or when WebGL is unavailable
 *     (progressive enhancement); pauses its RAF loop when the tab is hidden or
 *     the reader has been idle.
 *
 * The canvas is aria-hidden and pointer-events:none; it is pure atmosphere.
 */

import * as React from 'react';
import type * as THREE_NS from 'three'; // type-only: erased at build, no runtime cost

import {
  frameIntervalFor,
  hazeCountFor,
  pickSceneTier,
  SCENE_BUDGET,
  type SceneIntensity,
} from '@web/lib/sceneTier';

import { BLOOM_BREATH_LIFT, BLOOM_STRENGTH, buildBloom, type BloomPassLike, type Composer } from './scene/bloom';
import { createAirwayLight } from './scene/airwayLight';
import { breathPhase, breathScale, hazeDensity } from './scene/breath';
import { DisposeBin } from './scene/disposables';
import { readSceneEnv, sessionClearStart } from './scene/env';
import { buildHaze } from './scene/haze';
import { LAYOUT, NARROW_ASPECT } from './scene/layout';
import { buildLungs } from './scene/lungMeshes';
import { subscribeAirwayLight } from './scene/sceneSignals';
import { buildSign } from './scene/signMesh';
import { readTokens } from './scene/tokens';

const IDLE_PAUSE_MS = 20_000; // stop drawing after this long with no user input
const IDLE_CHECK_MS = 2_000;
const LIGHT_ENV_INTENSITY = 0.25;
const MAX_FRAME_DT_S = 0.1; // a long stall never makes the haze jump

export type { SceneIntensity };

export interface SceneBackgroundProps {
  /** 'full' = brand (opacity + bloom + sign); 'quiet' = product (dim, no bloom). Default 'full'. */
  intensity?: SceneIntensity;
  /** Neutral haze only: no lungs, airways or sign. Default false. */
  discreet?: boolean;
  lastSmokeIso?: string | null; // newest log (ISO); the overlay reads it, the scene ignores it
}

function hasWebGL(): boolean {
  try {
    const c = document.createElement('canvas');
    const gl = (c.getContext('webgl') || c.getContext('experimental-webgl')) as WebGLRenderingContext | null;
    // Release the probe context right away — browsers cap live WebGL contexts.
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
    return !!(window.WebGLRenderingContext && gl);
  } catch {
    return false;
  }
}

export function SceneBackground({ intensity = 'full', discreet = false }: SceneBackgroundProps) {
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.style.visibility = ''; // undo a previous shutDown (intensity changed)
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (reduce.matches || !hasWebGL()) return;
    const tier = pickSceneTier(readSceneEnv());
    if (tier === 'off') return; // data-saver: static page background only
    const budget = SCENE_BUDGET[tier];

    const baseDim = intensity === 'quiet' ? 0.55 : 1; // opacity tier
    const useBloom = intensity === 'full' && budget.bloom; // boldness reserved for brand surfaces on capable devices
    const showSign = intensity === 'full' && !discreet;

    let disposed = false;
    let cleanup = () => {};
    // Hoisted so a build that throws part-way can still free what it made.
    const bin = new DisposeBin();
    let rendererToDispose: { dispose(): void } | null = null;

    // Resolve ALL dynamic imports up front, THEN build — so an unmount between
    // awaits can never leak a half-constructed renderer. three + its addons all
    // ship in the `three` package (no extra npm dependency) and land in the
    // deferred async chunk.
    void (async () => {
      const THREE = await import('three');
      const { RoomEnvironment } = await import('three/examples/jsm/environments/RoomEnvironment.js');
      const { mergeVertices } = await import('three/examples/jsm/utils/BufferGeometryUtils.js');
      const bloomKit = useBloom
        ? await Promise.all([
            import('three/examples/jsm/postprocessing/EffectComposer.js'),
            import('three/examples/jsm/postprocessing/RenderPass.js'),
            import('three/examples/jsm/postprocessing/UnrealBloomPass.js'),
          ])
        : null;
      if (disposed || !canvasRef.current) return;

      const tokens = readTokens(THREE);

      const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
      rendererToDispose = renderer;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, budget.dprCap));
      renderer.setSize(window.innerWidth, window.innerHeight, false); // false: CSS keeps 100%/100%
      // UnrealBloomPass requires tone mapping — without it, any pixel the
      // additive bloom composite pushes past 1.0 hard-clips to pure white
      // instead of compressing softly, reading harsher than the restrained
      // brand intends and eating into text contrast headroom.
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.0;

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 200);
      camera.position.set(0, 0, 22);

      // Real environment map → the glass actually reflects/refracts. Computed
      // once (PMREM), cheap thereafter. The RoomEnvironment scene itself is
      // only a one-shot bake source — dispose it right after so its ~10 box
      // geometries/materials don't linger.
      const pmrem = bin.track(new THREE.PMREMGenerator(renderer));
      const roomEnv = new RoomEnvironment();
      const envRT = bin.track(pmrem.fromScene(roomEnv, 0.04));
      roomEnv.dispose();
      scene.environment = envRT.texture;

      const currentBg = tokens.bg.clone();
      const targetBg = tokens.bg.clone();
      scene.fog = new THREE.Fog(currentBg.getHex(), 18, 46);
      // Paint the page colour behind the scene. A transparent canvas composites as black, which on
      // the light theme made ink sit on a dark ground (and the 85% page veil turned it grey).
      scene.background = currentBg;
      let isLight = false;

      // Lighting — soft ambient + key + accent rim + a faint terracotta fill.
      const ambient = new THREE.AmbientLight(undefined, 0.55);
      const key = new THREE.DirectionalLight(undefined, 0.9);
      key.position.set(6, 10, 12);
      const rim = new THREE.PointLight(tokens.accent, 2.4, 60);
      rim.position.set(10, -4, 6);
      const warm = new THREE.PointLight(tokens.warn, 0.6, 60);
      warm.position.set(-14, 6, 4);
      scene.add(ambient, key, rim, warm);

      // The chest, the haze and the sign. Discreet keeps only the haze.
      const lungs = discreet ? null : buildLungs(THREE, bin, tokens, budget, mergeVertices, intensity, tier);
      const haze = buildHaze(THREE, bin, hazeCountFor(budget, intensity === 'quiet'), discreet, tokens);
      const sign = showSign ? buildSign(THREE, bin, tokens) : null;
      const world = new THREE.Group(); // lungs + haze share the placement
      world.add(haze.points);
      if (lungs) world.add(lungs.group);
      scene.add(world);
      if (sign) scene.add(sign.group);

      // Layout: right and back on desktop, centred and dimmer on narrow screens.
      let layout = LAYOUT.wide;
      const applyLayout = (): boolean => {
        const next = window.innerWidth / window.innerHeight < NARROW_ASPECT ? LAYOUT.narrow : LAYOUT.wide;
        const changed = next !== layout;
        layout = next;
        world.position.set(...layout.lungs);
        world.scale.setScalar(layout.lungScale);
        sign?.group.position.set(...layout.sign);
        sign?.group.scale.setScalar(layout.signScale);
        return changed;
      };
      applyLayout();

      // One path resolves every token: first build, theme flip, layout change.
      const applyTheme = () => {
        const t = readTokens(THREE);
        const dim = baseDim * layout.dim;
        isLight = t.isLight;
        targetBg.copy(t.bg);
        rim.color.copy(t.accent);
        warm.color.copy(t.warn);
        // The bright room env would wash dark ink out to white on the light theme.
        // Dark fog melts distant shapes into the page; pale fog would bleach their ink, so thin it out.
        const fog = scene.fog as THREE_NS.Fog;
        fog.near = t.isLight ? 50 : 18;
        fog.far = t.isLight ? 140 : 46;
        scene.environmentIntensity = t.isLight ? LIGHT_ENV_INTENSITY : 1;
        ambient.intensity = t.isLight ? 0.4 : 0.55;
        key.intensity = t.isLight ? 0.5 : 0.9;
        lungs?.retheme(t, dim);
        haze.retheme(t, dim);
        sign?.retheme(t, dim);
      };
      applyTheme();
      // next-themes flips the <html> class in its own effect, after any child effect has
      // run, so a [resolvedTheme] effect would read the OLD tokens. Watch the class itself.
      const themeObserver = new MutationObserver(applyTheme);
      themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

      // Postprocessing — bloom on brand surfaces only. Product renders direct.
      const bloom = bloomKit ? buildBloom(THREE, bloomKit, renderer, scene, camera) : null;
      const composer: Composer | null = bloom?.composer ?? null;
      const bloomPass: BloomPassLike | null = bloom?.bloomPass ?? null;

      // Interaction + responsiveness.
      let mouseX = 0;
      let mouseY = 0;
      const onMouse = (e: MouseEvent) => {
        mouseX = (e.clientX / window.innerWidth - 0.5) * 2;
        mouseY = (e.clientY / window.innerHeight - 0.5) * 2;
      };
      // Coalesced to one resize per frame: mobile address-bar show/hide fires a
      // burst of resize events while scrolling; each one would reallocate buffers.
      let resizeRaf = 0;
      const onResize = () => {
        if (resizeRaf) return;
        resizeRaf = requestAnimationFrame(() => {
          resizeRaf = 0;
          camera.aspect = window.innerWidth / window.innerHeight;
          camera.updateProjectionMatrix();
          renderer.setSize(window.innerWidth, window.innerHeight, false);
          composer?.setSize(window.innerWidth, window.innerHeight);
          if (applyLayout()) applyTheme(); // dim differs between layouts
        });
      };
      if (budget.parallax) window.addEventListener('mousemove', onMouse, { passive: true });
      window.addEventListener('resize', onResize);

      // Run loop with a single pause gate: tab hidden. (No offscreen pause — the
      // scene is a fixed backdrop that must keep living through the whole scroll.)
      const clearStartMs = sessionClearStart();
      // A newly reached milestone lights the airways once (never under reduced motion).
      const light = createAirwayLight((level) => lungs?.setAirwayGlow(level));
      const offLight = lungs
        ? subscribeAirwayLight(() => reduce.matches || light.start(performance.now()))
        : () => {};
      let raf = 0;
      let running = true;
      let clockStart = performance.now();
      let elapsed = 0;
      let lastDraw = 0;
      const frameIntervalMs = frameIntervalFor({ intensity, budget });

      const frame = () => {
        if (!running) return;
        const now = performance.now();
        if (frameIntervalMs && now - lastDraw < frameIntervalMs) {
          raf = requestAnimationFrame(frame);
          return;
        }
        lastDraw = now;
        const dt = Math.min((now - clockStart) / 1000, MAX_FRAME_DT_S);
        elapsed += dt;
        clockStart = now;
        const t = elapsed;

        currentBg.lerp(targetBg, 0.05);
        (scene.fog as THREE_NS.Fog).color.copy(currentBg);

        // Slow breath (no spring), haze thinning with session time, a gentle sway.
        lungs?.setBreath(breathScale(t));
        light.tick(now);
        haze.update(dt, t, hazeDensity((Date.now() - clearStartMs) / 1000));
        world.rotation.y = Math.sin(t * 0.07) * 0.3;
        if (sign) sign.group.rotation.y = t * 0.15;
        // A pale page would bloom everywhere, so the glow is a dark-theme effect.
        if (bloomPass) bloomPass.strength = isLight ? 0 : BLOOM_STRENGTH + BLOOM_BREATH_LIFT * ((breathPhase(t) + 1) / 2);

        // Mouse parallax + a very slow gravitational camera orbit (no spring).
        const orbitX = Math.sin(t * 0.04) * 1.6;
        const orbitY = Math.cos(t * 0.05) * 1.0;
        camera.position.x += (mouseX * 3 + orbitX - camera.position.x) * 0.03;
        camera.position.y += (-mouseY * 2 + orbitY - camera.position.y) * 0.03;
        camera.lookAt(layout.lookX, 0, -8);

        // The bloom blit tone-maps the page colour too; light has no bloom, so it renders direct.
        if (composer && !isLight) composer.render();
        else renderer.render(scene, camera);
        raf = requestAnimationFrame(frame);
      };
      const start = () => {
        if (running && raf) return;
        running = true;
        clockStart = performance.now();
        raf = requestAnimationFrame(frame);
      };
      const stop = () => {
        running = false;
        if (raf) cancelAnimationFrame(raf);
        raf = 0;
      };
      start();

      // Two independent reasons to stand still: tab hidden, or no input for a while.
      // The scene is a decorative backdrop — nothing is lost by freezing it.
      let idle = false;
      let lastInput = performance.now();
      const sync = () => (document.hidden || idle ? stop() : start());
      const wake = () => {
        lastInput = performance.now();
        if (idle) {
          idle = false;
          sync();
        }
      };
      const idleTimer = window.setInterval(() => {
        if (!idle && performance.now() - lastInput > IDLE_PAUSE_MS) {
          idle = true;
          sync();
        }
      }, IDLE_CHECK_MS);
      const WAKE_EVENTS = ['pointermove', 'pointerdown', 'keydown', 'scroll', 'touchstart'] as const;
      for (const ev of WAKE_EVENTS) window.addEventListener(ev, wake, { passive: true });
      const onVisibility = () => sync();
      document.addEventListener('visibilitychange', onVisibility);

      // Blank the canvas for good (reduced-motion turned on, or the GPU context was lost).
      // ponytail: stays off until the next mount/navigation; add re-init if users toggle often.
      const shutDown = () => {
        cleanup();
        cleanup = () => {};
        canvas.style.visibility = 'hidden';
      };
      const onReduceChange = (e: MediaQueryListEvent) => {
        if (e.matches) shutDown();
      };
      const onContextLost = (e: Event) => {
        e.preventDefault();
        shutDown();
      };
      reduce.addEventListener('change', onReduceChange);
      canvas.addEventListener('webglcontextlost', onContextLost);
      // The preference may have flipped while three.js was still loading.
      if (reduce.matches) queueMicrotask(shutDown); // after `cleanup` is assigned below

      cleanup = () => {
        stop();
        if (budget.parallax) window.removeEventListener('mousemove', onMouse);
        window.removeEventListener('resize', onResize);
        cancelAnimationFrame(resizeRaf);
        document.removeEventListener('visibilitychange', onVisibility);
        window.clearInterval(idleTimer);
        for (const ev of WAKE_EVENTS) window.removeEventListener(ev, wake);
        reduce.removeEventListener('change', onReduceChange);
        canvas.removeEventListener('webglcontextlost', onContextLost);
        themeObserver.disconnect();
        offLight();
        composer?.dispose();
        bloomPass?.dispose?.();
        bin.disposeAll(); // every geometry, material, texture, env map and PMREM the scene built
        renderer.dispose();
      };
    })().catch(() => {
      // A throwing build must not leak the renderer or reject unhandled: free it, blank the canvas.
      cleanup();
      bin.disposeAll();
      rendererToDispose?.dispose();
      canvas.style.visibility = 'hidden';
    });

    return () => {
      disposed = true;
      cleanup();
    };
  }, [intensity, discreet]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      style={{
        position: 'fixed',
        inset: 0,
        width: '100%',
        height: '100%',
        zIndex: 0,
        pointerEvents: 'none',
      }}
    />
  );
}

export default SceneBackground;

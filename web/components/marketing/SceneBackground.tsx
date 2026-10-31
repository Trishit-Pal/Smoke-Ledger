'use client';

/*
 * SceneBackground — a deferred, tokenized WebGL ambient scene pinned to the
 * viewport. Reconciled to the brand:
 *   - three.js (+ its bundled addons) is loaded LAZILY inside the mount effect
 *     so it lands in a separate async chunk and never blocks first paint / LCP.
 *   - Colors read from the live CSS-var tokens (--accent, --bg) at construction.
 *     Only --bg/fog resyncs live on theme flip (next-themes) today — --accent
 *     is currently identical in both themes, so accent-derived materials
 *     (glass/knot/particles/rim light) don't need to; wire a resync for those
 *     too if --accent ever becomes theme-dependent.
 *   - Refractive glass shards (now with a real environment map for genuine
 *     reflection/refraction) + a faint wireframe knot + additive particle haze
 *     + mouse parallax + a very slow camera orbit. No low-poly human figures.
 *   - `position: fixed` so it stays put and keeps animating while the page
 *     scrolls over it (content rides a translucent veil above it — see callers).
 *   - `intensity` picks the tier:
 *       'full'  (brand: homepage, login) — full opacity + UnrealBloom glow.
 *       'quiet' (product: app pages)     — dimmed opacity, NO bloom pass
 *                                          (direct render → also cheaper).
 *   - Renders nothing under prefers-reduced-motion or when WebGL is unavailable
 *     (progressive enhancement); pauses its RAF loop only when the tab is hidden.
 *
 * The canvas is aria-hidden and pointer-events:none; it is pure atmosphere.
 */

import * as React from 'react';
import { useTheme } from 'next-themes';
import type * as THREE_NS from 'three'; // type-only: erased at build, no runtime cost

import { pickSceneTier, SCENE_BUDGET, type SceneEnv } from '@web/lib/sceneTier';

const IDLE_PAUSE_MS = 20_000; // stop drawing after this long with no user input
const IDLE_CHECK_MS = 2_000;

export type SceneIntensity = 'full' | 'quiet';

export interface SceneBackgroundProps {
  /** 'full' = brand (opacity + bloom); 'quiet' = product (dim, no bloom). Default 'full'. */
  intensity?: SceneIntensity;
}

function readVar(name: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
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

function readSceneEnv(): SceneEnv {
  const nav = navigator as Navigator & {
    deviceMemory?: number;
    connection?: { saveData?: boolean };
  };
  return {
    coarsePointer: window.matchMedia('(pointer: coarse)').matches,
    hardwareConcurrency: nav.hardwareConcurrency,
    deviceMemory: nav.deviceMemory,
    saveData: nav.connection?.saveData,
  };
}

export function SceneBackground({ intensity = 'full' }: SceneBackgroundProps) {
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const { resolvedTheme } = useTheme();
  // Set by the scene once mounted so the theme effect can retarget the fog color.
  const setBgTargetRef = React.useRef<((hex: string) => void) | null>(null);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.style.visibility = ''; // undo a previous shutDown (intensity changed)
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (reduce.matches || !hasWebGL()) return;
    const tier = pickSceneTier(readSceneEnv());
    if (tier === 'off') return; // data-saver: static page background only
    const budget = SCENE_BUDGET[tier];
    const GLASS_COUNT = budget.shards;
    const PARTICLE_COUNT = budget.particles;

    const dim = intensity === 'quiet' ? 0.55 : 1; // opacity tier
    const useBloom = intensity === 'full' && budget.bloom; // boldness reserved for brand surfaces on capable devices

    let disposed = false;
    let cleanup = () => {};

    // Resolve ALL dynamic imports up front, THEN build — so an unmount between
    // awaits can never leak a half-constructed renderer. three + its addons all
    // ship in the `three` package (no extra npm dependency) and land in the
    // deferred async chunk.
    void (async () => {
      const THREE = await import('three');
      const { RoomEnvironment } = await import('three/examples/jsm/environments/RoomEnvironment.js');
      const bloomKit = useBloom
        ? await Promise.all([
            import('three/examples/jsm/postprocessing/EffectComposer.js'),
            import('three/examples/jsm/postprocessing/RenderPass.js'),
            import('three/examples/jsm/postprocessing/UnrealBloomPass.js'),
          ])
        : null;
      if (disposed || !canvasRef.current) return;

      const accent = new THREE.Color(readVar('--accent', '#2FA39B'));
      const bg = new THREE.Color(readVar('--bg', '#0B0F14'));

      const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, budget.dprCap));
      renderer.setSize(window.innerWidth, window.innerHeight);
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
      const pmrem = new THREE.PMREMGenerator(renderer);
      const roomEnv = new RoomEnvironment();
      const envRT = pmrem.fromScene(roomEnv, 0.04);
      roomEnv.dispose();
      scene.environment = envRT.texture;

      const currentBg = bg.clone();
      const targetBg = bg.clone();
      scene.fog = new THREE.Fog(currentBg.getHex(), 18, 46);
      setBgTargetRef.current = (hex: string) => targetBg.set(hex);

      // Lighting — key + accent rim + a faint warm fill.
      scene.add(new THREE.AmbientLight(0x8899aa, 0.55));
      const key = new THREE.DirectionalLight(0xffffff, 0.9);
      key.position.set(6, 10, 12);
      scene.add(key);
      const rim = new THREE.PointLight(accent.getHex(), 2.4, 60);
      rim.position.set(10, -4, 6);
      scene.add(rim);
      const warm = new THREE.PointLight(0xffb26b, 0.6, 60);
      warm.position.set(-14, 6, 4);
      scene.add(warm);

      const geos: THREE_NS.BufferGeometry[] = [];
      const mats: THREE_NS.Material[] = [];

      // Refractive glass shards — biased to the right so they clear the (centered,
      // left-leaning) hero text, protecting contrast.
      const glassGeo = new THREE.IcosahedronGeometry(1, 0);
      geos.push(glassGeo);
      const glass: THREE_NS.Mesh[] = [];
      for (let i = 0; i < GLASS_COUNT; i++) {
        const mat = new THREE.MeshPhysicalMaterial({
          color: accent,
          roughness: 0.12,
          metalness: 0.05,
          transmission: 0.9,
          thickness: 1.4,
          ior: 1.3,
          envMapIntensity: 1.1,
          transparent: true,
          opacity: 0.42 * dim,
          clearcoat: 1,
          clearcoatRoughness: 0.1,
        });
        mats.push(mat);
        const mesh = new THREE.Mesh(glassGeo, mat);
        const s = THREE.MathUtils.randFloat(0.5, 1.6);
        mesh.scale.setScalar(s);
        mesh.position.set(
          THREE.MathUtils.randFloatSpread(30) + 6,
          THREE.MathUtils.randFloatSpread(20),
          THREE.MathUtils.randFloatSpread(14) - 6,
        );
        mesh.userData.speed = THREE.MathUtils.randFloat(0.2, 0.6);
        mesh.userData.offset = Math.random() * Math.PI * 2;
        scene.add(mesh);
        glass.push(mesh);
      }

      // Faint wireframe knot — the "journey" motif, kept very low opacity.
      const knotGeo = new THREE.TorusKnotGeometry(6, 1.3, 140, 16);
      const knotMat = new THREE.MeshBasicMaterial({ color: accent, wireframe: true, transparent: true, opacity: 0.06 * dim });
      geos.push(knotGeo);
      mats.push(knotMat);
      const knot = new THREE.Mesh(knotGeo, knotMat);
      knot.position.set(13, 2, -18);
      scene.add(knot);

      // Additive particle haze.
      const positions = new Float32Array(PARTICLE_COUNT * 3);
      const speeds = new Float32Array(PARTICLE_COUNT);
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        positions[i * 3 + 0] = THREE.MathUtils.randFloatSpread(60);
        positions[i * 3 + 1] = THREE.MathUtils.randFloatSpread(40) - 10;
        positions[i * 3 + 2] = THREE.MathUtils.randFloatSpread(30) - 10;
        speeds[i] = THREE.MathUtils.randFloat(0.01, 0.045);
      }
      const particleGeo = new THREE.BufferGeometry();
      particleGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geos.push(particleGeo);

      const spriteSize = 64;
      const spriteCanvas = document.createElement('canvas');
      spriteCanvas.width = spriteCanvas.height = spriteSize;
      const sctx = spriteCanvas.getContext('2d');
      if (sctx) {
        const grad = sctx.createRadialGradient(spriteSize / 2, spriteSize / 2, 0, spriteSize / 2, spriteSize / 2, spriteSize / 2);
        grad.addColorStop(0, 'rgba(255,255,255,0.9)');
        grad.addColorStop(0.4, 'rgba(255,255,255,0.35)');
        grad.addColorStop(1, 'rgba(255,255,255,0)');
        sctx.fillStyle = grad;
        sctx.fillRect(0, 0, spriteSize, spriteSize);
      }
      const spriteTex = new THREE.CanvasTexture(spriteCanvas);
      const particleMat = new THREE.PointsMaterial({
        size: 0.32,
        map: spriteTex,
        transparent: true,
        opacity: 0.28 * dim,
        color: accent.clone().lerp(new THREE.Color('#ffffff'), 0.4),
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      mats.push(particleMat);
      const particles = new THREE.Points(particleGeo, particleMat);
      scene.add(particles);

      // Postprocessing — bloom on brand surfaces only. Product renders direct.
      // EffectComposer is a three addon (not in the core types), so type it
      // structurally by the members we use.
      type Composer = {
        render: () => void;
        setSize: (w: number, h: number) => void;
        dispose: () => void;
        addPass: (pass: unknown) => void;
      };
      let composer: Composer | null = null;
      let bloomPass: { dispose?: () => void } | null = null;
      if (bloomKit) {
        // Degrade to a plain direct render if the composer can't be built on
        // this GPU, rather than blanking the whole scene.
        try {
          const [{ EffectComposer }, { RenderPass }, { UnrealBloomPass }] = bloomKit;
          const c = new EffectComposer(renderer) as unknown as Composer;
          c.addPass(new RenderPass(scene, camera));
          const bp = new UnrealBloomPass(
            new THREE.Vector2(window.innerWidth, window.innerHeight),
            0.65, // strength
            0.85, // radius
            0.82, // threshold — only the brightest accents/particles glow
          );
          c.addPass(bp);
          composer = c;
          bloomPass = bp as unknown as { dispose?: () => void };
        } catch {
          composer = null;
          bloomPass = null;
        }
      }

      // Interaction + responsiveness.
      let mouseX = 0;
      let mouseY = 0;
      const onMouse = (e: MouseEvent) => {
        mouseX = (e.clientX / window.innerWidth - 0.5) * 2;
        mouseY = (e.clientY / window.innerHeight - 0.5) * 2;
      };
      const onResize = () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
        composer?.setSize(window.innerWidth, window.innerHeight);
      };
      if (budget.parallax) window.addEventListener('mousemove', onMouse, { passive: true });
      window.addEventListener('resize', onResize);

      // Run loop with a single pause gate: tab hidden. (No offscreen pause — the
      // scene is a fixed backdrop that must keep living through the whole scroll.)
      let raf = 0;
      let running = true;
      let clockStart = performance.now();
      let elapsed = 0;
      let lastDraw = 0;

      const frame = () => {
        if (!running) return;
        const now = performance.now();
        if (budget.frameIntervalMs && now - lastDraw < budget.frameIntervalMs) {
          raf = requestAnimationFrame(frame);
          return;
        }
        lastDraw = now;
        elapsed += (now - clockStart) / 1000;
        clockStart = now;
        const t = elapsed;

        currentBg.lerp(targetBg, 0.05);
        (scene.fog as THREE_NS.Fog).color.copy(currentBg);

        for (const m of glass) {
          const sp = m.userData.speed as number;
          const off = m.userData.offset as number;
          m.rotation.x = t * 0.15 * sp + off;
          m.rotation.y = t * 0.2 * sp;
          m.position.y += Math.sin(t * sp + off) * 0.004;
        }
        knot.rotation.x = t * 0.05;
        knot.rotation.y = t * 0.07;

        const arr = particleGeo.attributes.position.array as Float32Array;
        for (let i = 0; i < PARTICLE_COUNT; i++) {
          arr[i * 3 + 1] += speeds[i];
          if (arr[i * 3 + 1] > 20) arr[i * 3 + 1] = -20;
        }
        particleGeo.attributes.position.needsUpdate = true;

        // Mouse parallax + a very slow gravitational camera orbit (no spring).
        const orbitX = Math.sin(t * 0.04) * 1.6;
        const orbitY = Math.cos(t * 0.05) * 1.0;
        camera.position.x += (mouseX * 3 + orbitX - camera.position.x) * 0.03;
        camera.position.y += (-mouseY * 2 + orbitY - camera.position.y) * 0.03;
        camera.lookAt(4, 0, -8);

        if (composer) composer.render();
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
        document.removeEventListener('visibilitychange', onVisibility);
        window.clearInterval(idleTimer);
        for (const ev of WAKE_EVENTS) window.removeEventListener(ev, wake);
        reduce.removeEventListener('change', onReduceChange);
        canvas.removeEventListener('webglcontextlost', onContextLost);
        setBgTargetRef.current = null;
        composer?.dispose();
        bloomPass?.dispose?.();
        envRT.dispose();
        pmrem.dispose();
        spriteTex.dispose();
        for (const g of geos) g.dispose();
        for (const m of mats) m.dispose();
        renderer.dispose();
      };
    })();

    return () => {
      disposed = true;
      cleanup();
    };
  }, [intensity]);

  // Retarget the fog/background color when the theme flips (accent is theme-stable).
  React.useEffect(() => {
    setBgTargetRef.current?.(readVar('--bg', '#0B0F14'));
  }, [resolvedTheme]);

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

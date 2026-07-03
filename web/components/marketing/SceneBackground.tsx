'use client';

/*
 * SceneBackground — a deferred, tokenized WebGL ambient scene pinned to the
 * viewport. Reconciled to the brand:
 *   - three.js is loaded LAZILY (`await import('three')` inside the mount effect)
 *     so it lands in a separate async chunk and never blocks first paint / LCP.
 *   - Colors read from the live CSS-var tokens (--accent, --bg), so the scene
 *     matches the theme and recolors when it flips (via next-themes).
 *   - Refractive glass shards + a faint wireframe knot + additive particle haze
 *     + mouse parallax. No low-poly human figures.
 *   - `position: fixed` so it stays put and keeps animating while the page
 *     scrolls over it (content rides a translucent veil above it — see callers).
 *   - `intensity` scales the scene's opacities down for a quieter presence on
 *     product (task-focused) pages vs the marketing homepage.
 *   - Renders nothing under prefers-reduced-motion or when WebGL is unavailable
 *     (progressive enhancement); pauses its RAF loop only when the tab is hidden.
 *
 * The canvas is aria-hidden and pointer-events:none; it is pure atmosphere.
 */

import * as React from 'react';
import { useTheme } from 'next-themes';
import type * as THREE_NS from 'three'; // type-only: erased at build, no runtime cost

const GLASS_COUNT = 7;
const PARTICLE_COUNT = 500;

export type SceneIntensity = 'full' | 'quiet';

export interface SceneBackgroundProps {
  /** Scales scene opacity down for calmer product-page presence. Default 'full'. */
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
    return !!(window.WebGLRenderingContext && (c.getContext('webgl') || c.getContext('experimental-webgl')));
  } catch {
    return false;
  }
}

export function SceneBackground({ intensity = 'full' }: SceneBackgroundProps) {
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const { resolvedTheme } = useTheme();
  // Set by the scene once mounted so the theme effect can retarget the fog color.
  const setBgTargetRef = React.useRef<((hex: string) => void) | null>(null);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (reduce.matches || !hasWebGL()) return;

    // Quieter presence on product pages: dim every layer's opacity.
    const dim = intensity === 'quiet' ? 0.55 : 1;

    let disposed = false;
    let cleanup = () => {};

    // Defer the heavy lib: this import is a separate async chunk fetched after
    // hydration, so it never sits on the LCP path.
    void import('three').then((THREE) => {
      if (disposed || !canvasRef.current) return;

      const accent = new THREE.Color(readVar('--accent', '#2FA39B'));
      const bg = new THREE.Color(readVar('--bg', '#0B0F14'));

      const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setSize(window.innerWidth, window.innerHeight);

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 200);
      camera.position.set(0, 0, 22);

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
          roughness: 0.15,
          metalness: 0.05,
          transmission: 0.85,
          thickness: 1.2,
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
      };
      window.addEventListener('mousemove', onMouse, { passive: true });
      window.addEventListener('resize', onResize);

      // Run loop with a single pause gate: tab hidden. (No offscreen pause — the
      // scene is a fixed backdrop that must keep living through the whole scroll.)
      let raf = 0;
      let running = true;
      let clockStart = performance.now();
      let elapsed = 0;

      const frame = () => {
        if (!running) return;
        const now = performance.now();
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

        camera.position.x += (mouseX * 3 - camera.position.x) * 0.03;
        camera.position.y += (-mouseY * 2 - camera.position.y) * 0.03;
        camera.lookAt(4, 0, -8);

        renderer.render(scene, camera);
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

      const onVisibility = () => (document.hidden ? stop() : start());
      document.addEventListener('visibilitychange', onVisibility);

      cleanup = () => {
        stop();
        window.removeEventListener('mousemove', onMouse);
        window.removeEventListener('resize', onResize);
        document.removeEventListener('visibilitychange', onVisibility);
        setBgTargetRef.current = null;
        spriteTex.dispose();
        for (const g of geos) g.dispose();
        for (const m of mats) m.dispose();
        renderer.dispose();
      };
    });

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

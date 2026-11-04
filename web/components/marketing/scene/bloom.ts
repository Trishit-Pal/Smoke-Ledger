import type * as THREE_NS from 'three';

import type { ThreeNs } from './tokens';

// EffectComposer is a three addon (not in the core types), so type it
// structurally by the members we use.
export interface Composer {
  render: () => void;
  setSize: (w: number, h: number) => void;
  dispose: () => void;
  addPass: (pass: unknown) => void;
}

export interface BloomPassLike {
  strength: number;
  dispose?: () => void;
}

export type BloomKit = [
  typeof import('three/examples/jsm/postprocessing/EffectComposer.js'),
  typeof import('three/examples/jsm/postprocessing/RenderPass.js'),
  typeof import('three/examples/jsm/postprocessing/UnrealBloomPass.js'),
];

export const BLOOM_STRENGTH = 0.65;
/** Bloom swells by this much at the top of the inhale. */
export const BLOOM_BREATH_LIFT = 0.12;

/**
 * Bloom on brand surfaces only. Degrades to null (a plain direct render) if
 * the composer can't be built on this GPU, rather than blanking the scene.
 */
export function buildBloom(
  THREE: ThreeNs,
  kit: BloomKit,
  renderer: THREE_NS.WebGLRenderer,
  scene: THREE_NS.Scene,
  camera: THREE_NS.Camera,
): { composer: Composer; bloomPass: BloomPassLike } | null {
  try {
    const [{ EffectComposer }, { RenderPass }, { UnrealBloomPass }] = kit;
    const composer = new EffectComposer(renderer) as unknown as Composer;
    composer.addPass(new RenderPass(scene, camera));
    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      BLOOM_STRENGTH,
      0.85, // radius
      0.82, // threshold: only the brightest accents glow
    ) as unknown as BloomPassLike;
    composer.addPass(bloomPass);
    return { composer, bloomPass };
  } catch {
    return null;
  }
}

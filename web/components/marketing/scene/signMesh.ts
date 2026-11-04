import type * as THREE_NS from 'three';

import type { DisposeBin } from './disposables';
import { signParts } from './sign';
import type { SceneTokens, ThreeNs } from './tokens';

export interface SignMesh {
  /** Unit-radius sign in the XY plane; the caller places, scales and turns it. */
  group: THREE_NS.Group;
  retheme(tokens: SceneTokens, dim: number): void;
}

const SIGN_OPACITY = 0.5;
export const SIGN_OPACITY_LIGHT = 0.5; // same as dark: any more drops muted text over the ring below AA (0.8 measured 4.48:1)
/** Keep the satin colour under the bloom threshold so the sign never glows. */
const BLOOM_HEADROOM = 0.8;

/** The no-smoking sign: a ring and a slash, in satin terracotta. Full strength only. */
export function buildSign(THREE: ThreeNs, bin: DisposeBin, tokens: SceneTokens): SignMesh {
  const { ring, bar } = signParts();
  const mat = bin.track(
    new THREE.MeshStandardMaterial({
      roughness: 0.45,
      metalness: 0.1,
      transparent: true,
      depthWrite: false,
    }),
  );
  const group = new THREE.Group();
  group.add(new THREE.Mesh(bin.track(new THREE.TorusGeometry(ring.radius, ring.tube, 16, 64)), mat));
  const slash = new THREE.Mesh(bin.track(new THREE.BoxGeometry(bar.length, bar.thickness, bar.thickness)), mat);
  slash.rotation.z = -bar.angleRad; // top-left to bottom-right, as on the real sign
  group.add(slash);

  const retheme = (t: SceneTokens, dim: number) => {
    mat.color.copy(t.warn).multiplyScalar(BLOOM_HEADROOM);
    mat.opacity = (t.isLight ? SIGN_OPACITY_LIGHT : SIGN_OPACITY) * dim;
  };
  retheme(tokens, 1);
  return { group, retheme };
}

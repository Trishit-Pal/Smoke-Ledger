import type * as THREE_NS from 'three';

import { lobeTransmission, type SceneBudget, type SceneIntensity, type SceneTier } from '@web/lib/sceneTier';

import type { DisposeBin } from './disposables';
import {
  LOBE_HALF_AXES,
  LUNG_PLACEMENT,
  bronchialTree,
  fitAirways,
  lobeRadiusAlong,
  type LobeSide,
} from './lungs';
import type { SceneTokens, ThreeNs } from './tokens';

type MergeVertices = (geometry: THREE_NS.BufferGeometry, tolerance?: number) => THREE_NS.BufferGeometry;

export interface Lungs {
  /** Lung-pair space: y up, trachea on the midline. The caller places and scales it. */
  group: THREE_NS.Group;
  /** Uniform breath scale about the pair origin. */
  setBreath(scale: number): void;
  /** Re-resolve every colour and opacity from the tokens; `dim` scales opacity. */
  retheme(tokens: SceneTokens, dim: number): void;
}

export const LOBE_OPACITY = { dark: 0.5, light: 0.3 } as const;
export const AIRWAY_OPACITY = { dark: 0.8, light: 0.4 } as const;
const TUBE_SEGMENTS = 10;
const TUBE_RADIAL_SEGMENTS = 6;
const AIRWAY_BEND = 0.035; // sideways bow of each airway, so the tree is not ruler-straight
const EDGE_DARKEN = 0.2; // light theme: extra pull towards black for the glass rim

/**
 * One lobe: a sphere pushed out along each vertex's own unit direction. The
 * displacement is keyed on the normalised position (not the uv, whose origin
 * is the -x face in three's SphereGeometry), so the cardiac notch lands on the
 * medial face the helpers describe.
 */
function buildLobeGeometry(
  THREE: ThreeNs,
  bin: DisposeBin,
  side: LobeSide,
  segments: number,
  mergeVertices: MergeVertices,
): THREE_NS.BufferGeometry {
  const sphere = bin.track(new THREE.SphereGeometry(1, segments, Math.round(segments * 0.75)));
  const pos = sphere.attributes.position;
  const dir = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    dir.fromBufferAttribute(pos, i).normalize();
    const r = lobeRadiusAlong(side, [dir.x, dir.y, dir.z]);
    pos.setXYZ(i, dir.x * r * LOBE_HALF_AXES.x, dir.y * r * LOBE_HALF_AXES.y, dir.z * r * LOBE_HALF_AXES.z);
  }
  // Drop the per-seam normals/uvs so the weld can fuse the sphere's seam and
  // poles, then light the whole surface smoothly.
  sphere.deleteAttribute('normal');
  sphere.deleteAttribute('uv');
  const welded = bin.track(mergeVertices(sphere, 1e-4));
  welded.computeVertexNormals();
  return welded;
}

export function buildLungs(
  THREE: ThreeNs,
  bin: DisposeBin,
  tokens: SceneTokens,
  budget: SceneBudget,
  mergeVertices: MergeVertices,
  intensity: SceneIntensity = 'full',
  tier: Exclude<SceneTier, 'off'> = 'standard',
): Lungs {
  const group = new THREE.Group();
  const body = new THREE.Group();
  group.add(body);

  const lobeMat = bin.track(
    new THREE.MeshPhysicalMaterial({
      roughness: 0.15,
      metalness: 0,
      transmission: 0, // set by retheme
      thickness: 1.2,
      ior: 1.25,
      sheen: 1,
      sheenRoughness: 0.5,
      transparent: true,
      depthWrite: false,
    }),
  );
  for (const side of ['left', 'right'] as const) {
    const lobe = new THREE.Mesh(buildLobeGeometry(THREE, bin, side, budget.lobeSegments, mergeVertices), lobeMat);
    // The left lobe is mirrored so its local +x (medial) faces the midline.
    const sign = side === 'left' ? 1 : -1;
    lobe.position.set(sign * LUNG_PLACEMENT.offsetX, LUNG_PLACEMENT.centreY, 0);
    lobe.scale.x = -sign;
    body.add(lobe);
  }

  const airwayMat = bin.track(
    new THREE.MeshStandardMaterial({ roughness: 0.55, metalness: 0, transparent: true, depthWrite: false }),
  );
  const airways: THREE_NS.Mesh[] = [];
  fitAirways(bronchialTree(budget.bronchiDepth)).forEach((branch, i) => {
    const [start, end] = [branch.points[0], branch.points[branch.points.length - 1]];
    const bow = AIRWAY_BEND * Math.sin(i * 2.1) * (branch.level === 0 ? 0 : 1);
    const mid: [number, number, number] = [
      (start[0] + end[0]) / 2,
      (start[1] + end[1]) / 2,
      (start[2] + end[2]) / 2 + bow,
    ];
    const curve = new THREE.CatmullRomCurve3([start, mid, end].map((p) => new THREE.Vector3(...p)));
    const geo = bin.track(
      new THREE.TubeGeometry(curve, TUBE_SEGMENTS, branch.radius, TUBE_RADIAL_SEGMENTS, false),
    );
    const airway = new THREE.Mesh(geo, airwayMat);
    airways.push(airway);
    body.add(airway);
  });

  const edge = new THREE.Color();
  const retheme = (t: SceneTokens, dim: number) => {
    lobeMat.color.copy(t.ink);
    edge.copy(t.ink);
    if (t.isLight) edge.lerp(new THREE.Color(0, 0, 0), EDGE_DARKEN);
    lobeMat.sheenColor.copy(edge);
    lobeMat.specularIntensity = t.isLight ? 0.2 : 1; // pale speculars would bleach the ink
    lobeMat.roughness = t.isLight ? 0.55 : 0.15;
    const transmission = lobeTransmission({ intensity, tier, isLight: t.isLight });
    if ((transmission > 0) !== (lobeMat.transmission > 0)) lobeMat.needsUpdate = true; // shader variant changes
    lobeMat.transmission = transmission;
    lobeMat.opacity = (t.isLight ? LOBE_OPACITY.light : LOBE_OPACITY.dark) * dim;
    airwayMat.color.copy(edge);
    airwayMat.emissive.copy(t.accent); // faint accent rim on the airways
    airwayMat.emissiveIntensity = t.isLight ? 0.05 : 0.18;
    // Light theme: draw the airways over the (near-opaque) lobes so they stay readable.
    for (const a of airways) a.renderOrder = t.isLight ? 2 : 0;
    airwayMat.opacity = (t.isLight ? AIRWAY_OPACITY.light : AIRWAY_OPACITY.dark) * dim;
  };
  retheme(tokens, 1);

  return { group, setBreath: (s) => body.scale.setScalar(s), retheme };
}

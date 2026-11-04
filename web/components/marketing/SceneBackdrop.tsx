'use client';

/*
 * SceneBackdrop — the client boundary that defers-loads the fixed WebGL
 * SceneBackground. Kept tiny so it can be dropped into any surface (server or
 * client) that wants the pinned ambient scene. Must sit as a SIBLING *before*
 * the page's `relative z-1` veil wrapper so the fixed canvas (z-index:0) stays
 * behind the content rather than painting over it.
 */

import dynamic from 'next/dynamic';
import type { SceneIntensity } from './SceneBackground';
import { MilestoneOverlay } from './scene/MilestoneOverlay';

const Scene = dynamic(() => import('./SceneBackground'), { ssr: false });

export function SceneBackdrop({
  intensity = 'full',
  discreet = false,
  lastSmokeIso = null,
}: {
  intensity?: SceneIntensity;
  discreet?: boolean;
  lastSmokeIso?: string | null;
}) {
  return (
    <>
      <Scene intensity={intensity} discreet={discreet} lastSmokeIso={lastSmokeIso} />
      <MilestoneOverlay lastSmokeIso={lastSmokeIso} discreet={discreet} intensity={intensity} />
    </>
  );
}

export default SceneBackdrop;

import * as React from 'react';
import { SceneBackdrop } from '@web/components/marketing/SceneBackdrop';
import { getServerLatestLogIso, getServerProfile } from '@web/lib/server/data';
import { isDiscreetMode } from '@/lib/discreet';

/*
 * Server component: resolves the reader's discreet flag and last log time and
 * mounts the scene. Rendered inside <Suspense> by the (app) layout so the shell
 * streams without waiting on auth or the profile read. Both loaders are
 * React-cached, so pages share these reads and still perform any login
 * redirect themselves.
 *
 * The ISO is passed even when discreet: the overlay that consumes it renders
 * nothing under discreet, so no extra branch is needed here.
 */
export async function SceneForReader(): Promise<React.ReactElement> {
  // Fail closed: a failed profile read (error or the loader's NEXT_REDIRECT)
  // cannot tell us the reader is not discreet, so show the neutral haze. A
  // failed log read only loses the milestone line, so it falls back to null.
  const [discreet, lastSmokeIso] = await Promise.all([
    getServerProfile().then(isDiscreetMode).catch(() => true),
    getServerLatestLogIso().catch(() => null),
  ]);
  return <SceneBackdrop intensity="quiet" discreet={discreet} lastSmokeIso={lastSmokeIso} />;
}

export default SceneForReader;

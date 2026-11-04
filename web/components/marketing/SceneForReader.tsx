import * as React from 'react';
import { SceneBackdrop } from '@web/components/marketing/SceneBackdrop';
import { getServerProfile } from '@web/lib/server/data';
import { isDiscreetMode } from '@/lib/discreet';

/*
 * Server component: resolves the reader's discreet flag and mounts the scene.
 * Rendered inside <Suspense> by the (app) layout so the shell streams without
 * waiting on auth or the profile read. The loader is React-cached, so pages
 * share this read and still perform any login redirect themselves.
 */
export async function SceneForReader(): Promise<React.ReactElement> {
  // Fail closed: a failed read (error or the loader's NEXT_REDIRECT) cannot
  // tell us the reader is not discreet, so show the neutral haze.
  const discreet = await getServerProfile().then(isDiscreetMode).catch(() => true);
  return <SceneBackdrop intensity="quiet" discreet={discreet} />;
}

export default SceneForReader;

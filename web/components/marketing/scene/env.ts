import { sceneClearStart } from './breath';
import type { SceneEnv } from '@web/lib/sceneTier';

export function readSceneEnv(): SceneEnv {
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

/** Epoch-ms the haze started clearing for this session (a reload never restarts it). */
export function sessionClearStart(): number {
  try {
    return sceneClearStart(window.sessionStorage, Date.now());
  } catch {
    return Date.now(); // storage blocked: the haze simply restarts each visit
  }
}

// Mobile half of the lifecycle registry (src/lib/privacy/lifecycle.ts): one clearer per mobile
// store id, run together for an event. Never throws; the ids that failed come back to log.
// Native modules load on demand so the id list stays importable from tests.

import { runLifecycleClearers, type Clearer, type LifecycleEvent } from '@/lib/privacy/lifecycle';
import { SESSION_STORAGE_KEY, deleteKeyFromAllStores, wipeSecureStore } from '@/lib/secureStore';
import { clearFirstSuggestionDismissals } from '@/lib/goals/firstSuggestionStore';

/** Export files are written to the cache directory under this name (app/(tabs)/settings.tsx). */
export const EXPORT_FILE_PREFIX = 'smoke-ledger-export-';

/* eslint-disable @typescript-eslint/no-require-imports -- native modules load on demand */
export async function deleteExportFile(path: string): Promise<void> {
  const FileSystem = require('expo-file-system/legacy');
  await FileSystem.deleteAsync(path, { idempotent: true });
}

/** Every export file left in the cache, including ones from earlier runs. */
async function deleteAllExportFiles(): Promise<void> {
  const FileSystem = require('expo-file-system/legacy');
  const dir: string | null = FileSystem.cacheDirectory;
  if (!dir) return;
  const names: string[] = await FileSystem.readDirectoryAsync(dir);
  await Promise.all(
    names.filter((n) => n.startsWith(EXPORT_FILE_PREFIX)).map((n) => deleteExportFile(`${dir}${n}`)),
  );
}

async function resetInMemoryLedger(): Promise<void> {
  const { useSession } = require('@/store/session');
  useSession.getState().reset();
}
/* eslint-enable @typescript-eslint/no-require-imports */

const nativeClearers: Record<string, Clearer> = {
  'mobile.session': () => deleteKeyFromAllStores(SESSION_STORAGE_KEY),
  'mobile.inMemoryLedger': resetInMemoryLedger,
  'mobile.firstSuggestion': () => clearFirstSuggestionDismissals(),
  'mobile.lockKeys': wipeSecureStore,
  'mobile.notifications': async () => {
    const { cancelAll } = await import('@/services/notifications');
    await cancelAll();
  },
  'mobile.exportFile': deleteAllExportFiles,
};

/** Ids this module can clear; a test pins them to the registry. */
export const NATIVE_CLEARER_IDS: readonly string[] = Object.keys(nativeClearers);

export function clearNativeDevice(event: LifecycleEvent): Promise<string[]> {
  return runLifecycleClearers('mobile', event, nativeClearers);
}

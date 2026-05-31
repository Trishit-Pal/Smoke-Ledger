// Native-only AsyncStorage-backed hydration for the brand-catalog sync marker.
//
// React Native has no `window`, so without a persisted marker the
// `sync_default_brand_catalog` RPC would re-run on every cold boot (wasted
// latency + egress). We hydrate the marker once and hand catalogSync a SYNC
// adapter (its interface is sync) that returns the hydrated value and
// write-throughs new values to AsyncStorage.
//
// This module is shimmed to a no-op on web (see web/next.config.mjs webpack
// alias), mirroring the secureStore → web/lib/storage shim — web persists the
// marker via localStorage in catalogSync.ts and never runs the RN boot() path,
// so the native AsyncStorage module is never bundled there.

import type { CatalogSyncStorage } from '@/lib/catalogSync';
import { CATALOG_SYNC_STORAGE_KEY } from '@/lib/catalogVersion';

type AsyncStorageLike = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
};

function loadAsyncStorage(): AsyncStorageLike | null {
  try {
    const mod = require('@react-native-async-storage/async-storage');
    return (mod.default ?? mod) as AsyncStorageLike;
  } catch {
    return null;
  }
}

/**
 * Hydrate the persisted catalog-sync marker and return a sync adapter that
 * reads the hydrated value and write-throughs updates to AsyncStorage. Returns
 * null when AsyncStorage is unavailable (caller then falls back to syncing).
 */
export async function makeNativeCatalogStorage(): Promise<CatalogSyncStorage | null> {
  const storage = loadAsyncStorage();
  if (!storage) return null;

  let marker: string | null = null;
  try {
    marker = await storage.getItem(CATALOG_SYNC_STORAGE_KEY);
  } catch {
    marker = null;
  }

  return {
    getItem: () => marker,
    setItem: (key, value) => {
      marker = value;
      void storage.setItem(key, value).catch(() => undefined);
    },
  };
}

import type { CatalogSyncStorage } from '@/lib/catalogSync';

// Web shim for src/lib/catalogStorageNative.ts (wired via the webpack alias in
// next.config.mjs). The web app never runs the React-Native useSession.boot()
// path and persists the catalog-sync marker via localStorage inside
// catalogSync.ts, so there is nothing native to hydrate here. Returning null
// keeps the shared import resolvable without bundling AsyncStorage.
export async function makeNativeCatalogStorage(): Promise<CatalogSyncStorage | null> {
  return null;
}

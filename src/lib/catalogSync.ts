import { syncDefaultBrandCatalog } from '@/db/repositories/brands';
import { CATALOG_SYNC_STORAGE_KEY, CATALOG_SYNC_VERSION } from '@/lib/catalogVersion';

export type CatalogSyncStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};

export function shouldSyncCatalog(
  storage: CatalogSyncStorage | null,
  version: string = CATALOG_SYNC_VERSION,
): boolean {
  if (!storage) return true;
  return storage.getItem(CATALOG_SYNC_STORAGE_KEY) !== version;
}

export function markCatalogSynced(
  storage: CatalogSyncStorage | null,
  version: string = CATALOG_SYNC_VERSION,
): void {
  if (!storage) return;
  storage.setItem(CATALOG_SYNC_STORAGE_KEY, version);
}

/**
 * Default web storage: `localStorage` persists the sync marker across tabs and
 * sessions, so the catalog RPC runs once per catalog version per browser (not
 * once per tab — the old `sessionStorage` re-synced on every new tab). Returns
 * null off the web; React Native callers pass an AsyncStorage-backed adapter
 * explicitly (see `src/store/session.ts`), because `window` is undefined there
 * and an unpersisted marker would re-run the RPC on every cold boot.
 */
function getWebStorage(): CatalogSyncStorage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/** Hard cap on how long we wait for the catalog sync RPC before giving up, so a
 *  slow or flaky network can never stall app startup. */
export const CATALOG_SYNC_TIMEOUT_MS = 6000;

/**
 * Sync default brand catalog at most once per catalog version.
 *
 * Boot resilience: the RPC is raced against a timeout so a stalled network
 * cannot block startup. On timeout the marker is left unwritten and the next
 * launch retries.
 *
 * Flaky-network safety: the RPC `sync_default_brand_catalog` is idempotent by
 * design — `sync_catalog_for_user` looks up each brand by `(user_id,
 * lower(name))` and each variant by `(user_id, brand_id, lower(name))` before
 * inserting. A failed call that left some rows inserted is recoverable by
 * simply calling again; no duplicates result. The marker is only written after
 * a successful await, so the next launch retries on transient failure or timeout.
 */
export async function maybeSyncDefaultBrandCatalog(
  storageOverride?: CatalogSyncStorage | null,
  opts?: { timeoutMs?: number },
): Promise<void> {
  const storage =
    storageOverride !== undefined ? storageOverride : getWebStorage();
  if (!shouldSyncCatalog(storage)) return;

  const timeoutMs = opts?.timeoutMs ?? CATALOG_SYNC_TIMEOUT_MS;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      syncDefaultBrandCatalog(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error('catalog_sync_timeout')),
          timeoutMs,
        );
      }),
    ]);
    markCatalogSynced(storage);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

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

function getSessionStorage(): CatalogSyncStorage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

/**
 * Sync default brand catalog at most once per tab session per catalog version.
 *
 * Flaky-network safety: the RPC `sync_default_brand_catalog` is idempotent by
 * design — `sync_catalog_for_user` looks up each brand by `(user_id,
 * lower(name))` and each variant by `(user_id, brand_id, lower(name))` before
 * inserting. A failed call that left some rows inserted is recoverable by
 * simply calling again; no duplicates result. Storage is only marked after a
 * successful await, so the next session retries on transient failure.
 */
export async function maybeSyncDefaultBrandCatalog(
  storageOverride?: CatalogSyncStorage | null,
): Promise<void> {
  const storage =
    storageOverride !== undefined ? storageOverride : getSessionStorage();
  if (!shouldSyncCatalog(storage)) return;
  await syncDefaultBrandCatalog();
  markCatalogSynced(storage);
}

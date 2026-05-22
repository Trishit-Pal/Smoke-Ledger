import {
  markCatalogSynced,
  maybeSyncDefaultBrandCatalog,
  shouldSyncCatalog,
  type CatalogSyncStorage,
} from '@/lib/catalogSync';
import { CATALOG_SYNC_STORAGE_KEY, CATALOG_SYNC_VERSION } from '@/lib/catalogVersion';

jest.mock('@/db/repositories/brands', () => ({
  syncDefaultBrandCatalog: jest.fn(async () => {}),
}));

import { syncDefaultBrandCatalog } from '@/db/repositories/brands';

const mockSync = syncDefaultBrandCatalog as jest.Mock;

function makeStorage(initial: Record<string, string> = {}): CatalogSyncStorage {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => {
      map.set(key, value);
    },
  };
}

describe('catalogSync', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shouldSyncCatalog returns true when storage is null', () => {
    expect(shouldSyncCatalog(null)).toBe(true);
  });

  it('shouldSyncCatalog returns false when version matches', () => {
    const storage = makeStorage({ [CATALOG_SYNC_STORAGE_KEY]: CATALOG_SYNC_VERSION });
    expect(shouldSyncCatalog(storage)).toBe(false);
  });

  it('shouldSyncCatalog returns true when version differs', () => {
    const storage = makeStorage({ [CATALOG_SYNC_STORAGE_KEY]: '2025.0' });
    expect(shouldSyncCatalog(storage)).toBe(true);
  });

  it('markCatalogSynced writes version to storage', () => {
    const storage = makeStorage();
    markCatalogSynced(storage);
    expect(storage.getItem(CATALOG_SYNC_STORAGE_KEY)).toBe(CATALOG_SYNC_VERSION);
  });

  it('maybeSyncDefaultBrandCatalog skips RPC when already synced', async () => {
    const storage = makeStorage({ [CATALOG_SYNC_STORAGE_KEY]: CATALOG_SYNC_VERSION });
    await maybeSyncDefaultBrandCatalog(storage);
    expect(mockSync).not.toHaveBeenCalled();
  });

  it('maybeSyncDefaultBrandCatalog calls sync and marks storage on miss', async () => {
    const storage = makeStorage();
    await maybeSyncDefaultBrandCatalog(storage);
    expect(mockSync).toHaveBeenCalledTimes(1);
    expect(storage.getItem(CATALOG_SYNC_STORAGE_KEY)).toBe(CATALOG_SYNC_VERSION);
  });

  it('maybeSyncDefaultBrandCatalog does not mark storage when sync fails', async () => {
    const storage = makeStorage();
    mockSync.mockRejectedValueOnce(new Error('rpc failed'));
    await expect(maybeSyncDefaultBrandCatalog(storage)).rejects.toThrow('rpc failed');
    expect(storage.getItem(CATALOG_SYNC_STORAGE_KEY)).toBeNull();
  });

  it('maybeSyncDefaultBrandCatalog retries cleanly after a transient failure (M5)', async () => {
    // Simulates the "flaky network" scenario the audit flagged: the first call
    // fails (e.g., RPC partial-write then connection drop), and the next
    // session retries. The DB-side RPC is idempotent by SELECT-then-INSERT
    // on (user_id, lower(name)) so a retry cannot create duplicates — see the
    // contract documented on maybeSyncDefaultBrandCatalog.
    const storage = makeStorage();
    mockSync.mockRejectedValueOnce(new Error('network blip'));

    await expect(maybeSyncDefaultBrandCatalog(storage)).rejects.toThrow('network blip');
    expect(storage.getItem(CATALOG_SYNC_STORAGE_KEY)).toBeNull();

    await maybeSyncDefaultBrandCatalog(storage);

    expect(mockSync).toHaveBeenCalledTimes(2);
    expect(storage.getItem(CATALOG_SYNC_STORAGE_KEY)).toBe(CATALOG_SYNC_VERSION);
  });
});

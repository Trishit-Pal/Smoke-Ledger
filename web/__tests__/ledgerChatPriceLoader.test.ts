import { describe, expect, test, vi } from 'vitest';

vi.mock('@web/lib/supabase/server', () => ({ createClient: vi.fn() }));
vi.mock('@web/lib/supabase/admin', () => ({ createAdminClient: vi.fn() }));
vi.mock('next/cache', () => ({ unstable_cache: (fn: unknown) => fn }));
vi.mock('next/navigation', () => ({ redirect: vi.fn() }));
vi.mock('react', async (importOriginal) => ({ ...(await importOriginal<object>()), cache: (fn: unknown) => fn }));

const { loadPriceEntries, PRICE_ENTRIES_LIMIT } = await import('@web/lib/server/data');

type Call = { table: string; ops: Array<[string, ...unknown[]]> };

function fakeDb(tables: Record<string, unknown[]>) {
  const calls: Call[] = [];
  const db = {
    from(table: string) {
      const call: Call = { table, ops: [] };
      calls.push(call);
      const chain: Record<string, unknown> = {};
      for (const op of ['select', 'eq', 'gte', 'in', 'order', 'limit']) {
        chain[op] = (...args: unknown[]) => {
          call.ops.push([op, ...args]);
          return chain;
        };
      }
      chain.then = (resolve: (v: unknown) => void) => resolve({ data: tables[table], error: null });
      return chain;
    },
  };
  return { db, calls };
}

describe('loadPriceEntries', () => {
  test('reads the reader’s own rows since a date, newest first, bounded, with brand names resolved', async () => {
    const { db, calls } = fakeDb({
      price_entries: [
        { brand_id: 'b1', unit_price_inr: '18.50', pack_size: 20, observed_at: '2026-06-10T04:00:00Z' },
        { brand_id: null, unit_price_inr: 20, pack_size: null, observed_at: '2026-06-01T04:00:00Z' },
      ],
      brands: [{ id: 'b1', name: 'Gold Flake' }],
    });

    const out = await loadPriceEntries(db as never, 'u1', { sinceYmd: '2025-06-22' });

    expect(out).toEqual([
      { brandName: 'Gold Flake', unitPriceInr: 18.5, packSize: 20, observedAt: '2026-06-10T04:00:00Z' },
      { brandName: null, unitPriceInr: 20, packSize: null, observedAt: '2026-06-01T04:00:00Z' },
    ]);
    const prices = calls.find((c) => c.table === 'price_entries')!;
    expect(prices.ops).toContainEqual(['eq', 'user_id', 'u1']);
    expect(prices.ops).toContainEqual(['gte', 'observed_at', '2025-06-22']);
    expect(prices.ops).toContainEqual(['order', 'observed_at', { ascending: false }]);
    expect(prices.ops).toContainEqual(['limit', PRICE_ENTRIES_LIMIT]);
    const brands = calls.find((c) => c.table === 'brands')!;
    expect(brands.ops).toContainEqual(['eq', 'user_id', 'u1']);
    expect(brands.ops).toContainEqual(['in', 'id', ['b1']]);
  });

  test('skips the brand lookup when no row names a brand', async () => {
    const { db, calls } = fakeDb({ price_entries: [] });

    expect(await loadPriceEntries(db as never, 'u1', { sinceYmd: '2025-06-22' })).toEqual([]);
    expect(calls.map((c) => c.table)).toEqual(['price_entries']);
  });
});

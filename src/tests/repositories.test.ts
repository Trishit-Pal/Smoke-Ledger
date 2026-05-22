jest.mock('@/lib/supabase', () => ({
  getSupabase: jest.fn(),
}));

jest.mock('@/db/repositories/_supabase', () => ({
  requireUserId: jest.fn().mockResolvedValue('user-123'),
  mapDbError: jest.requireActual('@/db/repositories/_supabase').mapDbError,
}));

jest.mock('@/lib/logger', () => ({
  logClientError: jest.fn(),
}));

import { mapDbError } from '@/db/repositories/_supabase';
import { deleteBrand } from '@/db/repositories/brands';
import { listLogs, listLogsPage, PAGE_SIZE_DEFAULT } from '@/db/repositories/logs';
import { getProfile } from '@/db/repositories/profile';
import { AppError } from '@/lib/errors';
import { getSupabase } from '@/lib/supabase';
import { logClientError } from '@/lib/logger';

const mockGetSupabase = getSupabase as jest.Mock;
const mockLogClientError = logClientError as jest.Mock;

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function makeRpcMock(response: Record<string, unknown>) {
  return jest.fn().mockResolvedValue({ data: response, error: null });
}

function makeRpcErrorMock(message: string) {
  return jest.fn().mockResolvedValue({ data: null, error: { message, code: '42501' } });
}

function stubSupabase(rpc: jest.Mock) {
  mockGetSupabase.mockReturnValue({ rpc });
}

// Minimal valid log rows returned by the RPC (camelCase — RPC returns JSON)
function makeLogRow(id: string, ts: string) {
  return {
    id,
    tsUtc: ts,
    localDate: ts.slice(0, 10),
    localHour: 12,
    brandId: null,
    brandNameSnap: null,
    variantSnap: null,
    quantity: 1,
    purchaseMode: 'loose',
    packSize: null,
    totalPriceInr: null,
    unitPriceInr: null,
    priceSource: 'none',
    triggerTag: null,
    moodBefore: null,
    moodAfter: null,
    craving: null,
    contextTag: null,
    notes: null,
    createdAt: ts,
    updatedAt: ts,
  };
}

// ---------------------------------------------------------------------------
// mapDbError (unchanged)
// ---------------------------------------------------------------------------

describe('mapDbError', () => {
  it('maps permission denied to authorization_error', () => {
    const err = mapDbError({ code: '42501', message: 'permission denied' });
    expect(err).toBeInstanceOf(AppError);
    expect((err as AppError).code).toBe('authorization_error');
  });

  it('maps unique violation to conflict', () => {
    const err = mapDbError({ code: '23505', message: 'duplicate' });
    expect((err as AppError).code).toBe('conflict');
  });
});

// ---------------------------------------------------------------------------
// listLogsPage — cursor pagination
// ---------------------------------------------------------------------------

describe('listLogsPage', () => {
  beforeEach(() => {
    mockGetSupabase.mockReset();
    mockLogClientError.mockReset();
  });

  it('returns nextCursor when the page is full (hasMore: true)', async () => {
    // Arrange
    const rpc = makeRpcMock({
      logs: [makeLogRow('log_a', '2026-01-02T10:00:00Z'), makeLogRow('log_b', '2026-01-01T10:00:00Z')],
      nextCursorTs: '2026-01-01T10:00:00Z',
      nextCursorId: 'log_b',
      hasMore: true,
    });
    stubSupabase(rpc);

    // Act
    const result = await listLogsPage({ limit: 2 });

    // Assert
    expect(result.logs).toHaveLength(2);
    expect(result.logs[0].id).toBe('log_a');
    expect(result.nextCursor).toEqual({
      ts: '2026-01-01T10:00:00Z',
      id: 'log_b',
    });
    expect(rpc).toHaveBeenCalledWith('list_logs_page', expect.objectContaining({
      p_user_id: 'user-123',
      p_cursor_ts: null,
      p_cursor_id: null,
    }));
  });

  it('returns null nextCursor on the last page (hasMore: false)', async () => {
    // Arrange
    const rpc = makeRpcMock({
      logs: [makeLogRow('log_z', '2026-01-01T09:00:00Z')],
      nextCursorTs: null,
      nextCursorId: null,
      hasMore: false,
    });
    stubSupabase(rpc);

    // Act
    const result = await listLogsPage({
      cursor: { ts: '2026-01-02T00:00:00Z', id: 'log_a' },
    });

    // Assert
    expect(result.logs).toHaveLength(1);
    expect(result.nextCursor).toBeNull();
    expect(rpc).toHaveBeenCalledWith('list_logs_page', expect.objectContaining({
      p_cursor_ts: '2026-01-02T00:00:00Z',
      p_cursor_id: 'log_a',
    }));
  });

  it('passes date range and filter opts to the RPC', async () => {
    // Arrange
    const rpc = makeRpcMock({ logs: [], nextCursorTs: null, nextCursorId: null, hasMore: false });
    stubSupabase(rpc);

    // Act
    await listLogsPage({ fromDate: '2026-01-01', toDate: '2026-01-31', brandId: 'brand_abc123' });

    // Assert
    expect(rpc).toHaveBeenCalledWith('list_logs_page', expect.objectContaining({
      p_from_date: '2026-01-01',
      p_to_date: '2026-01-31',
      p_brand_id: 'brand_abc123',
    }));
  });

  it('throws a mapped AppError on RPC failure', async () => {
    // Arrange
    stubSupabase(makeRpcErrorMock('permission denied'));

    // Act & Assert
    await expect(listLogsPage()).rejects.toBeInstanceOf(AppError);
  });

  it('maps camelCase RPC payload to CigaretteLog with tsUtc populated (not undefined)', async () => {
    // Arrange — RPC returns the camelCase shape produced by jsonb_build_object in the SQL.
    // This test guards against regressions where the cast was Row[] (snake_case), which
    // caused every field to resolve to undefined at runtime.
    const rpc = makeRpcMock({
      logs: [makeLogRow('log_cc', '2026-03-15T08:30:00Z')],
      nextCursorTs: null,
      nextCursorId: null,
      hasMore: false,
    });
    stubSupabase(rpc);

    // Act
    const result = await listLogsPage();

    // Assert — all mapped fields must be populated from the camelCase source
    expect(result.logs).toHaveLength(1);
    const log = result.logs[0];
    expect(log.id).toBe('log_cc');
    expect(log.tsUtc).toBe('2026-03-15T08:30:00Z');
    expect(log.localDate).toBe('2026-03-15');
    expect(log.localHour).toBe(12);
    expect(log.quantity).toBe(1);
    expect(log.purchaseMode).toBe('loose');
    expect(log.priceSource).toBe('none');
    expect(log.createdAt).toBe('2026-03-15T08:30:00Z');
    expect(log.updatedAt).toBe('2026-03-15T08:30:00Z');
    // None of these should be undefined (the snake_case cast bug)
    expect(log.tsUtc).not.toBeUndefined();
    expect(log.localDate).not.toBeUndefined();
    expect(log.purchaseMode).not.toBeUndefined();
    expect(log.priceSource).not.toBeUndefined();
  });

  it('returns null nextCursor and does not paginate when hasMore is true but cursor fields are null', async () => {
    // Arrange — malformed SQL response: hasMore signals more rows exist but the cursor
    // fields are null (indicates a SQL bug). The repository must not return a cursor
    // that would cause the pagination loop to spin with a null cursor.
    const rpc = makeRpcMock({
      logs: [makeLogRow('log_m', '2026-05-01T00:00:00Z')],
      nextCursorTs: null,
      nextCursorId: null,
      hasMore: true,
    });
    stubSupabase(rpc);

    // Act
    const result = await listLogsPage();

    // Assert — nextCursor must be null despite hasMore being true, so the caller
    // stops paginating and does not enter an infinite loop.
    expect(result.nextCursor).toBeNull();
    expect(result.logs).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// listLogs — legacy compat: small default limit + warning when capped
// ---------------------------------------------------------------------------

describe('listLogs', () => {
  beforeEach(() => {
    mockGetSupabase.mockReset();
    mockLogClientError.mockReset();
  });

  it('uses PAGE_SIZE_DEFAULT when no limit is supplied', async () => {
    // Arrange
    const rows = Array.from({ length: PAGE_SIZE_DEFAULT }, (_, i) =>
      makeLogRow(`log_${i}`, `2026-01-01T${String(i % 24).padStart(2, '0')}:00:00Z`),
    );
    const rpc = makeRpcMock({
      logs: rows,
      nextCursorTs: '2025-12-31T00:00:00Z',
      nextCursorId: `log_${PAGE_SIZE_DEFAULT - 1}`,
      hasMore: true,
    });
    stubSupabase(rpc);

    // Act
    const result = await listLogs();

    // Assert — call used the default page size
    expect(rpc).toHaveBeenCalledWith('list_logs_page', expect.objectContaining({
      p_limit: PAGE_SIZE_DEFAULT,
    }));
    expect(result).toHaveLength(PAGE_SIZE_DEFAULT);
  });

  it('logs a warning via logClientError when the result hits the page cap', async () => {
    // Arrange — RPC signals hasMore: true, meaning data was capped
    const rows = Array.from({ length: PAGE_SIZE_DEFAULT }, (_, i) =>
      makeLogRow(`log_${i}`, `2026-01-01T${String(i % 24).padStart(2, '0')}:00:00Z`),
    );
    const rpc = makeRpcMock({
      logs: rows,
      nextCursorTs: '2025-12-31T00:00:00Z',
      nextCursorId: `log_${PAGE_SIZE_DEFAULT - 1}`,
      hasMore: true,
    });
    stubSupabase(rpc);

    // Act
    await listLogs();

    // Assert — warning was emitted
    expect(mockLogClientError).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ category: 'listLogs.pagination_hint' }),
    );
  });

  it('does NOT warn when the result is smaller than the cap', async () => {
    // Arrange — fewer rows than PAGE_SIZE_DEFAULT, no more pages
    const rpc = makeRpcMock({
      logs: [makeLogRow('log_x', '2026-01-01T10:00:00Z')],
      nextCursorTs: null,
      nextCursorId: null,
      hasMore: false,
    });
    stubSupabase(rpc);

    // Act
    await listLogs();

    // Assert
    expect(mockLogClientError).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// getProfile — C4 audit: numeric(5,2) coercion
// ---------------------------------------------------------------------------
//
// Postgres `numeric` columns are returned as strings by the pg driver (and thus
// by supabase-js). The row mapper must coerce `baseline_per_day` to a JS number
// so that downstream savings math (`Math.max(0, baselinePerDay - s.sticks)`) and
// Zod validation (`z.number()`) continue to work correctly.
//
// REGRESSION NOTE: supabase-js does NOT auto-cast `numeric` → JS number the way
// it does for `int4` / `float8`. Always use `Number()` when mapping numeric columns.
// ---------------------------------------------------------------------------

function makeProfileRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'user-123',
    baseline_per_day: null,
    baseline_window_days: 30,
    currency: 'INR',
    discreet_mode: false,
    app_lock_enabled: false,
    hide_totals_on_home: false,
    onboarded_at: null,
    ...overrides,
  };
}

function stubSupabaseProfile(row: Record<string, unknown> | null, error: unknown = null) {
  const chain = {
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue({ data: row, error }),
  };
  mockGetSupabase.mockReturnValue(chain);
}

describe('getProfile — baseline_per_day numeric coercion (C4)', () => {
  beforeEach(() => {
    mockGetSupabase.mockReset();
  });

  it('coerces a string "10.50" (pg numeric) to JS number 10.5', async () => {
    // Arrange — simulate pg driver returning numeric as string
    stubSupabaseProfile(makeProfileRow({ baseline_per_day: '10.50' }));

    // Act
    const profile = await getProfile();

    // Assert — must be JS number, not string
    expect(typeof profile.baselinePerDay).toBe('number');
    expect(profile.baselinePerDay).toBe(10.5);
  });

  it('preserves fractional baseline through the mapping round-trip (e.g. 7.5)', async () => {
    // Arrange — supabase-js returns "7.50" for numeric(5,2) storing 7.5
    stubSupabaseProfile(makeProfileRow({ baseline_per_day: '7.50' }));

    // Act
    const profile = await getProfile();

    // Assert — fractional value must survive the coercion without drift
    expect(profile.baselinePerDay).toBe(7.5);
  });

  it('maps null baseline_per_day to null (no coercion error)', async () => {
    // Arrange
    stubSupabaseProfile(makeProfileRow({ baseline_per_day: null }));

    // Act
    const profile = await getProfile();

    // Assert
    expect(profile.baselinePerDay).toBeNull();
  });

  it('handles a numeric value already returned as JS number (defensive — double precision fallback)', async () => {
    // Arrange — e.g. a local dev DB still has double precision; driver returns number
    stubSupabaseProfile(makeProfileRow({ baseline_per_day: 15 }));

    // Act
    const profile = await getProfile();

    // Assert — Number(15) === 15, so this is safe either way
    expect(profile.baselinePerDay).toBe(15);
  });
});

// ---------------------------------------------------------------------------
// deleteBrand — M7 audit: ON DELETE RESTRICT surfaces a `conflict` error
// ---------------------------------------------------------------------------
//
// Schema change in 20250426120000_initial_schema.sql swapped brand_variants.brand_id
// from ON DELETE CASCADE to ON DELETE RESTRICT. Deleting a brand that still has
// variants now raises Postgres 23503 (foreign_key_violation). The repository must
// translate that to AppError code `conflict` (not the generic `validation_error`
// that mapDbError would otherwise produce) so the UI can offer the user a clear
// next action: delete the variants first, or merge into another brand.
// ---------------------------------------------------------------------------

function stubBrandDelete(error: unknown) {
  // supabase-js PostgrestBuilder is a thenable: every chain method returns the
  // builder, and awaiting it resolves with { data, error }. We build a single
  // self-referential builder that resolves to the supplied error envelope.
  const builder: Record<string, unknown> = {
    then: (resolve: (v: { error: unknown }) => void) => resolve({ error }),
  };
  builder.from = jest.fn(() => builder);
  builder.delete = jest.fn(() => builder);
  builder.eq = jest.fn(() => builder);
  mockGetSupabase.mockReturnValue(builder);
}

describe('deleteBrand — M7 ON DELETE RESTRICT surfaces conflict', () => {
  beforeEach(() => {
    mockGetSupabase.mockReset();
    // requireUserId is mocked at module load to resolve 'user-123'.
  });

  it('translates Postgres 23503 (foreign_key_violation) to AppError code conflict', async () => {
    // Arrange — simulate the FK violation that brand_variants RESTRICT raises
    stubBrandDelete({
      code: '23503',
      message:
        'update or delete on table "brands" violates foreign key constraint "brand_variants_brand_id_fkey" on table "brand_variants"',
    });

    // Act + Assert
    await expect(deleteBrand('brd_abc123')).rejects.toBeInstanceOf(AppError);
    try {
      await deleteBrand('brd_abc123');
      throw new Error('expected deleteBrand to throw');
    } catch (e) {
      expect(e).toBeInstanceOf(AppError);
      expect((e as AppError).code).toBe('conflict');
      expect((e as AppError).message).toContain('brand_has_variants');
    }
  });

  it('propagates other Postgres errors via mapDbError (not all errors are conflict)', async () => {
    // Arrange — simulate an unrelated permission error
    stubBrandDelete({ code: '42501', message: 'permission denied' });

    // Act + Assert — 42501 maps to authorization_error in mapDbError, not conflict
    try {
      await deleteBrand('brd_abc123');
      throw new Error('expected deleteBrand to throw');
    } catch (e) {
      expect(e).toBeInstanceOf(AppError);
      expect((e as AppError).code).toBe('authorization_error');
    }
  });

  it('resolves successfully when no error is returned', async () => {
    stubBrandDelete(null);
    await expect(deleteBrand('brd_abc123')).resolves.toBeUndefined();
  });
});

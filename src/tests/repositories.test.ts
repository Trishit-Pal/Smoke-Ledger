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
import { listLogs, listLogsPage, PAGE_SIZE_DEFAULT } from '@/db/repositories/logs';
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

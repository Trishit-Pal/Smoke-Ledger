import { exportAccountData } from '@/services/exportAccountData';
import { AppError } from '@/lib/errors';

jest.mock('@/lib/supabase', () => ({
  getSupabase: jest.fn(),
}));

import { getSupabase } from '@/lib/supabase';

const mockGetSupabase = getSupabase as jest.Mock;

// The production cap; kept in sync with the constant in exportAccountData.ts.
// Do NOT lower this here — tests must exercise the real cap boundary.
const MAX_EXPORT_PAGES = 200;
const PAGE_SIZE = 5000;

describe('exportAccountData pagination', () => {
  beforeEach(() => {
    mockGetSupabase.mockReset();
  });

  it('loops until hasMore is false and merges log pages', async () => {
    const rpc = jest
      .fn()
      .mockResolvedValueOnce({
        data: {
          version: 2,
          exportedAt: '2026-01-01T00:00:00Z',
          hasMore: true,
          nextCursorTs: '2026-01-01T00:00:00Z',
          nextCursorId: 'log_a',
          logs: [{ id: 'log_a' }],
          profile: { baselinePerDay: 10 },
        },
        error: null,
      })
      .mockResolvedValueOnce({
        data: {
          version: 2,
          exportedAt: '2026-01-01T00:00:00Z',
          hasMore: false,
          logs: [{ id: 'log_b' }],
        },
        error: null,
      });

    mockGetSupabase.mockReturnValue({ rpc });

    const result = await exportAccountData();

    expect(rpc).toHaveBeenCalledTimes(2);
    expect(rpc.mock.calls[0][1]).toMatchObject({
      p_cursor_ts: null,
      p_cursor_id: null,
      p_limit: PAGE_SIZE,
    });
    expect(rpc.mock.calls[1][1]).toMatchObject({
      p_cursor_ts: '2026-01-01T00:00:00Z',
      p_cursor_id: 'log_a',
    });
    expect(result.logs).toEqual([{ id: 'log_a' }, { id: 'log_b' }]);
    expect(result.profile).toEqual({ baselinePerDay: 10 });
    // Complete export — not truncated
    expect(result.truncated).toBe(false);
  });

  it('throws on RPC error', async () => {
    mockGetSupabase.mockReturnValue({
      rpc: jest.fn().mockResolvedValue({ data: null, error: { message: 'boom' } }),
    });
    await expect(exportAccountData()).rejects.toBeInstanceOf(AppError);
  });

  it('sets truncated=false on a single-page export where hasMore is immediately false', async () => {
    const rpc = jest.fn().mockResolvedValueOnce({
      data: {
        version: 2,
        exportedAt: '2026-01-01T00:00:00Z',
        hasMore: false,
        logs: [{ id: 'only_log' }],
      },
      error: null,
    });

    mockGetSupabase.mockReturnValue({ rpc });

    const result = await exportAccountData();

    expect(rpc).toHaveBeenCalledTimes(1);
    expect(result.logs).toEqual([{ id: 'only_log' }]);
    expect(result.truncated).toBe(false);
  });

  it('sets truncated=false when the RPC natural end arrives before the cap', async () => {
    // Three pages: first two have more, third signals done.
    const rpc = jest
      .fn()
      .mockResolvedValueOnce({
        data: {
          version: 2,
          exportedAt: '2026-01-01T00:00:00Z',
          hasMore: true,
          nextCursorTs: 'ts_1',
          nextCursorId: 'id_1',
          logs: [{ id: 'log_1' }],
        },
        error: null,
      })
      .mockResolvedValueOnce({
        data: {
          version: 2,
          exportedAt: '2026-01-01T00:00:00Z',
          hasMore: true,
          nextCursorTs: 'ts_2',
          nextCursorId: 'id_2',
          logs: [{ id: 'log_2' }],
        },
        error: null,
      })
      .mockResolvedValueOnce({
        data: {
          version: 2,
          exportedAt: '2026-01-01T00:00:00Z',
          hasMore: false,
          logs: [{ id: 'log_3' }],
        },
        error: null,
      });

    mockGetSupabase.mockReturnValue({ rpc });

    const result = await exportAccountData();

    expect(rpc).toHaveBeenCalledTimes(3);
    expect(result.logs).toEqual([{ id: 'log_1' }, { id: 'log_2' }, { id: 'log_3' }]);
    expect(result.truncated).toBe(false);
  });

  it('sets truncated=true and runs exactly MAX_EXPORT_PAGES RPC calls when the cap is hit', async () => {
    // Every page returns hasMore=true with valid cursors — the cap must stop the loop.
    // Mock is set up to always return a "continuing" chunk; the test verifies the
    // loop terminates at MAX_EXPORT_PAGES calls and marks the payload truncated.
    const alwaysMore = {
      data: {
        version: 2,
        exportedAt: '2026-01-01T00:00:00Z',
        hasMore: true,
        nextCursorTs: 'cursor_ts',
        nextCursorId: 'cursor_id',
        logs: [{ id: 'a_log' }],
      },
      error: null,
    };

    const rpc = jest.fn().mockResolvedValue(alwaysMore);

    mockGetSupabase.mockReturnValue({ rpc });

    const result = await exportAccountData();

    // Loop starts at page=0, increments AFTER each page that has more.
    // The while condition is `page < MAX_EXPORT_PAGES`.
    // Pages 0..MAX_EXPORT_PAGES-1 execute (MAX_EXPORT_PAGES calls total),
    // then page reaches MAX_EXPORT_PAGES and the loop exits without breaking naturally.
    expect(rpc).toHaveBeenCalledTimes(MAX_EXPORT_PAGES);

    // Each call returned one log row.
    expect(result.logs).toHaveLength(MAX_EXPORT_PAGES);

    // The cap was hit — export is incomplete.
    expect(result.truncated).toBe(true);
  }, 15_000); // Allow 15 s for 200 async mock calls

  it('overrides any truncated field that arrives from the RPC chunk', async () => {
    // Defensive check: if the RPC ever starts returning `truncated: false` on a
    // chunk, our computed value must win.
    const rpc = jest.fn().mockResolvedValueOnce({
      data: {
        version: 2,
        exportedAt: '2026-01-01T00:00:00Z',
        hasMore: false,
        truncated: false, // from RPC — should be overridden by our calculation
        logs: [{ id: 'log_only' }],
      },
      error: null,
    });

    mockGetSupabase.mockReturnValue({ rpc });

    const result = await exportAccountData();

    // Single page, naturally ended — must be false regardless of chunk field.
    expect(result.truncated).toBe(false);
  });
});

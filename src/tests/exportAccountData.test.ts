import { exportAccountData } from '@/services/exportAccountData';
import { AppError } from '@/lib/errors';

jest.mock('@/lib/supabase', () => ({
  getSupabase: jest.fn(),
}));

import { getSupabase } from '@/lib/supabase';

const mockGetSupabase = getSupabase as jest.Mock;

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
      p_limit: 5000,
    });
    expect(rpc.mock.calls[1][1]).toMatchObject({
      p_cursor_ts: '2026-01-01T00:00:00Z',
      p_cursor_id: 'log_a',
    });
    expect(result.logs).toEqual([{ id: 'log_a' }, { id: 'log_b' }]);
    expect(result.profile).toEqual({ baselinePerDay: 10 });
  });

  it('throws on RPC error', async () => {
    mockGetSupabase.mockReturnValue({
      rpc: jest.fn().mockResolvedValue({ data: null, error: { message: 'boom' } }),
    });
    await expect(exportAccountData()).rejects.toBeInstanceOf(AppError);
  });
});

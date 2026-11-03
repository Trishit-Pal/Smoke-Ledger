import { eraseAllUserData } from '@/services/cloudErase';

jest.mock('@/lib/supabase', () => ({ getSupabase: jest.fn() }));
jest.mock('@/lib/logger', () => ({ logClientError: jest.fn() }));
jest.mock('@/services/analytics', () => ({ invalidateAnalyticsConsentCache: jest.fn() }));

import { getSupabase } from '@/lib/supabase';
import { logClientError } from '@/lib/logger';
import { invalidateAnalyticsConsentCache } from '@/services/analytics';

const mockGetSupabase = getSupabase as jest.Mock;
const mockLog = logClientError as jest.Mock;
const mockInvalidate = invalidateAnalyticsConsentCache as jest.Mock;

function client(rpcResult: unknown, refresh: jest.Mock) {
  return { rpc: jest.fn().mockResolvedValue(rpcResult), auth: { refreshSession: refresh } };
}

describe('eraseAllUserData', () => {
  beforeEach(() => {
    mockGetSupabase.mockReset();
    mockLog.mockReset();
    mockInvalidate.mockReset();
  });

  it('clears the cached analytics consent after a successful erase', async () => {
    const refresh = jest.fn().mockResolvedValue({ error: null });
    mockGetSupabase.mockReturnValue(client({ error: null }, refresh));
    await eraseAllUserData();
    expect(mockInvalidate).toHaveBeenCalledTimes(1);
  });

  it('does not clear the analytics consent cache when the erase fails', async () => {
    const refresh = jest.fn();
    mockGetSupabase.mockReturnValue(client({ error: { message: 'boom' } }, refresh));
    await expect(eraseAllUserData()).rejects.toThrow('boom');
    expect(mockInvalidate).not.toHaveBeenCalled();
  });

  it('refreshes the session after a successful erase so the JWT drops the old metadata', async () => {
    const refresh = jest.fn().mockResolvedValue({ error: null });
    mockGetSupabase.mockReturnValue(client({ error: null }, refresh));
    await eraseAllUserData();
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(mockLog).not.toHaveBeenCalled();
  });

  it('does not refresh when the erase fails', async () => {
    const refresh = jest.fn();
    mockGetSupabase.mockReturnValue(client({ error: { message: 'boom' } }, refresh));
    await expect(eraseAllUserData()).rejects.toThrow('boom');
    expect(refresh).not.toHaveBeenCalled();
  });

  it('logs but does not fail when the refresh returns an error', async () => {
    const refresh = jest.fn().mockResolvedValue({ error: new Error('refresh failed') });
    mockGetSupabase.mockReturnValue(client({ error: null }, refresh));
    await expect(eraseAllUserData()).resolves.toBeUndefined();
    expect(mockLog).toHaveBeenCalledWith(expect.any(Error), { category: 'erase.refresh_session' });
  });

  it('logs but does not fail when the refresh throws', async () => {
    const refresh = jest.fn().mockRejectedValue(new Error('network'));
    mockGetSupabase.mockReturnValue(client({ error: null }, refresh));
    await expect(eraseAllUserData()).resolves.toBeUndefined();
    expect(mockLog).toHaveBeenCalledTimes(1);
  });
});

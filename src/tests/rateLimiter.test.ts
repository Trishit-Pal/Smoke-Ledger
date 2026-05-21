import {
  RateLimits,
  getPinLockoutState,
  recordPinFailure,
  recordPinSuccess,
} from '@/lib/rateLimiter';

jest.mock('@/lib/supabase', () => ({
  getSupabase: jest.fn(),
}));

jest.mock('@/lib/secureStore', () => ({
  readFailedAttempts: jest.fn(async () => 0),
  readLockoutUntil: jest.fn(async () => null),
  writeFailedAttempts: jest.fn(async () => {}),
  writeLockoutUntil: jest.fn(async () => {}),
}));

import {
  readFailedAttempts,
  readLockoutUntil,
  writeFailedAttempts,
  writeLockoutUntil,
} from '@/lib/secureStore';

const mockAttempts = readFailedAttempts as jest.Mock;
const mockLockout = readLockoutUntil as jest.Mock;

describe('PIN lockout state machine', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAttempts.mockResolvedValue(0);
    mockLockout.mockResolvedValue(null);
  });

  it('starts unlocked with full attempts remaining', async () => {
    const state = await getPinLockoutState(1_000_000);
    expect(state.locked).toBe(false);
    expect(state.attemptsRemaining).toBe(RateLimits.MAX_PIN_ATTEMPTS);
  });

  it('locks after max failures', async () => {
    mockAttempts.mockResolvedValue(RateLimits.MAX_PIN_ATTEMPTS - 1);
    const state = await recordPinFailure(1_000_000);
    expect(state.locked).toBe(true);
    expect(writeLockoutUntil).toHaveBeenCalled();
  });

  it('resets on success', async () => {
    await recordPinSuccess();
    expect(writeFailedAttempts).toHaveBeenCalledWith(0);
    expect(writeLockoutUntil).toHaveBeenCalledWith(null);
  });
});

import { getSupabase } from '@/lib/supabase';
import { recordAuditEvent } from '@/services/audit';
import { logClientError } from '@/lib/logger';
import { setSetting } from '@/db/repositories/settings';
import {
  recordConsentWithdrawal,
  recordWithdrawalAfter,
  saveAnalyticsOptIn,
} from '@/services/consentWithdrawal';

jest.mock('@/lib/supabase', () => ({ getSupabase: jest.fn() }));
jest.mock('@/services/audit', () => ({ recordAuditEvent: jest.fn() }));
jest.mock('@/lib/logger', () => ({ logClientError: jest.fn() }));
jest.mock('@/db/repositories/settings', () => ({ setSetting: jest.fn() }));

const rpc = jest.fn();
beforeEach(() => {
  jest.clearAllMocks();
  rpc.mockResolvedValue({ data: 0, error: null });
  (getSupabase as jest.Mock).mockReturnValue({ rpc });
});

describe('recordConsentWithdrawal', () => {
  it.each(['erase', 'delete'] as const)('emits consent_revoked for a withdrawal ending in %s', async (outcome) => {
    await recordConsentWithdrawal(outcome);
    expect(recordAuditEvent).toHaveBeenCalledWith('consent_revoked', 'compliance', {
      reason: `health_data_withdrawn_then_${outcome}`,
    });
  });

  it('never blocks the erase or delete when the audit write fails, and logs it', async () => {
    (recordAuditEvent as jest.Mock).mockRejectedValueOnce(new Error('audit down'));
    await expect(recordConsentWithdrawal('erase')).resolves.toBeUndefined();
    expect(logClientError).toHaveBeenCalled();
  });
});

/**
 * The audit row describes an erase/delete that happened. Writing it first left a
 * "consent withdrawn" row behind (one per retry) when the re-auth detour was
 * cancelled or the network failed and nothing was actually removed.
 */
describe('recordWithdrawalAfter', () => {
  it.each(['erase', 'delete'] as const)('writes consent_revoked only after the %s succeeded', async (outcome) => {
    const action = jest.fn().mockResolvedValue(undefined);
    await recordWithdrawalAfter(true, outcome, action);
    expect(recordAuditEvent).toHaveBeenCalledTimes(1);
    expect(recordAuditEvent).toHaveBeenCalledWith('consent_revoked', 'compliance', {
      reason: `health_data_withdrawn_then_${outcome}`,
    });
    expect(action.mock.invocationCallOrder[0]).toBeLessThan(
      (recordAuditEvent as jest.Mock).mock.invocationCallOrder[0],
    );
  });

  it('writes nothing when the action fails (cancel, re-auth redirect, network) and rethrows', async () => {
    const action = jest.fn().mockRejectedValue(new Error('reauth_required'));
    await expect(recordWithdrawalAfter(true, 'delete', action)).rejects.toThrow('reauth_required');
    expect(recordAuditEvent).not.toHaveBeenCalled();
  });

  it('writes nothing for an ordinary erase/delete that is not a withdrawal', async () => {
    await recordWithdrawalAfter(false, 'erase', jest.fn().mockResolvedValue(undefined));
    expect(recordAuditEvent).not.toHaveBeenCalled();
  });

  it('an audit failure after a successful action does not turn it into a failure', async () => {
    (recordAuditEvent as jest.Mock).mockRejectedValueOnce(new Error('audit down'));
    await expect(
      recordWithdrawalAfter(true, 'erase', jest.fn().mockResolvedValue(undefined)),
    ).resolves.toBeUndefined();
  });
});

describe('saveAnalyticsOptIn', () => {
  it('turning analytics off deletes past usage events, then stores the preference', async () => {
    await saveAnalyticsOptIn(false);
    expect(rpc).toHaveBeenCalledWith('delete_my_usage_events');
    expect(setSetting).toHaveBeenCalledWith('consent.analyticsOptIn', false);
    expect(rpc.mock.invocationCallOrder[0]).toBeLessThan(
      (setSetting as jest.Mock).mock.invocationCallOrder[0],
    );
  });

  it('turning analytics on deletes nothing', async () => {
    await saveAnalyticsOptIn(true);
    expect(rpc).not.toHaveBeenCalled();
    expect(setSetting).toHaveBeenCalledWith('consent.analyticsOptIn', true);
  });

  it('keeps the preference on when the delete fails, so the reader can retry', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'rpc down' } });
    await expect(saveAnalyticsOptIn(false)).rejects.toThrow('rpc down');
    expect(setSetting).not.toHaveBeenCalled();
  });
});

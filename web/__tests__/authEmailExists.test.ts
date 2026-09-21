import { describe, it, expect, vi, beforeEach } from 'vitest';
import { toAuthErrorMessage } from '@/lib/auth-errors';

const createAdminClient = vi.fn();

vi.mock('@web/lib/supabase/admin', () => ({
  createAdminClient: () => createAdminClient(),
}));

import {
  presenceFromRpc,
  classifyInvalidCredentials,
  lookupAuthEmail,
} from '@web/lib/auth/authEmailExists';

describe('presenceFromRpc', () => {
  it('is absent when the RPC returns false', () => {
    expect(presenceFromRpc(false, null)).toBe('absent');
  });

  it('is present when the RPC returns true', () => {
    expect(presenceFromRpc(true, null)).toBe('present');
  });

  it('is unknown when admin is missing or the RPC errors', () => {
    expect(presenceFromRpc(null, null)).toBe('unknown');
    expect(presenceFromRpc(true, { message: 'function not found' })).toBe('unknown');
  });
});

describe('classifyInvalidCredentials', () => {
  it('absent → unregistered copy', () => {
    const code = classifyInvalidCredentials('absent');
    expect(code).toBe('email_not_registered');
    expect(toAuthErrorMessage({ code })).toBe('No ledger for this email.');
  });

  it('present → mismatch copy', () => {
    const code = classifyInvalidCredentials('present');
    expect(code).toBe('password_mismatch');
    expect(toAuthErrorMessage({ code })).toBe("That password doesn't match this email.");
  });

  it('unknown fail-closes to generic credentials', () => {
    const code = classifyInvalidCredentials('unknown');
    expect(code).toBe('invalid_credentials');
    expect(toAuthErrorMessage({ code })).toBe('Email or password is incorrect.');
  });
});

describe('lookupAuthEmail', () => {
  beforeEach(() => {
    createAdminClient.mockReset();
  });

  it('resolves unknown and does not throw when rpc rejects', async () => {
    createAdminClient.mockReturnValue({
      rpc: () => Promise.reject(new Error('boom')),
    });
    await expect(lookupAuthEmail('a@b.co')).resolves.toBe('unknown');
  });

  it('resolves unknown when the admin client is missing', async () => {
    createAdminClient.mockReturnValue(null);
    await expect(lookupAuthEmail('a@b.co')).resolves.toBe('unknown');
  });
});

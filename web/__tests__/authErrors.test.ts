import { describe, it, expect } from 'vitest';
import { toAuthErrorMessage, getAuthErrorCode } from '@/lib/auth-errors';

describe('getAuthErrorCode', () => {
  it('extracts code from an error object with a code property', () => {
    expect(getAuthErrorCode({ code: 'invalid_credentials' })).toBe('invalid_credentials');
  });

  it('derives invalid_credentials from message', () => {
    expect(getAuthErrorCode({ message: 'Invalid login credentials' })).toBe('invalid_credentials');
  });

  it('derives email_not_confirmed from message', () => {
    expect(getAuthErrorCode({ message: 'Email not confirmed' })).toBe('email_not_confirmed');
  });

  it('derives too_many_requests from rate limit message', () => {
    expect(getAuthErrorCode({ message: 'rate limit exceeded' })).toBe('too_many_requests');
  });

  it('returns empty string for unknown error', () => {
    expect(getAuthErrorCode({ message: 'something went wrong' })).toBe('');
  });

  it('returns empty string for non-object', () => {
    expect(getAuthErrorCode(null)).toBe('');
    expect(getAuthErrorCode('string error')).toBe('');
  });

  it('maps user_not_found and OTP signup-disabled to email_not_registered', () => {
    expect(getAuthErrorCode({ code: 'user_not_found' })).toBe('email_not_registered');
    expect(getAuthErrorCode({ message: 'Signups not allowed for otp' })).toBe(
      'email_not_registered',
    );
  });

  it('maps otp_disabled by Signups-not-allowed sentence, not by code alone', () => {
    expect(
      getAuthErrorCode({ code: 'otp_disabled', message: 'Signups not allowed for otp' }),
    ).toBe('email_not_registered');
    expect(getAuthErrorCode({ code: 'otp_disabled' })).toBe('otp_disabled');
  });
});

describe('toAuthErrorMessage', () => {
  it('returns correct message for invalid_credentials', () => {
    const msg = toAuthErrorMessage({ code: 'invalid_credentials' });
    expect(msg).toBe('Email or password is incorrect.');
  });

  it('returns correct message for email_not_confirmed', () => {
    const msg = toAuthErrorMessage({ code: 'email_not_confirmed' });
    expect(msg).toContain('confirm your email');
  });

  it('returns correct message for too_many_requests', () => {
    const msg = toAuthErrorMessage({ code: 'too_many_requests' });
    expect(msg).toContain('Too many');
  });

  it('returns correct message for captcha_required', () => {
    const msg = toAuthErrorMessage({ code: 'captcha_required' });
    expect(msg).toContain('Security check');
  });

  it('falls back to safe error message for unknown code', () => {
    const msg = toAuthErrorMessage({ message: 'some unexpected error' });
    expect(typeof msg).toBe('string');
    expect(msg.length).toBeGreaterThan(0);
  });

  it('returns no-ledger copy for email_not_registered', () => {
    expect(toAuthErrorMessage({ code: 'email_not_registered' })).toBe(
      'No ledger for this email.',
    );
  });

  it('returns mismatch copy for password_mismatch', () => {
    expect(toAuthErrorMessage({ code: 'password_mismatch' })).toBe(
      "That password doesn't match this email.",
    );
  });
});

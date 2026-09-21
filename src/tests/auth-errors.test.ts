import {
  toAuthErrorMessage,
  getAuthErrorCode,
} from '@/lib/auth-errors';

describe('auth-errors', () => {
  it('maps Supabase message-only invalid login errors', () => {
    expect(toAuthErrorMessage({ message: 'Invalid login credentials' })).toBe(
      'Email or password is incorrect.',
    );
  });

  it('maps captcha failures', () => {
    expect(toAuthErrorMessage({ message: 'captcha verification failed' })).toContain('Security check');
  });

  it('falls back to safe copy for unknown errors', () => {
    expect(toAuthErrorMessage({ code: 'unknown', message: 'something else' })).toBe(
      'Something went wrong. Please try again.',
    );
  });

  it('maps unknown-email OTP failures to no-ledger copy', () => {
    expect(toAuthErrorMessage({ message: 'Signups not allowed for otp' })).toBe(
      'No ledger for this email.',
    );
    expect(toAuthErrorMessage({ code: 'user_not_found' })).toBe('No ledger for this email.');
  });

  it('maps password_mismatch separately from invalid_credentials', () => {
    expect(toAuthErrorMessage({ code: 'password_mismatch' })).toBe(
      "That password doesn't match this email.",
    );
    expect(toAuthErrorMessage({ code: 'invalid_credentials' })).toBe(
      'Email or password is incorrect.',
    );
  });

  it('maps otp_disabled by Signups-not-allowed sentence, not by code alone', () => {
    expect(
      getAuthErrorCode({ code: 'otp_disabled', message: 'Signups not allowed for otp' }),
    ).toBe('email_not_registered');
    expect(getAuthErrorCode({ code: 'otp_disabled' })).toBe('otp_disabled');
  });
});

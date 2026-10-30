import {
  toAuthErrorMessage,
  getAuthErrorCode,
  isUnknownEmailError,
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

  it('never reveals whether an email has an account', () => {
    for (const error of [
      { message: 'Signups not allowed for otp' },
      { code: 'user_not_found' },
      { code: 'email_not_registered' },
      { code: 'password_mismatch' },
    ]) {
      expect(toAuthErrorMessage(error)).not.toMatch(/no ledger|doesn't match this email/i);
    }
  });

  it('flags unknown-email failures so a link sender can treat them like a successful send', () => {
    expect(isUnknownEmailError({ message: 'Signups not allowed for otp' })).toBe(true);
    expect(isUnknownEmailError({ code: 'user_not_found' })).toBe(true);
    expect(isUnknownEmailError({ code: 'invalid_credentials' })).toBe(false);
    expect(isUnknownEmailError({ code: 'otp_disabled' })).toBe(false);
    expect(isUnknownEmailError(null)).toBe(false);
  });

  it('keeps otp_disabled distinct from the Signups-not-allowed sentence', () => {
    expect(getAuthErrorCode({ code: 'otp_disabled' })).toBe('otp_disabled');
  });
});

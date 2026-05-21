import {
  isLoginHintStatus,
  loginHintMessage,
  toAuthErrorMessage,
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

  it('guards login hint status parsing', () => {
    expect(isLoginHintStatus('not_found')).toBe(true);
    expect(isLoginHintStatus(null)).toBe(false);
  });

  it('covers all login hint messages', () => {
    const statuses = ['not_found', 'unconfirmed', 'exists'] as const;
    for (const status of statuses) {
      expect(loginHintMessage(status).length).toBeGreaterThan(10);
    }
  });
});

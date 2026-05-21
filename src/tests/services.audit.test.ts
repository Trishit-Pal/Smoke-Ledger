import { isAuditSuccessStatus, redactAuditProps } from '@/services/audit';
import {
  isLoginHintStatus,
  loginHintMessage,
  toAuthErrorMessage,
} from '@/lib/auth-errors';

jest.mock('@/lib/supabase', () => ({
  getSupabase: jest.fn(),
}));

describe('isAuditSuccessStatus', () => {
  it('accepts 204 and 200', () => {
    expect(isAuditSuccessStatus(204)).toBe(true);
    expect(isAuditSuccessStatus(200)).toBe(true);
  });

  it('rejects error statuses', () => {
    expect(isAuditSuccessStatus(401)).toBe(false);
    expect(isAuditSuccessStatus(502)).toBe(false);
  });
});

describe('redactAuditProps', () => {
  it('strips PII denylist keys', () => {
    const out = redactAuditProps({
      termsVersion: '2026-05-19',
      email: 'user@example.com',
      password: 'secret',
      token: 'abc',
    });
    expect(out.termsVersion).toBe('2026-05-19');
    expect(out.email).toBeUndefined();
    expect(out.password).toBeUndefined();
    expect(out.token).toBeUndefined();
  });

  it('truncates long string values', () => {
    const out = redactAuditProps({ reason: 'x'.repeat(300) });
    expect(String(out.reason).length).toBeLessThanOrEqual(200);
  });

  it('drops non-primitive values', () => {
    const out = redactAuditProps({ nested: { a: 1 } as unknown as string });
    expect(Object.keys(out)).toHaveLength(0);
  });
});

describe('toAuthErrorMessage', () => {
  it('maps invalid credentials to login-friendly copy', () => {
    expect(
      toAuthErrorMessage({ code: 'invalid_credentials', message: 'Invalid login credentials' }),
    ).toBe('Email or password is incorrect.');
  });

  it('maps email_not_confirmed', () => {
    expect(toAuthErrorMessage({ code: 'email_not_confirmed', message: 'Email not confirmed' })).toContain(
      'confirm your email',
    );
  });

  it('maps rate limit errors', () => {
    expect(toAuthErrorMessage({ code: 'too_many_requests', message: 'Rate limit exceeded' })).toContain(
      'Too many attempts',
    );
  });
});

describe('loginHintMessage', () => {
  it('returns explicit copy for each hint status', () => {
    expect(loginHintMessage('not_found')).toContain('No account');
    expect(loginHintMessage('exists')).toContain('Incorrect password');
    expect(loginHintMessage('unconfirmed')).toContain('not confirmed');
  });

  it('validates hint status values', () => {
    expect(isLoginHintStatus('exists')).toBe(true);
    expect(isLoginHintStatus('unknown')).toBe(false);
  });
});

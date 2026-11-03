import { isAuditSuccessStatus, recordAuditEvent, redactAuditProps } from '@/services/audit';
import {
  toAuthErrorMessage,
} from '@/lib/auth-errors';

jest.mock('@/lib/supabase', () => ({
  getSupabase: jest.fn(),
}));

// The web path: recordAuditEvent posts to /api/audit. A middleware redirect used to
// be followed to an HTML page whose 200 passed as success, losing the audit row.
describe('recordAuditEvent on the web', () => {
  const g = globalThis as unknown as { window?: unknown; fetch: typeof fetch };
  const realFetch = g.fetch;
  const answer = (over: { status?: number; redirected?: boolean; type?: string }) =>
    jest.fn(async () => ({
      status: over.status ?? 200,
      redirected: over.redirected ?? false,
      headers: new Headers(over.type ? { 'content-type': over.type } : {}),
    })) as unknown as typeof fetch;

  beforeEach(() => {
    g.window = {};
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
  });
  afterEach(() => {
    delete g.window;
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    g.fetch = realFetch;
  });

  it.each([
    ['a followed redirect', { status: 200, redirected: true }],
    ['an HTML page', { status: 200, type: 'text/html; charset=utf-8' }],
  ])('counts %s as failure, never as a recorded audit', async (_n, over) => {
    g.fetch = answer(over);
    await expect(recordAuditEvent('consent_accepted', 'compliance', {})).rejects.toMatchObject({
      code: 'dependency_failure',
    });
  });

  it.each([
    ['204', { status: 204 }],
    ['a 200 with no body type', { status: 200 }],
    ['a 200 JSON answer', { status: 200, type: 'application/json' }],
  ])('accepts %s from the audit route', async (_n, over) => {
    g.fetch = answer(over);
    await expect(recordAuditEvent('consent_accepted', 'compliance', {})).resolves.toBeUndefined();
  });
});

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

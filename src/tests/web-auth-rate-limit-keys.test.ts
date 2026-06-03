/**
 * TDD for web/lib/auth/authRateLimitKeys.ts — pure builders that encode the
 * DB-backed token-bucket thresholds for the email-sending auth surfaces
 * (signup, password reset, resend confirmation). Keeping the thresholds in a
 * tested pure function (rather than inline in a 'use server' action that needs
 * next/headers) lets us assert the limits without booting the server runtime.
 * Written RED first.
 */
import {
  signupRateLimitKeys,
  resetRateLimitKeys,
  resendConfirmationRateLimitKeys,
} from '../../web/lib/auth/authRateLimitKeys';

const HOUR = 3600;

describe('auth rate-limit key builders', () => {
  it('signup is limited per IP (5/h) and per email (3/h)', () => {
    expect(signupRateLimitKeys('1.2.3.4', 'User@Example.com')).toEqual([
      { kind: 'signup_ip', key: '1.2.3.4', max: 5, windowSec: HOUR },
      { kind: 'signup_email', key: 'user@example.com', max: 3, windowSec: HOUR },
    ]);
  });

  it('reset is limited per IP (10/h) and per email (3/h)', () => {
    expect(resetRateLimitKeys('9.9.9.9', '  Foo@Bar.io ')).toEqual([
      { kind: 'reset_ip', key: '9.9.9.9', max: 10, windowSec: HOUR },
      { kind: 'reset_email', key: 'foo@bar.io', max: 3, windowSec: HOUR },
    ]);
  });

  it('resend confirmation is limited per email (3/h)', () => {
    expect(resendConfirmationRateLimitKeys('A@B.COM')).toEqual([
      { kind: 'resend_email', key: 'a@b.com', max: 3, windowSec: HOUR },
    ]);
  });

  it('normalizes the email key to trimmed lowercase for stable bucketing', () => {
    const [, emailKey] = signupRateLimitKeys('1.1.1.1', '  MixedCase@Mail.com  ');
    expect(emailKey.key).toBe('mixedcase@mail.com');
  });

  it('does not lowercase or trim the IP key', () => {
    const [ipKey] = signupRateLimitKeys('  2606:AB::1 ', 'x@y.com');
    expect(ipKey.key).toBe('  2606:AB::1 ');
  });
});

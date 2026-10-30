/**
 * TDD for web/lib/auth/authRateLimitKeys.ts — pure builders that encode the
 * DB-backed token-bucket thresholds for the email-sending auth surfaces
 * (signup, password reset, resend confirmation). Keeping the thresholds in a
 * tested pure function (rather than inline in a 'use server' action that needs
 * next/headers) lets us assert the limits without booting the server runtime.
 * Written RED first.
 */
import {
  loginRateLimitKeys,
  signupRateLimitKeys,
  resetRateLimitKeys,
  resendConfirmationRateLimitKeys,
} from '../../web/lib/auth/authRateLimitKeys';

const HOUR = 3600;

describe('auth rate-limit key builders', () => {
  it('login is limited per IP (10/10min), per email+IP pair (5/15min) and per email (30/h)', () => {
    expect(loginRateLimitKeys('1.2.3.4', ' User@Example.com ')).toEqual([
      { kind: 'pw_login_ip', key: '1.2.3.4', max: 10, windowSec: 600 },
      { kind: 'pw_login_email', key: 'user@example.com|1.2.3.4', max: 5, windowSec: 900 },
      { kind: 'pw_login_email_global', key: 'user@example.com', max: 30, windowSec: HOUR },
    ]);
  });

  it('login keeps a per-account cap that many attacker IPs share', () => {
    const [, , fromA] = loginRateLimitKeys('203.0.113.9', 'victim@example.com');
    const [, , fromB] = loginRateLimitKeys('198.51.100.4', 'Victim@Example.com');
    expect(fromA.key).toBe(fromB.key);
  });

  it('login email bucket is per attacker address, so a stranger cannot lock a victim out', () => {
    const [, fromAttacker] = loginRateLimitKeys('203.0.113.9', 'victim@example.com');
    const [, fromVictim] = loginRateLimitKeys('198.51.100.4', 'victim@example.com');
    expect(fromAttacker.key).not.toBe(fromVictim.key);
  });

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

/**
 * Phone sign-in is opt-in. It used to be on unless the flag was literally
 * 'false', so an unset flag offered a sign-in method production cannot serve
 * (send-sms-otp is not deployed), contradicting web/.env.example.
 */
import { isPhoneOtpEnabled } from '../../web/lib/auth/phone';

describe('isPhoneOtpEnabled', () => {
  const env = process.env as Record<string, string | undefined>;
  const original = env.NEXT_PUBLIC_PHONE_OTP_ENABLED;
  afterEach(() => {
    env.NEXT_PUBLIC_PHONE_OTP_ENABLED = original;
  });

  it('is on only when explicitly "true"', () => {
    env.NEXT_PUBLIC_PHONE_OTP_ENABLED = 'true';
    expect(isPhoneOtpEnabled()).toBe(true);
  });

  it.each([undefined, '', 'false', '1', 'TRUE '])('is off for %j', (value) => {
    env.NEXT_PUBLIC_PHONE_OTP_ENABLED = value;
    if (value === undefined) delete env.NEXT_PUBLIC_PHONE_OTP_ENABLED;
    expect(isPhoneOtpEnabled()).toBe(false);
  });
});

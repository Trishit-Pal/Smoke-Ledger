/**
 * `type` values this app issues email links for. Supabase also accepts `invite`
 * and `email_change`, but nothing here sends them, so a link carrying one is
 * forged or stale and must not reach verifyOtp.
 */
const EMAIL_OTP_TYPES = ['signup', 'recovery', 'magiclink', 'email'] as const;

export type AllowedEmailOtpType = (typeof EMAIL_OTP_TYPES)[number];

export function parseEmailOtpType(raw: string | null | undefined): AllowedEmailOtpType | null {
  return EMAIL_OTP_TYPES.find((type) => type === raw) ?? null;
}

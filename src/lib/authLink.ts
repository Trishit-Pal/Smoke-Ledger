import { parseEmailOtpType, type AllowedEmailOtpType } from '@/lib/emailOtpType';

/**
 * What an auth link asks for, decided before anything is redeemed.
 *
 * - `exchange`: a PKCE `code`. Only the device holding the code_verifier can
 *   use it, so it may be exchanged as soon as the link opens.
 * - `confirm`: a `token_hash`. Anyone holding the link can redeem it, so merely
 *   opening one (an attacker's link, a navigation, a mail scanner) must not sign
 *   a device in. The person on the device confirms first.
 * - `invalid`: anything else, including raw session tokens (the old implicit
 *   flow), which are never accepted from a link.
 */
export type AuthLink =
  | { kind: 'exchange'; code: string; type: AllowedEmailOtpType | null }
  | { kind: 'confirm'; tokenHash: string; type: AllowedEmailOtpType }
  | { kind: 'invalid' };

export function readAuthLink(params: URLSearchParams): AuthLink {
  const type = parseEmailOtpType(params.get('type'));

  const code = params.get('code');
  if (code) return { kind: 'exchange', code, type };

  const tokenHash = params.get('token_hash');
  if (tokenHash && type) return { kind: 'confirm', tokenHash, type };

  return { kind: 'invalid' };
}

/** The web confirm page for a token_hash link. `next` must already be sanitized. */
export function confirmLinkPath(
  link: { tokenHash: string; type: AllowedEmailOtpType },
  next: string | null,
): string {
  const query = new URLSearchParams({ token_hash: link.tokenHash, type: link.type });
  if (next) query.set('next', next);
  return `/auth/confirm?${query.toString()}`;
}

/**
 * How to name the account already signed in on this device, or null when
 * nobody is. Any session counts, phone-only included: the account-switch
 * warning must not depend on the session having an email.
 */
export function maskAccount(
  user: { email?: string | null; phone?: string | null } | null | undefined,
): string | null {
  if (!user) return null;
  const digits = (user.phone ?? '').replace(/\D/g, '');
  return maskEmail(user.email) ?? (digits.length >= 4 ? `•••${digits.slice(-4)}` : 'another account');
}

/** `jane.doe@example.com` -> `j•••@example.com`, enough to recognise an account. */
export function maskEmail(email: string | null | undefined): string | null {
  const trimmed = email?.trim() ?? '';
  const at = trimmed.indexOf('@');
  if (at < 1 || at === trimmed.length - 1) return null;
  return `${trimmed[0]}•••${trimmed.slice(at)}`;
}

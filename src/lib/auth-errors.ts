import { toSafeErrorMessage } from '@/lib/errors';

export function getAuthErrorCode(error: unknown): string {
  return readAuthErrorCode(error);
}

function readAuthErrorCode(error: unknown): string {
  if (!error || typeof error !== 'object') return '';
  const record = error as { code?: string; message?: string };
  const code = record.code ?? '';
  const msg = (record.message ?? '').toLowerCase();

  if (code) return code;
  if (msg.includes('invalid login credentials')) return 'invalid_credentials';
  if (msg.includes('email not confirmed')) return 'email_not_confirmed';
  if (msg.includes('rate limit') || msg.includes('too many')) return 'too_many_requests';
  if (msg.includes('captcha')) return 'captcha_required';
  return '';
}

/**
 * GoTrue's answer to a sign-in-link request for an address with no account.
 * Callers must treat it exactly like a successful send, or the error text tells
 * a stranger whether an email has a ledger.
 */
export function isUnknownEmailError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const { code, message } = error as { code?: string; message?: string };
  return code === 'user_not_found' || /signups not allowed for otp/i.test(message ?? '');
}

export function toAuthErrorMessage(error: unknown): string {
  const code = readAuthErrorCode(error);

  if (code === 'email_not_confirmed') {
    return 'Please confirm your email before signing in. Check your inbox for the confirmation link.';
  }
  if (code === 'invalid_credentials') {
    return 'Email or password is incorrect.';
  }
  if (code === 'too_many_requests') {
    return 'Too many attempts. Please wait and try again.';
  }
  if (code === 'captcha_required') {
    return 'Security check failed or is not configured on this device. Please try again or contact support.';
  }

  return toSafeErrorMessage(error, 'authentication_error');
}


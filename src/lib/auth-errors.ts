import { toSafeErrorMessage } from '@/lib/errors';

export function getAuthErrorCode(error: unknown): string {
  return readAuthErrorCode(error);
}

function readAuthErrorCode(error: unknown): string {
  if (!error || typeof error !== 'object') return '';
  const record = error as { code?: string; message?: string };
  if (record.code) return record.code;
  const msg = (record.message ?? '').toLowerCase();
  if (msg.includes('invalid login credentials')) return 'invalid_credentials';
  if (msg.includes('email not confirmed')) return 'email_not_confirmed';
  if (msg.includes('rate limit') || msg.includes('too many')) return 'too_many_requests';
  return '';
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

  if (error && typeof error === 'object') {
    const msg = ((error as { message?: string }).message ?? '').toLowerCase();
    if (msg.includes('captcha')) {
      return 'Security check failed. Please try again.';
    }
  }

  return toSafeErrorMessage(error, 'authentication_error');
}


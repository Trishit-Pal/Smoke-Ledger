export type AppErrorCode =
  | 'validation_error'
  | 'authentication_error'
  | 'authorization_error'
  | 'not_found'
  | 'conflict'
  | 'rate_limited'
  | 'dependency_failure'
  | 'timeout'
  | 'internal_error';

const SAFE_MESSAGES: Record<AppErrorCode, string> = {
  validation_error: 'Please review your input and try again.',
  authentication_error: 'Please sign in again to continue.',
  authorization_error: 'You do not have permission to perform this action.',
  not_found: 'The requested item could not be found.',
  conflict: 'This action conflicts with current data. Refresh and retry.',
  rate_limited: 'Too many requests. Please wait and try again.',
  dependency_failure: 'A backend dependency failed. Please retry shortly.',
  timeout: 'The request timed out. Please try again.',
  internal_error: 'Something went wrong. Please try again.',
};

/**
 * Typed application error. UI code can switch on `code` for routing; raw
 * messages are kept internal and never surfaced verbatim via
 * `toSafeErrorMessage`.
 */
export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly cause?: unknown;
  constructor(code: AppErrorCode, message?: string, cause?: unknown) {
    super(message ?? SAFE_MESSAGES[code]);
    this.code = code;
    this.cause = cause;
    this.name = 'AppError';
  }
}

export function isAppError(value: unknown): value is AppError {
  return value instanceof AppError;
}

export function classifyError(error: unknown): AppErrorCode {
  if (isAppError(error)) return error.code;
  const message = error instanceof Error ? error.message.toLowerCase() : '';
  if (!message) return 'internal_error';
  if (message.includes('validation') || message.startsWith('enter a ')) return 'validation_error';
  if (message.includes('not authenticated') || message.includes('invalid login')) {
    return 'authentication_error';
  }
  if (message.includes('permission') || message.includes('forbidden')) {
    return 'authorization_error';
  }
  if (message.includes('not found')) return 'not_found';
  if (message.includes('conflict') || message.includes('already')) return 'conflict';
  if (message.includes('rate limit') || message.includes('too many')) return 'rate_limited';
  if (message.includes('timeout') || message.includes('timed out')) return 'timeout';
  if (message.includes('network') || message.includes('failed to fetch') || message.includes('server')) {
    return 'dependency_failure';
  }
  return 'internal_error';
}

export function toSafeErrorMessage(
  error: unknown,
  fallbackCode: AppErrorCode = 'internal_error',
): string {
  const code = classifyError(error) || fallbackCode;
  return SAFE_MESSAGES[code] ?? SAFE_MESSAGES[fallbackCode];
}

/**
 * Specific, actionable user-facing copy per code — richer than `SAFE_MESSAGES`,
 * which stays terse for security-sensitive callers. Used for UI surfaces (e.g.
 * Settings forms) where a vague "Something went wrong" leaves the user stuck.
 */
const SPECIFIC_MESSAGES: Record<AppErrorCode, string> = {
  validation_error: 'Please check your input and try again.',
  authentication_error: 'Your session expired. Please sign in again.',
  authorization_error: 'You do not have permission to do that.',
  not_found: 'We could not find what you were looking for.',
  conflict: 'That conflicts with existing data. Refresh and try again.',
  rate_limited: 'Too many attempts. Please wait a moment and try again.',
  dependency_failure: 'Could not reach the server. Check your connection and try again.',
  timeout: 'The request timed out. Check your connection and try again.',
  internal_error: 'Something went wrong. Please try again.',
};

// Fragments that mark a message as raw infrastructure detail we must not show.
const UNSAFE_FRAGMENTS = [
  'constraint',
  'relation',
  'violates',
  'syntax',
  'sql',
  'pgrst',
  'null value',
  'column',
  'duplicate key',
  'permission denied for',
  'function',
  'database',
  'supabase',
];

function isDisplaySafeMessage(message: string): boolean {
  if (!message) return false;
  if (message.length > 160) return false;
  const lower = message.toLowerCase();
  return !UNSAFE_FRAGMENTS.some((fragment) => lower.includes(fragment));
}

/**
 * User-facing error copy that is specific without leaking internals. Authored
 * validation messages (short, no infra detail) pass through verbatim so the
 * user sees exactly what to fix; everything else maps to curated per-code copy.
 */
export function describeError(
  error: unknown,
  fallbackCode: AppErrorCode = 'internal_error',
): string {
  const code = isAppError(error) ? error.code : classifyError(error) || fallbackCode;
  if (
    code === 'validation_error' &&
    error instanceof Error &&
    isDisplaySafeMessage(error.message)
  ) {
    return error.message;
  }
  return SPECIFIC_MESSAGES[code] ?? SPECIFIC_MESSAGES[fallbackCode];
}

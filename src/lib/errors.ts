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
  if (message.includes('validation')) return 'validation_error';
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

// Fast-fail timeout for auth network calls.
//
// Supabase auth calls (sign-in, sign-up, reset) can hang for 30–60s when the
// backend is slow or unreachable, leaving the form spinner stuck. Racing them
// against a timer lets the UI surface a clear "temporarily unavailable" error
// in ~15s instead. Accepts any PromiseLike so it composes with the Supabase
// client's thenable query builders, not just native Promises.

export class TimeoutError extends Error {
  constructor(message = 'Operation timed out') {
    super(message);
    this.name = 'TimeoutError';
  }
}

/** Default deadline for interactive auth calls. */
export const DEFAULT_AUTH_TIMEOUT_MS = 15_000;

export function withTimeout<T>(promise: PromiseLike<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new TimeoutError(`Operation timed out after ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

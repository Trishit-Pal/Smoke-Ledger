import { getSupabase } from '@/lib/supabase';
import { AppError, type AppErrorCode } from '@/lib/errors';

export async function requireUserId(): Promise<string> {
  const supabase = getSupabase();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) throw new AppError('authentication_error', 'Not authenticated');
  return user.id;
}

type SupabaseErrorish = {
  code?: string;
  message?: string;
  details?: string | null;
  hint?: string | null;
  status?: number;
};

/**
 * Maps Postgrest / Supabase auth errors to our typed AppErrorCode set.
 * Keeps raw messages internal: callers should pass the returned AppError
 * straight through to `toSafeErrorMessage` for user-facing copy.
 */
export function mapDbError(err: unknown, fallback: AppErrorCode = 'dependency_failure'): AppError {
  if (err instanceof AppError) return err;
  const e = (err ?? {}) as SupabaseErrorish;
  const code = e.code ?? '';
  const msg = e.message ?? 'database_error';
  switch (code) {
    case '23505':
      return new AppError('conflict', msg, err);
    case '23503':
    case '23514':
    case '22P02':
    case '22023':
      return new AppError('validation_error', msg, err);
    case 'PGRST116': // row not found via .single()
    case '22P01':
      return new AppError('not_found', msg, err);
    case '42501': // insufficient privilege / RLS violation
      return new AppError('authorization_error', msg, err);
    case '54000': // raised by create_log_with_rate_limit
      return new AppError('rate_limited', msg, err);
    case 'P0001':
      if (/region_change_requires_reset/i.test(msg)) {
        return new AppError('region_change_requires_reset', msg, err);
      }
      return new AppError('validation_error', msg, err);
    default:
      break;
  }
  if (e.status === 401 || /not authenticated/i.test(msg)) {
    return new AppError('authentication_error', msg, err);
  }
  if (e.status === 403) {
    return new AppError('authorization_error', msg, err);
  }
  if (e.status === 404) {
    return new AppError('not_found', msg, err);
  }
  if (e.status === 409) {
    return new AppError('conflict', msg, err);
  }
  if (e.status === 429 || /rate limit|too many/i.test(msg)) {
    return new AppError('rate_limited', msg, err);
  }
  if (e.status && e.status >= 500) {
    return new AppError('dependency_failure', msg, err);
  }
  return new AppError(fallback, msg, err);
}

/**
 * Convenience wrapper for repo calls — throws an `AppError` instead of the
 * raw PostgrestError so business code can `catch (e) { toSafeErrorMessage(e) }`
 * uniformly.
 */
export function throwDbError(err: unknown, fallback?: AppErrorCode): never {
  throw mapDbError(err, fallback);
}

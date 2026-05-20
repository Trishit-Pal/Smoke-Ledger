// Abuse-prevention: log rate uses Supabase count (RLS-scoped to current user).

import { getSupabase } from '@/lib/supabase';
import {
  readFailedAttempts,
  readLockoutUntil,
  writeFailedAttempts,
  writeLockoutUntil,
} from '@/lib/secureStore';

export const RateLimits = {
  LOGS_PER_HOUR: 50,
  MAX_IMPORT_RECORDS: 10_000,
  MAX_PIN_ATTEMPTS: 5,
  PIN_LOCKOUT_MS: 30 * 60 * 1000,
} as const;

export class RateLimitError extends Error {
  constructor(
    message: string,
    public readonly retryAfterMs: number | null = null,
  ) {
    super(message);
    this.name = 'RateLimitError';
  }
}

export async function assertCanCreateLog(now: Date = new Date()): Promise<void> {
  const supabase = getSupabase();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
  const { count, error } = await supabase
    .from('cigarette_logs')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', oneHourAgo);
  if (error) throw new Error(error.message);
  const c = count ?? 0;
  if (c >= RateLimits.LOGS_PER_HOUR) {
    throw new RateLimitError(
      `Too many log entries in the last hour (limit ${RateLimits.LOGS_PER_HOUR}). Please wait a moment.`,
      60 * 60 * 1000,
    );
  }
}

export function assertImportSize(totalRecords: number): void {
  if (totalRecords > RateLimits.MAX_IMPORT_RECORDS) {
    throw new RateLimitError(
      `Import exceeds limit of ${RateLimits.MAX_IMPORT_RECORDS} records.`,
    );
  }
}

export interface PinLockoutState {
  locked: boolean;
  attemptsRemaining: number;
  remainingMs: number;
  lockoutUntil: number | null;
}

export async function getPinLockoutState(now: number = Date.now()): Promise<PinLockoutState> {
  const until = await readLockoutUntil();
  if (until && until > now) {
    return {
      locked: true,
      attemptsRemaining: 0,
      remainingMs: until - now,
      lockoutUntil: until,
    };
  }
  if (until && until <= now) {
    await writeLockoutUntil(null);
    await writeFailedAttempts(0);
  }
  const attempts = await readFailedAttempts();
  return {
    locked: false,
    attemptsRemaining: Math.max(0, RateLimits.MAX_PIN_ATTEMPTS - attempts),
    remainingMs: 0,
    lockoutUntil: null,
  };
}

export async function recordPinFailure(now: number = Date.now()): Promise<PinLockoutState> {
  const attempts = (await readFailedAttempts()) + 1;
  await writeFailedAttempts(attempts);
  if (attempts >= RateLimits.MAX_PIN_ATTEMPTS) {
    const until = now + RateLimits.PIN_LOCKOUT_MS;
    await writeLockoutUntil(until);
    return {
      locked: true,
      attemptsRemaining: 0,
      remainingMs: RateLimits.PIN_LOCKOUT_MS,
      lockoutUntil: until,
    };
  }
  return {
    locked: false,
    attemptsRemaining: RateLimits.MAX_PIN_ATTEMPTS - attempts,
    remainingMs: 0,
    lockoutUntil: null,
  };
}

export async function recordPinSuccess(): Promise<void> {
  await writeFailedAttempts(0);
  await writeLockoutUntil(null);
}

/**
 * How long each server-side record is kept before the daily purge deletes it.
 * Owner decision O5. The policy text renders from this object, and
 * src/tests/retention-purge.test.ts fails if the intervals in
 * supabase/migrations/20261104110000_retention_purge.sql (and the
 * rate_limit_counters job in 20261030000000) drift from these numbers.
 * There is no deletion for inactivity.
 */
export const RETENTION = {
  auditEventsMonths: 12,
  errorEventsDays: 90,
  usageEventsMonths: 12,
  rateLimitCountersDays: 2,
} as const;

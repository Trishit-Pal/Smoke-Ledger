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

/** Delete-account sublabel on web and mobile Settings; must agree with the privacy policy. */
export const DELETE_ACCOUNT_NOTE = `Your logs, preferences and identity are erased and your account is removed. Security records are anonymised and kept for ${RETENTION.auditEventsMonths} months, including a record that the deletion happened. This is permanent.`;

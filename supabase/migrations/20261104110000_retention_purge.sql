-- Retention purge (privacy & terms V3, owner decision O5).
--
-- Retention periods (keep in step with src/lib/privacy/retention.ts; a jest test
-- compares the two):
--   audit_events   12 months  (includes the account_data_erased erasure-proof
--                              row: the disclosed accountability record)
--   error_events   90 days    (already redacted when written)
--   usage_events   12 months  (opt-in analytics)
--   rate_limit_counters 2 days: unchanged, own job in 20261030000000
-- No deletion for inactivity.

CREATE OR REPLACE FUNCTION public.purge_expired_records()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  audit_purged integer;
  error_purged integer;
  usage_purged integer;
BEGIN
  DELETE FROM public.audit_events
  WHERE created_at < now() - interval '12 months';
  GET DIAGNOSTICS audit_purged = ROW_COUNT;

  DELETE FROM public.error_events
  WHERE created_at < now() - interval '90 days';
  GET DIAGNOSTICS error_purged = ROW_COUNT;

  DELETE FROM public.usage_events
  WHERE ts < now() - interval '12 months';
  GET DIAGNOSTICS usage_purged = ROW_COUNT;

  RETURN jsonb_build_object(
    'audit_events', audit_purged,
    'error_events', error_purged,
    'usage_events', usage_purged
  );
END;
$$;

REVOKE ALL ON FUNCTION public.purge_expired_records() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purge_expired_records() TO service_role;

-- Daily at 03:37, off the rate-limit job's 03:17. cron.schedule with an existing
-- job name updates it in place, so re-running this migration is idempotent.
-- Guarded: without pg_cron the migration only warns; scripts/sql/smoke.sql fails
-- CI when pg_cron is installed but the job is missing.
DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'pg_cron unavailable (%); purge_expired_records is NOT scheduled', SQLERRM;
END$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule(
      'purge-expired-records',
      '37 3 * * *',
      'SELECT public.purge_expired_records()'
    );
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'cron.schedule failed (%); purge_expired_records is NOT scheduled', SQLERRM;
END$$;

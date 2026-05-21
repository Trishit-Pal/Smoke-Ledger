-- Migration smoke: assert critical functions exist after db push.
-- Run via: psql $DATABASE_URL -f scripts/sql/smoke.sql

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'export_account_data'
  ) THEN
    RAISE EXCEPTION 'missing function export_account_data';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'create_log_with_rate_limit'
  ) THEN
    RAISE EXCEPTION 'missing function create_log_with_rate_limit';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'record_audit_event'
  ) THEN
    RAISE EXCEPTION 'missing function record_audit_event';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_tables
    WHERE schemaname = 'public' AND tablename = 'audit_events'
  ) THEN
    RAISE EXCEPTION 'missing table audit_events';
  END IF;
END $$;

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

  -- H1: compliance.delete tamper-resistance — CHECK constraint must exist.
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'error_events_compliance_delete_null_user_check'
  ) THEN
    RAISE EXCEPTION 'missing constraint error_events_compliance_delete_null_user_check (H1)';
  END IF;

  -- H1: error_events INSERT policy must exist (only own rows, no compliance.delete).
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'error_events'
      AND policyname = 'error_events_insert'
  ) THEN
    RAISE EXCEPTION 'missing RLS policy error_events_insert (H1)';
  END IF;

  -- H1: no DELETE policy for authenticated role (default-deny).
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'error_events'
      AND policyname = 'error_events_delete'
  ) THEN
    RAISE EXCEPTION 'unexpected RLS policy error_events_delete — must remain absent (H1)';
  END IF;

  -- H1: no UPDATE policy for authenticated role (default-deny).
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'error_events'
      AND policyname = 'error_events_update'
  ) THEN
    RAISE EXCEPTION 'unexpected RLS policy error_events_update — must remain absent (H1)';
  END IF;
END $$;

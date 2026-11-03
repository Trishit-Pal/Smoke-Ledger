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

  -- M2: single-column brand_id index must exist for brand-breakdown query plans.
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_logs_brand') THEN
    RAISE EXCEPTION 'idx_logs_brand index missing (M2)';
  END IF;

  -- M7: brand_variants.brand_id must be ON DELETE RESTRICT, not CASCADE.
  -- pg_constraint.confdeltype: 'r' = RESTRICT, 'c' = CASCADE, 'n' = SET NULL, 'a' = NO ACTION.
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.brand_variants'::regclass
      AND confrelid = 'public.brands'::regclass
      AND confdeltype = 'r'
  ) THEN
    RAISE EXCEPTION 'brand_variants.brand_id FK to brands must be ON DELETE RESTRICT (M7)';
  END IF;

  -- F1a: daily summary view must exist.
  IF NOT EXISTS (
    SELECT 1 FROM pg_views
    WHERE schemaname = 'public' AND viewname = 'v_daily_summary_user'
  ) THEN
    RAISE EXCEPTION 'missing view v_daily_summary_user (F1a)';
  END IF;

  -- F1a: get_daily_summary RPC must exist.
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'get_daily_summary'
  ) THEN
    RAISE EXCEPTION 'missing function get_daily_summary (F1a)';
  END IF;
END $$;

-- Security hardening phase 1: anon default-deny (20261030000000_security_hardening.sql).
DO $$
DECLARE
  offender text;
BEGIN
  -- No SECURITY DEFINER function in public may be executable by anon.
  SELECT p.proname INTO offender
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.prosecdef
    AND has_function_privilege('anon', p.oid, 'EXECUTE')
  LIMIT 1;
  IF offender IS NOT NULL THEN
    RAISE EXCEPTION 'anon can EXECUTE SECURITY DEFINER function public.%', offender;
  END IF;

  -- anon holds no privilege on any public table or view.
  SELECT c.relname INTO offender
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relkind IN ('r', 'v', 'm', 'p')
    AND (
      has_table_privilege('anon', c.oid, 'SELECT')
      OR has_table_privilege('anon', c.oid, 'INSERT')
      OR has_table_privilege('anon', c.oid, 'UPDATE')
      OR has_table_privilege('anon', c.oid, 'DELETE')
    )
  LIMIT 1;
  IF offender IS NOT NULL THEN
    RAISE EXCEPTION 'anon holds a table privilege on public.%', offender;
  END IF;

  -- Size caps on client-written JSON exist.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'usage_events_props_size_check')
     OR NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'error_events_details_size_check') THEN
    RAISE EXCEPTION 'missing payload size check on usage_events / error_events';
  END IF;
END $$;

-- Retention: when pg_cron is installed, the rate_limit_counters purge must be
-- scheduled. The migration only WARNs if scheduling fails, so this is the gate.
DO $$
DECLARE
  scheduled boolean;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    -- Dynamic: the cron schema does not exist when pg_cron is absent.
    EXECUTE $q$SELECT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'purge-rate-limit-counters')$q$
      INTO scheduled;
    IF NOT scheduled THEN
      RAISE EXCEPTION 'pg_cron is installed but purge-rate-limit-counters is not scheduled';
    END IF;

    EXECUTE $q$SELECT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'purge-expired-records')$q$
      INTO scheduled;
    IF NOT scheduled THEN
      RAISE EXCEPTION 'pg_cron is installed but purge-expired-records is not scheduled';
    END IF;
  END IF;
END $$;

-- Phase 4: logs are written only through create_log_with_rate_limit.
DO $$
BEGIN
  IF has_table_privilege('authenticated', 'public.cigarette_logs', 'INSERT') THEN
    RAISE EXCEPTION 'authenticated can INSERT into cigarette_logs directly (bypasses the rate-limited RPC)';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'cigarette_logs' AND cmd IN ('INSERT', 'ALL')
  ) THEN
    RAISE EXCEPTION 'cigarette_logs still has an INSERT or ALL policy';
  END IF;
  -- The RPC's hourly cap counts created_at; rewriting it (or the row identity)
  -- would reopen the bypass.
  IF has_column_privilege('authenticated', 'public.cigarette_logs', 'created_at', 'UPDATE')
     OR has_column_privilege('authenticated', 'public.cigarette_logs', 'id', 'UPDATE')
     OR has_column_privilege('authenticated', 'public.cigarette_logs', 'user_id', 'UPDATE')
     OR has_column_privilege('authenticated', 'public.cigarette_logs', 'client_op_id', 'UPDATE') THEN
    RAISE EXCEPTION 'authenticated can UPDATE cigarette_logs created_at / id / user_id / client_op_id';
  END IF;
  IF NOT has_column_privilege('authenticated', 'public.cigarette_logs', 'notes', 'UPDATE')
     OR NOT has_column_privilege('authenticated', 'public.cigarette_logs', 'ts_utc', 'UPDATE') THEN
    RAISE EXCEPTION 'authenticated lost UPDATE on editable cigarette_logs columns';
  END IF;

  -- Goal targets are bounded per unit: spend caps to 100000, everything else to 1000.
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'goals_target_value_check'
      AND pg_get_constraintdef(oid) LIKE '%spend_cap_daily%'
      AND pg_get_constraintdef(oid) LIKE '%100000%'
  ) THEN
    RAISE EXCEPTION 'goals_target_value_check must bound spend_cap_daily at 100000 (goal target by unit)';
  END IF;
END $$;

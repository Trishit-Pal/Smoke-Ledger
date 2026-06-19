-- Closes the gap found in the 2026-06 sovereignty audit:
-- error_events_compliance_delete_null_user_check was declared in
-- 20260520000000_security_correctness.sql but was absent from the live DB
-- (migrations-can-lie scenario: the constraint block was edited after the
-- migration had already been applied).
--
-- Layer-3 tamper-resistance: compliance.delete rows inserted by the service
-- role (via Edge Functions) must have user_id IS NULL so they are invisible
-- to authenticated RLS and cannot be deleted, updated, or selectively read
-- by the subject user.
--
-- Safe to re-run: IF NOT EXISTS makes this a no-op if the constraint already
-- exists (e.g. on a fresh CI project that runs all migrations in order).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'error_events_compliance_delete_null_user_check'
  ) THEN
    ALTER TABLE public.error_events
      ADD CONSTRAINT error_events_compliance_delete_null_user_check
        CHECK (category <> 'compliance.delete' OR user_id IS NULL);
  END IF;
END$$;

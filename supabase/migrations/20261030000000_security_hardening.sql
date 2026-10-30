-- Security hardening, phase 1 (docs/superpowers/specs/2026-10-30-security-hardening-design.md).
--
-- 1. anon holds no grant on any public object, now or by default. RLS already
--    denies anon, but Supabase grants anon table/function privileges by default,
--    so a missed policy or a new SECURITY DEFINER function would otherwise be
--    open. Default-deny makes that class of mistake fail closed.
-- 2. erase_account_data also clears the identity fields. The privacy page
--    promises "Erase data wipes product tables"; name, date of birth, gender,
--    mobile and place live on the profile row and survived erasure.
-- 3. usage_events.props_json gets a size cap (quota abuse). NOT VALID so
--    existing rows are not rewritten; new writes are checked. error_events already
--    has error_events_details_size_check (20260520000000_security_correctness.sql).
--
-- 4. auth_email_exists is dropped: it was a service-role email-existence oracle
--    behind the "No ledger for this email" login copy, removed in the same phase.

-- ---------------------------------------------------------------------------
-- 1. anon default-deny
-- ---------------------------------------------------------------------------

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM anon;

ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM anon;

-- anon also inherits EXECUTE through PUBLIC, which Postgres grants on every new
-- function. A schema-scoped revoke from anon cannot remove that built-in default,
-- so drop it globally for functions this role creates. Future migrations must
-- GRANT EXECUTE explicitly to authenticated / service_role where a caller needs it.
ALTER DEFAULT PRIVILEGES REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;

-- ---------------------------------------------------------------------------
-- 2. Erase clears identity; only the erase path may bypass immutability
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.enforce_profile_identity_rules ()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  -- erase_account_data sets this transaction-local flag; clients cannot, because
  -- set_config is not exposed through PostgREST.
  IF current_setting('app.erasing', true) = 'on' THEN
    RETURN NEW;
  END IF;

  -- Immutable identity: once a value is set (NOT NULL) it can never change.
  IF OLD.full_name IS NOT NULL AND NEW.full_name IS DISTINCT FROM OLD.full_name THEN
    RAISE EXCEPTION 'identity_immutable: full_name' USING ERRCODE = '42501';
  END IF;
  IF OLD.date_of_birth IS NOT NULL AND NEW.date_of_birth IS DISTINCT FROM OLD.date_of_birth THEN
    RAISE EXCEPTION 'identity_immutable: date_of_birth' USING ERRCODE = '42501';
  END IF;
  IF OLD.gender IS NOT NULL AND NEW.gender IS DISTINCT FROM OLD.gender THEN
    RAISE EXCEPTION 'identity_immutable: gender' USING ERRCODE = '42501';
  END IF;

  -- First-set 18+ recheck (covers the legacy/admin "complete your profile" path).
  IF OLD.date_of_birth IS NULL AND NEW.date_of_birth IS NOT NULL THEN
    IF NEW.date_of_birth > (current_date - interval '18 years') THEN
      RAISE EXCEPTION 'underage' USING ERRCODE = '23514';
    END IF;
  END IF;

  -- Mobile number: change at most once per 30 days. The timestamp is server-owned
  -- so a client cannot forge an old mobile_changed_at to bypass the window.
  IF NEW.mobile_e164 IS DISTINCT FROM OLD.mobile_e164 THEN
    IF OLD.mobile_changed_at IS NOT NULL
       AND OLD.mobile_changed_at > now() - interval '30 days' THEN
      RAISE EXCEPTION 'mobile_rate_limited' USING ERRCODE = '54000';
    END IF;
    NEW.mobile_changed_at := now();
  ELSE
    NEW.mobile_changed_at := OLD.mobile_changed_at;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.erase_account_data()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  uid    uuid := auth.uid();
  pepper text := COALESCE(
    NULLIF(current_setting('app.audit_pepper', true), ''),
    (SELECT ds.decrypted_secret FROM vault.decrypted_secrets ds WHERE ds.name = 'audit_pepper' LIMIT 1),
    '');
  user_hash text;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501';
  END IF;

  IF pepper = '' THEN
    RAISE EXCEPTION 'audit pepper is not configured (app.audit_pepper GUC or Vault secret ''audit_pepper'') — erase aborted to prevent reversible audit hash'
      USING ERRCODE = 'P0001';
  END IF;

  -- Same "<id>:<pepper>" form as the edge functions (docs/runbooks/audit-pepper-rotation.md),
  -- so compliance rows from erase and delete-account can be correlated.
  -- One-time break: rows anonymized before this migration used "<id><pepper>" (no colon)
  -- and cannot be backfilled (their user link is already gone). To correlate one,
  -- hash the candidate id both ways.
  user_hash := encode(extensions.digest(uid::text || ':' || pepper, 'sha256'), 'hex');

  UPDATE public.audit_events
  SET
    props_json = jsonb_build_object('hashed_user_id', user_hash),
    user_id = NULL
  WHERE user_id = uid;

  UPDATE public.error_events
  SET
    details_json = jsonb_strip_nulls(
      COALESCE(details_json, '{}'::jsonb) || jsonb_build_object('hashed_user_id', user_hash)
    ),
    user_id = NULL
  WHERE user_id = uid;

  DELETE FROM public.cigarette_logs    WHERE user_id = uid;
  DELETE FROM public.user_facts_seen   WHERE user_id = uid;
  DELETE FROM public.usage_events      WHERE user_id = uid;
  DELETE FROM public.price_entries     WHERE user_id = uid;
  DELETE FROM public.goals             WHERE user_id = uid;
  DELETE FROM public.reminders         WHERE user_id = uid;
  DELETE FROM public.settings_kv       WHERE user_id = uid;
  DELETE FROM public.brand_variants    WHERE user_id = uid;
  DELETE FROM public.brands            WHERE user_id = uid;

  -- Lets the profile UPDATE below clear the otherwise-immutable identity fields.
  PERFORM set_config('app.erasing', 'on', true);

  UPDATE public.user_profiles
  SET baseline_per_day            = NULL,
      baseline_window_days        = 30,
      discreet_mode               = false,
      app_lock_enabled            = false,
      hide_totals_on_home         = false,
      onboarded_at                = NULL,
      age_confirmed_at            = NULL,
      terms_version               = NULL,
      privacy_version             = NULL,
      health_disclaimer_version   = NULL,
      data_processing_consent_at  = NULL,
      marketing_consent_at        = NULL,
      onboarding_step             = NULL,
      full_name                   = NULL,
      date_of_birth               = NULL,
      gender                      = NULL,
      mobile_e164                 = NULL,
      place                       = NULL,
      deleted_at                  = now()
  WHERE id = uid;

  PERFORM set_config('app.erasing', 'off', true);

  PERFORM smoke_seed.apply_default_brands(uid);

  -- Erase clears the otherwise-immutable identity, so the user can re-enter a
  -- different name / DOB / gender. This row (still linked to uid) is the record
  -- that a prior identity existed.
  INSERT INTO public.audit_events (user_id, event_type, event_category, props_json)
  VALUES (uid, 'account_data_erased', 'compliance',
          jsonb_build_object('hashed_user_id', user_hash, 'prior_identity_erased', true));
END;
$function$;

-- ---------------------------------------------------------------------------
-- 3. Payload size cap on client-written analytics JSON
-- ---------------------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'usage_events_props_size_check') THEN
    ALTER TABLE public.usage_events
      ADD CONSTRAINT usage_events_props_size_check
      CHECK (octet_length(props_json::text) <= 4096) NOT VALID;
  END IF;
END$$;

-- ---------------------------------------------------------------------------
-- 4. Remove the email-existence oracle
-- ---------------------------------------------------------------------------

DROP FUNCTION IF EXISTS public.auth_email_exists(text);

-- ---------------------------------------------------------------------------
-- 5. Bound retention of rate_limit_counters
-- ---------------------------------------------------------------------------
-- Rows hold a keyed hash of an email / phone / IP and are never read again after
-- their window (longest in use: 1 hour). Nothing purged them, so identities
-- accumulated forever. They carry no user id, so account deletion cannot target
-- them; a short retention is the control.

CREATE OR REPLACE FUNCTION public.purge_rate_limit_counters()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  purged integer;
BEGIN
  DELETE FROM public.rate_limit_counters
  WHERE window_start < now() - interval '2 days';
  GET DIAGNOSTICS purged = ROW_COUNT;
  RETURN purged;
END;
$$;

REVOKE ALL ON FUNCTION public.purge_rate_limit_counters() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purge_rate_limit_counters() TO service_role;

-- Rows written before keys were hashed hold raw emails and IPs. Drop them all
-- once: every bucket simply restarts, and its key format changes anyway.
DELETE FROM public.rate_limit_counters;

-- Enable pg_cron so the purge is really scheduled (production had none, so a
-- conditional schedule alone never ran). Guarded: an environment without the
-- extension must not fail the whole migration.
DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'pg_cron unavailable (%); rate_limit_counters purge is NOT scheduled', SQLERRM;
END$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule(
      'purge-rate-limit-counters',
      '17 3 * * *',
      'SELECT public.purge_rate_limit_counters()'
    );
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'cron.schedule failed (%); rate_limit_counters purge is NOT scheduled', SQLERRM;
END$$;

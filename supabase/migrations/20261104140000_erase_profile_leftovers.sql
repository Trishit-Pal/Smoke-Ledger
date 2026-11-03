-- Privacy & terms V3, final review M4: erase leaves no personal profile leftovers.
--
-- erase_account_data() is copied forward from 20261104130000_health_consent.sql
-- (the newest definition; SECURITY DEFINER, search_path '' and the existing grants
-- unchanged, since CREATE OR REPLACE keeps them) and additionally clears:
--   * mobile_changed_at: the 30-day mobile-change lock outlived the cleared number,
--     so a reader who erased could not add a number for up to 30 days.
--   * deleted_at: stamps left by erases from before 20261104100000 (which stopped
--     setting it); the export showed them.
-- Both are written inside the app.erasing window, where the profile guard trigger
-- (which owns mobile_changed_at) returns early.
-- country and currency stay on purpose: regional settings the app needs to work
-- after an erase, not part of the ledger (the privacy policy says so).
-- Idempotent: CREATE OR REPLACE only.

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

  -- The user's own error text is deleted, not kept; the erasure proof is the audit row below.
  DELETE FROM public.error_events
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
      health_data_consent_at      = NULL,
      marketing_consent_at        = NULL,
      onboarding_step             = NULL,
      full_name                   = NULL,
      date_of_birth               = NULL,
      gender                      = NULL,
      mobile_e164                 = NULL,
      place                       = NULL,
      mobile_changed_at           = NULL,
      deleted_at                  = NULL
  WHERE id = uid;

  PERFORM set_config('app.erasing', 'off', true);

  -- Signup copies name / DOB / gender into the sign-in record; clear them there too.
  UPDATE auth.users
  SET raw_user_meta_data = raw_user_meta_data - 'full_name' - 'date_of_birth' - 'gender'
  WHERE id = uid;

  PERFORM smoke_seed.apply_default_brands(uid);

  -- Erase clears the otherwise-immutable identity; corrected name / DOB / gender
  -- are recorded only by writing to us (owner-actions §9). This row (still linked to uid) is the record
  -- that a prior identity existed.
  INSERT INTO public.audit_events (user_id, event_type, event_category, props_json)
  VALUES (uid, 'account_data_erased', 'compliance',
          jsonb_build_object('hashed_user_id', user_hash, 'prior_identity_erased', true));
END;
$function$;

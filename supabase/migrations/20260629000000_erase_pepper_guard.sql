-- Guard erase_account_data against an unset app.audit_pepper GUC.
-- Without this, COALESCE returns '' and the audit hash is sha256(uid || '')
-- which is trivially reversible once you know the uid.

CREATE OR REPLACE FUNCTION public.erase_account_data ()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  uid    uuid := auth.uid();
  pepper text := COALESCE(current_setting('app.audit_pepper', true), '');
  user_hash text;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501';
  END IF;

  IF pepper = '' THEN
    RAISE EXCEPTION 'app.audit_pepper GUC is not configured — erase aborted to prevent reversible audit hash'
      USING ERRCODE = 'P0001';
  END IF;

  user_hash := encode(extensions.digest(uid::text || pepper, 'sha256'), 'hex');

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
      deleted_at                  = now()
  WHERE id = uid;

  PERFORM smoke_seed.apply_default_brands(uid);

  INSERT INTO public.audit_events (user_id, event_type, event_category, props_json)
  VALUES (uid, 'account_data_erased', 'compliance',
          jsonb_build_object('hashed_user_id', user_hash));
END;
$$;

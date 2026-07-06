-- erase_account_data: read the audit pepper from Vault when the GUC is unset.
--
-- ALTER DATABASE ... SET is permission-denied (42501) on this project, so the
-- documented `app.audit_pepper` GUC cannot be set by the operator at all —
-- which left the fail-closed guard (20260629000000_erase_pepper_guard.sql)
-- permanently raising P0001 and the DPDP erase right unavailable.
--
-- Fix: resolve the pepper as COALESCE(GUC, Vault secret named 'audit_pepper').
-- The GUC keeps precedence for environments where it IS settable (local/CI);
-- production stores the secret via `select vault.create_secret('<value>',
-- 'audit_pepper')` — same value as the edge functions' AUDIT_PEPPER secret.
-- The guard still raises P0001 when neither source yields a value, so erasure
-- remains fail-closed against a reversible (unpeppered) hash.
--
-- vault.decrypted_secrets is readable by the function owner (postgres), never
-- by clients; search_path stays pinned to '' with every object qualified.

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
$function$;

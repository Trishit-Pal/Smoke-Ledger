-- Smoke Ledger hardening migration:
-- - compliance columns on user_profiles
-- - audit/error event tables
-- - stricter DB check constraints aligned with validation
-- - server-side RPCs for erase/export account data

-- ---------------------------------------------------------------------------
-- 1) Compliance columns
-- ---------------------------------------------------------------------------

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS age_confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS terms_version text,
  ADD COLUMN IF NOT EXISTS privacy_version text,
  ADD COLUMN IF NOT EXISTS health_disclaimer_version text,
  ADD COLUMN IF NOT EXISTS data_processing_consent_at timestamptz,
  ADD COLUMN IF NOT EXISTS marketing_consent_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- ---------------------------------------------------------------------------
-- 2) Audit and error event tables
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.audit_events (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  event_type text NOT NULL,
  event_category text NOT NULL DEFAULT 'account',
  props_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_events_user_created
  ON public.audit_events (user_id, created_at DESC);

ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS audit_events_select ON public.audit_events;
CREATE POLICY audit_events_select ON public.audit_events FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS audit_events_insert ON public.audit_events;
CREATE POLICY audit_events_insert ON public.audit_events FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.error_events (
  id bigserial PRIMARY KEY,
  user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  request_id text,
  route text,
  category text NOT NULL,
  message text NOT NULL,
  details_json jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_error_events_user_created
  ON public.error_events (user_id, created_at DESC);

ALTER TABLE public.error_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS error_events_select ON public.error_events;
CREATE POLICY error_events_select ON public.error_events FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS error_events_insert ON public.error_events;
CREATE POLICY error_events_insert ON public.error_events FOR INSERT TO authenticated
  WITH CHECK (user_id IS NULL OR user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 3) DB checks aligned with src/lib/validation.ts
-- ---------------------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'brands_category_check') THEN
    ALTER TABLE public.brands
      ADD CONSTRAINT brands_category_check
      CHECK (category IN ('budget', 'regular', 'premium', 'imported', 'other'));
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'brand_variants_default_pack_size_check') THEN
    ALTER TABLE public.brand_variants
      ADD CONSTRAINT brand_variants_default_pack_size_check
      CHECK (default_pack_size BETWEEN 1 AND 100);
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'brand_variants_avg_price_check') THEN
    ALTER TABLE public.brand_variants
      ADD CONSTRAINT brand_variants_avg_price_check
      CHECK (avg_price_inr IS NULL OR (avg_price_inr >= 0 AND avg_price_inr <= 2000));
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'brand_variants_last_price_check') THEN
    ALTER TABLE public.brand_variants
      ADD CONSTRAINT brand_variants_last_price_check
      CHECK (last_price_inr IS NULL OR (last_price_inr >= 0 AND last_price_inr <= 2000));
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cigarette_logs_quantity_check') THEN
    ALTER TABLE public.cigarette_logs
      ADD CONSTRAINT cigarette_logs_quantity_check
      CHECK (quantity BETWEEN 1 AND 100);
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cigarette_logs_local_hour_check') THEN
    ALTER TABLE public.cigarette_logs
      ADD CONSTRAINT cigarette_logs_local_hour_check
      CHECK (local_hour BETWEEN 0 AND 23);
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cigarette_logs_purchase_mode_check') THEN
    ALTER TABLE public.cigarette_logs
      ADD CONSTRAINT cigarette_logs_purchase_mode_check
      CHECK (purchase_mode IN ('single', 'pack', 'carton', 'custom'));
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cigarette_logs_price_source_check') THEN
    ALTER TABLE public.cigarette_logs
      ADD CONSTRAINT cigarette_logs_price_source_check
      CHECK (price_source IN ('exact', 'estimated', 'inferred', 'unknown'));
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cigarette_logs_pack_size_check') THEN
    ALTER TABLE public.cigarette_logs
      ADD CONSTRAINT cigarette_logs_pack_size_check
      CHECK (pack_size IS NULL OR (pack_size BETWEEN 1 AND 100));
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cigarette_logs_total_price_check') THEN
    ALTER TABLE public.cigarette_logs
      ADD CONSTRAINT cigarette_logs_total_price_check
      CHECK (total_price_inr IS NULL OR (total_price_inr >= 0 AND total_price_inr <= 10000));
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cigarette_logs_unit_price_check') THEN
    ALTER TABLE public.cigarette_logs
      ADD CONSTRAINT cigarette_logs_unit_price_check
      CHECK (unit_price_inr IS NULL OR (unit_price_inr >= 0 AND unit_price_inr <= 2000));
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cigarette_logs_craving_check') THEN
    ALTER TABLE public.cigarette_logs
      ADD CONSTRAINT cigarette_logs_craving_check
      CHECK (craving IS NULL OR (craving BETWEEN 0 AND 10));
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'goals_type_check') THEN
    ALTER TABLE public.goals
      ADD CONSTRAINT goals_type_check
      CHECK (type IN ('daily_cap', 'spend_cap_daily', 'no_smoke_window', 'reduction_target', 'weekly_target', 'quit_date'));
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'goals_status_check') THEN
    ALTER TABLE public.goals
      ADD CONSTRAINT goals_status_check
      CHECK (status IN ('active', 'paused', 'completed', 'abandoned'));
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'goals_target_value_check') THEN
    ALTER TABLE public.goals
      ADD CONSTRAINT goals_target_value_check
      CHECK (target_value > 0 AND target_value <= 1000);
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_profiles_baseline_per_day_check') THEN
    ALTER TABLE public.user_profiles
      ADD CONSTRAINT user_profiles_baseline_per_day_check
      CHECK (baseline_per_day IS NULL OR (baseline_per_day >= 0 AND baseline_per_day <= 200));
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_profiles_baseline_window_days_check') THEN
    ALTER TABLE public.user_profiles
      ADD CONSTRAINT user_profiles_baseline_window_days_check
      CHECK (baseline_window_days BETWEEN 1 AND 365);
  END IF;
END$$;

-- ---------------------------------------------------------------------------
-- 4) Server-side sensitive operations
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.record_audit_event (
  p_event_type text,
  p_event_category text DEFAULT 'account',
  p_props jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  INSERT INTO public.audit_events (user_id, event_type, event_category, props_json)
  VALUES (uid, left(coalesce(p_event_type, 'unknown'), 80), left(coalesce(p_event_category, 'account'), 40), coalesce(p_props, '{}'::jsonb));
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_audit_event(text, text, jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.erase_account_data ()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, smoke_seed
AS $$
DECLARE
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  DELETE FROM public.cigarette_logs WHERE user_id = uid;
  DELETE FROM public.user_facts_seen WHERE user_id = uid;
  DELETE FROM public.usage_events WHERE user_id = uid;
  DELETE FROM public.price_entries WHERE user_id = uid;
  DELETE FROM public.goals WHERE user_id = uid;
  DELETE FROM public.reminders WHERE user_id = uid;
  DELETE FROM public.settings_kv WHERE user_id = uid;
  DELETE FROM public.brands WHERE user_id = uid;

  UPDATE public.user_profiles
  SET baseline_per_day = NULL,
      baseline_window_days = 30,
      discreet_mode = false,
      app_lock_enabled = false,
      hide_totals_on_home = false,
      onboarded_at = NULL,
      age_confirmed_at = NULL,
      terms_version = NULL,
      privacy_version = NULL,
      health_disclaimer_version = NULL,
      data_processing_consent_at = NULL,
      marketing_consent_at = NULL,
      deleted_at = NULL
  WHERE id = uid;

  PERFORM smoke_seed.apply_default_brands(uid);

  INSERT INTO public.audit_events (user_id, event_type, event_category, props_json)
  VALUES (uid, 'account_data_erased', 'account', '{}'::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION public.erase_account_data() TO authenticated;

CREATE OR REPLACE FUNCTION public.export_account_data ()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  payload jsonb;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  SELECT jsonb_build_object(
    'version', 1,
    'exportedAt', now(),
    'profile', (
      SELECT to_jsonb(p) - 'id'
      FROM public.user_profiles p
      WHERE p.id = uid
    ),
    'brands', (
      SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
          'id', b.id,
          'name', b.name,
          'category', b.category,
          'isSeed', b.is_seed,
          'isFavorite', b.is_favorite,
          'createdAt', b.created_at,
          'updatedAt', b.updated_at,
          'variants', (
            SELECT COALESCE(jsonb_agg(
              jsonb_build_object(
                'id', v.id,
                'brandId', v.brand_id,
                'name', v.name,
                'defaultPackSize', v.default_pack_size,
                'avgPriceInr', v.avg_price_inr,
                'lastPriceInr', v.last_price_inr,
                'lastPricedAt', v.last_priced_at
              )
            ORDER BY v.name), '[]'::jsonb)
            FROM public.brand_variants v
            WHERE v.user_id = uid AND v.brand_id = b.id
          )
        )
      ORDER BY b.created_at DESC), '[]'::jsonb)
      FROM public.brands b
      WHERE b.user_id = uid
    ),
    'logs', (
      SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
          'id', l.id,
          'tsUtc', l.ts_utc,
          'localDate', l.local_date,
          'localHour', l.local_hour,
          'brandId', l.brand_id,
          'brandNameSnap', l.brand_name_snap,
          'variantSnap', l.variant_snap,
          'quantity', l.quantity,
          'purchaseMode', l.purchase_mode,
          'packSize', l.pack_size,
          'totalPriceInr', l.total_price_inr,
          'unitPriceInr', l.unit_price_inr,
          'priceSource', l.price_source,
          'triggerTag', l.trigger_tag,
          'moodBefore', l.mood_before,
          'moodAfter', l.mood_after,
          'craving', l.craving,
          'contextTag', l.context_tag,
          'notes', l.notes,
          'createdAt', l.created_at,
          'updatedAt', l.updated_at
        )
      ORDER BY l.ts_utc DESC), '[]'::jsonb)
      FROM public.cigarette_logs l
      WHERE l.user_id = uid
    ),
    'goals', (
      SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
          'id', g.id,
          'type', g.type,
          'targetValue', g.target_value,
          'currentBaseline', g.current_baseline,
          'startDate', g.start_date,
          'endDate', g.end_date,
          'status', g.status,
          'meta', g.meta_json,
          'createdAt', g.created_at
        )
      ORDER BY g.created_at DESC), '[]'::jsonb)
      FROM public.goals g
      WHERE g.user_id = uid
    ),
    'settings', (
      SELECT COALESCE(
        jsonb_object_agg(s.key, s.value_json),
        '{}'::jsonb
      )
      FROM public.settings_kv s
      WHERE s.user_id = uid
    )
  ) INTO payload;

  INSERT INTO public.audit_events (user_id, event_type, event_category, props_json)
  VALUES (uid, 'account_data_exported', 'account', jsonb_build_object('format', 'json'));

  RETURN payload;
END;
$$;

GRANT EXECUTE ON FUNCTION public.export_account_data() TO authenticated;

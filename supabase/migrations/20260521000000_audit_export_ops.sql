-- Audit export ops: keyset export pagination, audit RPC lockdown, erase anonymization.
-- Apply AFTER 20260520000000_security_correctness.sql.

-- ---------------------------------------------------------------------------
-- 1. audit_events.user_id nullable for anonymized retention after erase
-- ---------------------------------------------------------------------------

ALTER TABLE public.audit_events
  ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE public.audit_events
  DROP CONSTRAINT IF EXISTS audit_events_user_id_fkey;

ALTER TABLE public.audit_events
  ADD CONSTRAINT audit_events_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users (id) ON DELETE SET NULL;

-- Rows with user_id IS NULL are anonymized; users cannot read them via RLS.
DROP POLICY IF EXISTS audit_events_select ON public.audit_events;
CREATE POLICY audit_events_select ON public.audit_events FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 2. Replace export_account_data with keyset pagination
-- ---------------------------------------------------------------------------

DROP FUNCTION IF EXISTS public.export_account_data(timestamptz, timestamptz, bigint, int);

CREATE OR REPLACE FUNCTION public.export_account_data (
  p_from timestamptz DEFAULT NULL,
  p_to   timestamptz DEFAULT NULL,
  p_cursor_ts timestamptz DEFAULT NULL,
  p_cursor_id text DEFAULT NULL,
  p_limit int DEFAULT 5000
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  uid uuid := auth.uid();
  effective_limit int := GREATEST(100, LEAST(p_limit, 5000));
  log_rows jsonb;
  row_count int;
  last_ts timestamptz;
  last_id text;
  has_more boolean := false;
  is_first_page boolean := (p_cursor_ts IS NULL AND (p_cursor_id IS NULL OR p_cursor_id = ''));
  payload jsonb;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501';
  END IF;

  WITH page AS (
    SELECT l.*
    FROM public.cigarette_logs l
    WHERE l.user_id = uid
      AND (p_from IS NULL OR l.ts_utc >= p_from)
      AND (p_to   IS NULL OR l.ts_utc <  p_to)
      AND (
        p_cursor_ts IS NULL
        OR (l.ts_utc, l.id) < (p_cursor_ts, p_cursor_id)
      )
    ORDER BY l.ts_utc DESC, l.id DESC
    LIMIT effective_limit + 1
  ), shaped AS (
    SELECT * FROM page LIMIT effective_limit
  )
  SELECT
    COALESCE(jsonb_agg(
      jsonb_build_object(
        'id', s.id,
        'tsUtc', s.ts_utc,
        'localDate', s.local_date,
        'localHour', s.local_hour,
        'brandId', s.brand_id,
        'brandNameSnap', s.brand_name_snap,
        'variantSnap', s.variant_snap,
        'quantity', s.quantity,
        'purchaseMode', s.purchase_mode,
        'packSize', s.pack_size,
        'totalPriceInr', s.total_price_inr,
        'unitPriceInr', s.unit_price_inr,
        'priceSource', s.price_source,
        'triggerTag', s.trigger_tag,
        'moodBefore', s.mood_before,
        'moodAfter', s.mood_after,
        'craving', s.craving,
        'contextTag', s.context_tag,
        'notes', s.notes,
        'createdAt', s.created_at,
        'updatedAt', s.updated_at,
        'clientOpId', s.client_op_id
      )
      ORDER BY s.ts_utc DESC, s.id DESC
    ), '[]'::jsonb),
    count(*)::int
  INTO log_rows, row_count
  FROM shaped s;

  IF row_count = effective_limit THEN
    SELECT s.ts_utc, s.id INTO last_ts, last_id
    FROM (
      SELECT l.ts_utc, l.id
      FROM public.cigarette_logs l
      WHERE l.user_id = uid
        AND (p_from IS NULL OR l.ts_utc >= p_from)
        AND (p_to   IS NULL OR l.ts_utc <  p_to)
        AND (
          p_cursor_ts IS NULL
          OR (l.ts_utc, l.id) < (p_cursor_ts, p_cursor_id)
        )
      ORDER BY l.ts_utc DESC, l.id DESC
      LIMIT effective_limit
    ) s
    ORDER BY s.ts_utc ASC, s.id ASC
    LIMIT 1;
    has_more := EXISTS (
      SELECT 1
      FROM public.cigarette_logs l
      WHERE l.user_id = uid
        AND (p_from IS NULL OR l.ts_utc >= p_from)
        AND (p_to   IS NULL OR l.ts_utc <  p_to)
        AND (l.ts_utc, l.id) < (last_ts, last_id)
      LIMIT 1
    );
  END IF;

  IF is_first_page THEN
    SELECT jsonb_build_object(
      'version', 2,
      'exportedAt', now(),
      'cursorTs', p_cursor_ts,
      'cursorId', p_cursor_id,
      'nextCursorTs', CASE WHEN has_more THEN last_ts ELSE NULL END,
      'nextCursorId', CASE WHEN has_more THEN last_id ELSE NULL END,
      'hasMore', has_more,
      'limit', effective_limit,
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
                  'lastPricedAt', v.last_priced_at,
                  'priceSumInr', v.price_sum_inr,
                  'priceCount', v.price_count
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
      'logs', log_rows,
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
        SELECT COALESCE(jsonb_object_agg(s.key, s.value_json), '{}'::jsonb)
        FROM public.settings_kv s
        WHERE s.user_id = uid
      ),
      'reminders', (
        SELECT COALESCE(jsonb_agg(
          jsonb_build_object(
            'id', r.id,
            'kind', r.kind,
            'timeLocal', r.time_local,
            'enabled', r.enabled,
            'quietStart', r.quiet_start,
            'quietEnd', r.quiet_end
          )
        ORDER BY r.kind), '[]'::jsonb)
        FROM public.reminders r
        WHERE r.user_id = uid
      ),
      'priceEntries', (
        SELECT COALESCE(jsonb_agg(
          jsonb_build_object(
            'id', pe.id,
            'brandId', pe.brand_id,
            'variantId', pe.variant_id,
            'unitPriceInr', pe.unit_price_inr,
            'packSize', pe.pack_size,
            'source', pe.source,
            'observedAt', pe.observed_at
          )
        ORDER BY pe.observed_at DESC), '[]'::jsonb)
        FROM public.price_entries pe
        WHERE pe.user_id = uid
      ),
      'usageEvents', (
        SELECT COALESCE(jsonb_agg(
          jsonb_build_object(
            'id', ue.id,
            'name', ue.name,
            'propsJson', ue.props_json,
            'ts', ue.ts
          )
        ORDER BY ue.ts DESC), '[]'::jsonb)
        FROM public.usage_events ue
        WHERE ue.user_id = uid
      ),
      'auditEvents', (
        SELECT COALESCE(jsonb_agg(
          jsonb_build_object(
            'id', ae.id,
            'eventType', ae.event_type,
            'eventCategory', ae.event_category,
            'propsJson', ae.props_json,
            'createdAt', ae.created_at
          )
        ORDER BY ae.created_at DESC), '[]'::jsonb)
        FROM public.audit_events ae
        WHERE ae.user_id = uid
      ),
      'factsSeen', (
        SELECT COALESCE(jsonb_agg(
          jsonb_build_object(
            'factId', ufs.fact_id,
            'seenAt', ufs.seen_at,
            'liked', ufs.liked
          )
        ORDER BY ufs.seen_at DESC), '[]'::jsonb)
        FROM public.user_facts_seen ufs
        WHERE ufs.user_id = uid
      )
    ) INTO payload;

    INSERT INTO public.audit_events (user_id, event_type, event_category, props_json)
    VALUES (uid, 'account_data_exported', 'account',
            jsonb_build_object('format', 'json', 'version', 2));
  ELSE
    payload := jsonb_build_object(
      'version', 2,
      'exportedAt', now(),
      'cursorTs', p_cursor_ts,
      'cursorId', p_cursor_id,
      'nextCursorTs', CASE WHEN has_more THEN last_ts ELSE NULL END,
      'nextCursorId', CASE WHEN has_more THEN last_id ELSE NULL END,
      'hasMore', has_more,
      'limit', effective_limit,
      'logs', log_rows
    );
  END IF;

  RETURN payload;
END;
$$;

GRANT EXECUTE ON FUNCTION public.export_account_data(timestamptz, timestamptz, timestamptz, text, int) TO authenticated;

-- ---------------------------------------------------------------------------
-- 3. Lock down record_audit_event — service_role / Edge Functions only
-- ---------------------------------------------------------------------------

REVOKE EXECUTE ON FUNCTION public.record_audit_event(text, text, jsonb) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.record_audit_event(text, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_audit_event(text, text, jsonb) TO service_role;

-- ---------------------------------------------------------------------------
-- 4. erase_account_data: anonymize audit rows (user_id NULL)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.erase_account_data ()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  uid uuid := auth.uid();
  pepper text := COALESCE(current_setting('app.audit_pepper', true), '');
  user_hash text;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501';
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

  DELETE FROM public.cigarette_logs WHERE user_id = uid;
  DELETE FROM public.user_facts_seen WHERE user_id = uid;
  DELETE FROM public.usage_events WHERE user_id = uid;
  DELETE FROM public.price_entries WHERE user_id = uid;
  DELETE FROM public.goals WHERE user_id = uid;
  DELETE FROM public.reminders WHERE user_id = uid;
  DELETE FROM public.settings_kv WHERE user_id = uid;
  DELETE FROM public.brand_variants WHERE user_id = uid;
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
      onboarding_step = NULL,
      deleted_at = now()
  WHERE id = uid;

  PERFORM smoke_seed.apply_default_brands(uid);

  INSERT INTO public.audit_events (user_id, event_type, event_category, props_json)
  VALUES (uid, 'account_data_erased', 'compliance',
          jsonb_build_object('hashed_user_id', user_hash));
END;
$$;

GRANT EXECUTE ON FUNCTION public.erase_account_data() TO authenticated;

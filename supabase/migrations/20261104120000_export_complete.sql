-- Privacy & terms V3, task 4: the export is complete.
--
-- export_account_data() (copied forward from 20261103000000_adaptive_goals.sql, the
-- newest definition; signature, SECURITY DEFINER, search_path and pagination are
-- unchanged, so existing grants are preserved) now also returns, for the caller only:
--   * account: email, phone, createdAt, lastSignInAt from auth.users (the sign-in
--     record). raw_user_meta_data is not added: name / DOB / gender are already
--     exported from user_profiles.
--   * errorEvents: the caller's own error_events (category, message, route, createdAt).
--     Messages are redacted at write time; erase deletes these rows.
-- auditEvents (own rows) were already exported and are left as is.
-- The export version is 3 (the import schema accepts 2 and 3).

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
      'version', 3,
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
            'createdAt', g.created_at,
            'completedAt', g.completed_at
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
      'account', (
        SELECT jsonb_build_object(
          'email', u.email,
          'phone', u.phone,
          'createdAt', u.created_at,
          'lastSignInAt', u.last_sign_in_at
        )
        FROM auth.users u
        WHERE u.id = uid
      ),
      'errorEvents', (
        SELECT COALESCE(jsonb_agg(
          jsonb_build_object(
            'category', ee.category,
            'message', ee.message,
            'route', ee.route,
            'createdAt', ee.created_at
          )
        ORDER BY ee.created_at DESC), '[]'::jsonb)
        FROM public.error_events ee
        WHERE ee.user_id = uid
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
            jsonb_build_object('format', 'json', 'version', 3));
  ELSE
    payload := jsonb_build_object(
      'version', 3,
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

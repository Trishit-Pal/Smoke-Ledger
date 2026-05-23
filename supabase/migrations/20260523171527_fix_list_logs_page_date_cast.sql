-- Fix: cigarette_logs.local_date is TEXT ('YYYY-MM-DD'), but list_logs_page
-- compared it directly to the date params p_from_date/p_to_date, yielding
-- "operator does not exist: text >= date" once the function started executing
-- (it crashed the dashboard/history/trends/log Server Component renders).
-- Cast the column to date in every range comparison, matching the established
-- pattern in get_daily_summary (20260520000000_security_correctness.sql).
-- CREATE OR REPLACE keeps the same signature; no DROP needed.

CREATE OR REPLACE FUNCTION public.list_logs_page (
  p_user_id    uuid,
  p_from_date  date        DEFAULT NULL,
  p_to_date    date        DEFAULT NULL,
  p_brand_id   text        DEFAULT NULL,
  p_trigger_tag text       DEFAULT NULL,
  p_cursor_ts  timestamptz DEFAULT NULL,
  p_cursor_id  text        DEFAULT NULL,
  p_limit      int         DEFAULT 200
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  uid              uuid := auth.uid();
  effective_limit  int  := GREATEST(1, LEAST(p_limit, 5000));
  log_rows         jsonb;
  row_count        int;
  last_ts          timestamptz;
  last_id          text;
  has_more         boolean := false;
BEGIN
  -- Callers must be authenticated and may only fetch their own data.
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501';
  END IF;
  IF uid <> p_user_id THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  WITH page AS (
    SELECT l.*
    FROM public.cigarette_logs l
    WHERE l.user_id = uid
      AND (p_from_date  IS NULL OR l.local_date::date >= p_from_date)
      AND (p_to_date    IS NULL OR l.local_date::date <= p_to_date)
      AND (p_brand_id   IS NULL OR l.brand_id    = p_brand_id)
      AND (p_trigger_tag IS NULL OR l.trigger_tag = p_trigger_tag)
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
        'id',            s.id,
        'tsUtc',         s.ts_utc,
        'localDate',     s.local_date,
        'localHour',     s.local_hour,
        'brandId',       s.brand_id,
        'brandNameSnap', s.brand_name_snap,
        'variantSnap',   s.variant_snap,
        'quantity',      s.quantity,
        'purchaseMode',  s.purchase_mode,
        'packSize',      s.pack_size,
        'totalPriceInr', s.total_price_inr,
        'unitPriceInr',  s.unit_price_inr,
        'priceSource',   s.price_source,
        'triggerTag',    s.trigger_tag,
        'moodBefore',    s.mood_before,
        'moodAfter',     s.mood_after,
        'craving',       s.craving,
        'contextTag',    s.context_tag,
        'notes',         s.notes,
        'createdAt',     s.created_at,
        'updatedAt',     s.updated_at
      )
      ORDER BY s.ts_utc DESC, s.id DESC
    ), '[]'::jsonb),
    count(*)::int
  INTO log_rows, row_count
  FROM shaped s;

  -- Determine the cursor for the next page (oldest row in this page).
  IF row_count = effective_limit THEN
    SELECT s.ts_utc, s.id INTO last_ts, last_id
    FROM (
      SELECT l.ts_utc, l.id
      FROM public.cigarette_logs l
      WHERE l.user_id = uid
        AND (p_from_date   IS NULL OR l.local_date::date >= p_from_date)
        AND (p_to_date     IS NULL OR l.local_date::date <= p_to_date)
        AND (p_brand_id    IS NULL OR l.brand_id    = p_brand_id)
        AND (p_trigger_tag IS NULL OR l.trigger_tag = p_trigger_tag)
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
        AND (p_from_date   IS NULL OR l.local_date::date >= p_from_date)
        AND (p_to_date     IS NULL OR l.local_date::date <= p_to_date)
        AND (p_brand_id    IS NULL OR l.brand_id    = p_brand_id)
        AND (p_trigger_tag IS NULL OR l.trigger_tag = p_trigger_tag)
        AND (l.ts_utc, l.id) < (last_ts, last_id)
      LIMIT 1
    );
  END IF;

  RETURN jsonb_build_object(
    'logs',          log_rows,
    'nextCursorTs',  CASE WHEN has_more THEN last_ts ELSE NULL END,
    'nextCursorId',  CASE WHEN has_more THEN last_id ELSE NULL END,
    'hasMore',       has_more
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.list_logs_page(uuid, date, date, text, text, timestamptz, text, int) TO authenticated;

NOTIFY pgrst, 'reload schema';

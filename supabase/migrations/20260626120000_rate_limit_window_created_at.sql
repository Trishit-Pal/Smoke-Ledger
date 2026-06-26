-- ---------------------------------------------------------------------------
-- Rate-limit window: count off created_at, not ts_utc
-- ---------------------------------------------------------------------------
--
-- The backdated-timestamp feature (src/lib/validation.ts MAX_BACKDATE_MS, up to
-- 24h in the past) made ts_utc user-controlled. create_log_with_rate_limit
-- counted its "50 inserts / rolling hour" window with `ts_utc > now() - 1h`,
-- so any log stamped >1h in the past no longer fell inside the window — a user
-- could backdate every insert and evade the cap entirely.
--
-- Fix: count the window off created_at, which the RPC itself sets to now() at
-- insert time (line: `..., now(), now(), p_client_op_id`) and which is not
-- user-controllable. This restores the intended "50 actual inserts per hour"
-- semantics regardless of how ts_utc is backdated. Own-account abuse only (RLS
-- scopes the table to the caller), but it protects free-tier write volume.
--
-- Behaviour is otherwise identical to 20260520000000_security_correctness.sql;
-- only the SELECT predicate at the rate-limit count changed. CREATE OR REPLACE
-- preserves the existing GRANT, which is re-asserted below for self-containment.
--
-- Apply order: AFTER 20260520000000_security_correctness.sql.

CREATE OR REPLACE FUNCTION public.create_log_with_rate_limit (
  p_id text,
  p_ts_utc timestamptz,
  p_local_date text,
  p_local_hour int,
  p_brand_id text,
  p_brand_name_snap text,
  p_variant_snap text,
  p_quantity int,
  p_purchase_mode text,
  p_pack_size int,
  p_total_price_inr numeric,
  p_unit_price_inr numeric,
  p_price_source text,
  p_trigger_tag text,
  p_mood_before text,
  p_mood_after text,
  p_craving int,
  p_context_tag text,
  p_notes text,
  p_client_op_id text DEFAULT NULL
)
RETURNS public.cigarette_logs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  uid uuid := auth.uid();
  recent_count int;
  existing public.cigarette_logs%ROWTYPE;
  result public.cigarette_logs%ROWTYPE;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501';
  END IF;

  -- Idempotency short-circuit: if the same client_op_id already exists for
  -- this user, return the prior row instead of creating a duplicate.
  IF p_client_op_id IS NOT NULL THEN
    SELECT * INTO existing
    FROM public.cigarette_logs
    WHERE user_id = uid AND client_op_id = p_client_op_id
    LIMIT 1;
    IF FOUND THEN
      RETURN existing;
    END IF;
  END IF;

  -- Count actual inserts in the last hour. Keyed off created_at (server-set at
  -- insert, below) rather than the user-backdatable ts_utc, so backdating a log
  -- can no longer move it out of the rate-limit window.
  SELECT count(*) INTO recent_count
  FROM public.cigarette_logs
  WHERE user_id = uid
    AND created_at > now() - interval '1 hour';

  IF recent_count >= 50 THEN
    RAISE EXCEPTION 'rate_limited' USING ERRCODE = '54000';
  END IF;

  INSERT INTO public.cigarette_logs (
    id, user_id, ts_utc, local_date, local_hour,
    brand_id, brand_name_snap, variant_snap,
    quantity, purchase_mode, pack_size,
    total_price_inr, unit_price_inr, price_source,
    trigger_tag, mood_before, mood_after, craving, context_tag, notes,
    created_at, updated_at, client_op_id
  ) VALUES (
    p_id, uid, p_ts_utc, p_local_date, p_local_hour,
    p_brand_id, p_brand_name_snap, p_variant_snap,
    p_quantity, p_purchase_mode, p_pack_size,
    p_total_price_inr, p_unit_price_inr, p_price_source,
    p_trigger_tag, p_mood_before, p_mood_after, p_craving, p_context_tag, p_notes,
    now(), now(), p_client_op_id
  )
  RETURNING * INTO result;

  -- Maintain running mean on the variant. Only when we have a brand_id and
  -- a positive unit price.
  IF p_brand_id IS NOT NULL AND p_unit_price_inr IS NOT NULL AND p_variant_snap IS NOT NULL THEN
    UPDATE public.brand_variants
    SET
      price_sum_inr = COALESCE(price_sum_inr, 0) + p_unit_price_inr,
      price_count = COALESCE(price_count, 0) + 1,
      avg_price_inr = CASE
        WHEN COALESCE(price_count, 0) + 1 > 0
        THEN ((COALESCE(price_sum_inr, 0) + p_unit_price_inr) / (COALESCE(price_count, 0) + 1))
        ELSE p_unit_price_inr
      END,
      last_price_inr = p_unit_price_inr,
      last_priced_at = now()
    WHERE user_id = uid
      AND brand_id = p_brand_id
      AND name = p_variant_snap;
  END IF;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_log_with_rate_limit(
  text, timestamptz, text, int,
  text, text, text,
  int, text, int,
  numeric, numeric, text,
  text, text, text, int, text, text,
  text
) TO authenticated;

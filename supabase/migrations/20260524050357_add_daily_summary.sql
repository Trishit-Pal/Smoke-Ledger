-- Forward migration: create v_daily_summary_user + get_daily_summary in
-- environments where 20260520000000_security_correctness was applied BEFORE
-- its Section 11 was appended to the file (prod drift). Both objects were
-- absent in prod, so the Trends page hit PGRST202 ("function ... not found in
-- schema cache"). Copied verbatim from 20260520000000:975-1028. Idempotent.

CREATE OR REPLACE VIEW public.v_daily_summary_user
  WITH (security_invoker = true) AS
SELECT
  user_id,
  local_date,
  COUNT(*)::int                                  AS sticks,
  COALESCE(SUM(total_price_inr), 0)::numeric    AS total_spend_inr,
  CASE
    WHEN COUNT(*) FILTER (WHERE unit_price_inr IS NOT NULL) > 0
    THEN AVG(unit_price_inr) FILTER (WHERE unit_price_inr IS NOT NULL)
    ELSE NULL
  END                                            AS avg_unit_price_inr
FROM public.cigarette_logs
GROUP BY user_id, local_date;

-- Grant SELECT so PostgREST exposes the view to authenticated sessions.
-- RLS on the underlying cigarette_logs table still applies (SECURITY INVOKER).
GRANT SELECT ON public.v_daily_summary_user TO authenticated;

CREATE OR REPLACE FUNCTION public.get_daily_summary (p_from date, p_to date)
RETURNS TABLE (local_date date, sticks int, total_spend_inr numeric, avg_unit_price_inr numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501';
  END IF;
  -- Bound the range to prevent unbounded scans. 366-day cap covers the full Year view.
  IF p_to < p_from THEN
    RAISE EXCEPTION 'p_to must be >= p_from' USING ERRCODE = '22023';
  END IF;
  IF (p_to - p_from) > 366 THEN
    RAISE EXCEPTION 'date range > 366 days' USING ERRCODE = '22023';
  END IF;
  -- Note: local_date is stored as text (YYYY-MM-DD). The cast to ::date lets us
  -- compare against the date params without relying on implicit text ordering.
  RETURN QUERY
    SELECT
      v.local_date::date,
      v.sticks,
      v.total_spend_inr,
      v.avg_unit_price_inr
    FROM public.v_daily_summary_user v
    WHERE v.user_id = uid
      AND v.local_date::date >= p_from
      AND v.local_date::date <= p_to
    ORDER BY v.local_date DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_daily_summary(date, date) TO authenticated;

NOTIFY pgrst, 'reload schema';

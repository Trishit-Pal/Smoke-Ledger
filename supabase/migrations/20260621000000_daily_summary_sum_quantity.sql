-- Fix: v_daily_summary_user counted log ROWS as sticks (COUNT(*)), but a single
-- cigarette_logs row can carry quantity > 1 (the log form has a Quantity field).
-- This undercounted sticks in everything fed by get_daily_summary (the Trends
-- "Year" view, and — after this change — the dashboard timeframe totals) versus
-- the client-side SUM(quantity) used for Day/Week/Month, so Year disagreed with
-- the shorter windows. Switch sticks to COALESCE(SUM(quantity), 0).
--
-- Byte-for-byte identical to 20260524050357_add_daily_summary.sql except the
-- sticks expression. Column names/types are unchanged, so CREATE OR REPLACE VIEW
-- is valid. get_daily_summary() reads this view and inherits the fix unchanged.
-- Idempotent.

CREATE OR REPLACE VIEW public.v_daily_summary_user
  WITH (security_invoker = true) AS
SELECT
  user_id,
  local_date,
  COALESCE(SUM(quantity), 0)::int                AS sticks,
  COALESCE(SUM(total_price_inr), 0)::numeric    AS total_spend_inr,
  CASE
    WHEN COUNT(*) FILTER (WHERE unit_price_inr IS NOT NULL) > 0
    THEN AVG(unit_price_inr) FILTER (WHERE unit_price_inr IS NOT NULL)
    ELSE NULL
  END                                            AS avg_unit_price_inr
FROM public.cigarette_logs
GROUP BY user_id, local_date;

-- Re-grant (harmless if already present); RLS on cigarette_logs still applies
-- via security_invoker.
GRANT SELECT ON public.v_daily_summary_user TO authenticated;

-- Serve the corrected view immediately.
NOTIFY pgrst, 'reload schema';

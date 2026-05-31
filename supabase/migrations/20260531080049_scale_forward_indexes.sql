-- Forward-looking composite indexes for cigarette_logs filtered pagination.
-- These won't be chosen by the planner until a user accumulates thousands of logs
-- (expect temporary unused_index advisor INFOs until then). See SCALING_PLAN.md §1d.
-- Applied to live project tvcwrsglceahkjnfuzkn on 2026-05-31 (version 20260531080049).

-- Backs list_logs_page's brand filter on top of the existing (user_id, ts_utc DESC) keyset index.
create index if not exists idx_logs_user_ts_brand
  on public.cigarette_logs (user_id, ts_utc desc, brand_id);

-- Backs list_logs_page's trigger_tag filter (trigger_tag has no index today).
create index if not exists idx_logs_user_ts_trigger
  on public.cigarette_logs (user_id, ts_utc desc, trigger_tag);

-- NOTE: an expression index on ((local_date)::date) was intentionally dropped — the
-- text::date cast is STABLE (DateStyle-dependent), not IMMUTABLE, so Postgres rejects it
-- in an index expression. The existing idx_logs_user_local_date (user_id, local_date DESC)
-- already covers the common date-window scans on the text column.

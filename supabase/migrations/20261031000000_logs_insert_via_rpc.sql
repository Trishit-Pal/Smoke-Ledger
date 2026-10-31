-- Logs are written only through create_log_with_rate_limit.
--
-- logs_all covered every command, so a signed-in client could INSERT into cigarette_logs
-- through PostgREST and skip the RPC's 50-per-hour cap and its client_op_id
-- idempotency. Every app write path already uses the RPC (a SECURITY DEFINER
-- function, so it is unaffected); the e2e seed helper inserts with the service
-- role. Reads, edits and deletes keep their per-user RLS; edits are limited to
-- the logged fields (column grant below).

DROP POLICY IF EXISTS logs_all ON public.cigarette_logs;

CREATE POLICY logs_select ON public.cigarette_logs
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY logs_update ON public.cigarette_logs
  FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY logs_delete ON public.cigarette_logs
  FOR DELETE TO authenticated
  USING (user_id = (SELECT auth.uid()));

REVOKE INSERT ON public.cigarette_logs FROM authenticated;

-- Edits may change only what a person logged. The RPC's hourly window counts
-- created_at, so rewriting it (or id / user_id / client_op_id) would reopen the
-- bypass. updateLog writes exactly these columns.
REVOKE UPDATE ON public.cigarette_logs FROM authenticated;
GRANT UPDATE (
  ts_utc, local_date, local_hour, brand_id, brand_name_snap, variant_snap,
  quantity, purchase_mode, pack_size, total_price_inr, unit_price_inr,
  price_source, trigger_tag, mood_before, mood_after, craving, context_tag,
  notes, updated_at
) ON public.cigarette_logs TO authenticated;

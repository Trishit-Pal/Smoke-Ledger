-- Logs are written only through create_log_with_rate_limit.
--
-- logs_all covered every command, so a signed-in client could INSERT into cigarette_logs
-- through PostgREST and skip the RPC's 50-per-hour cap and its client_op_id
-- idempotency. Every app write path already uses the RPC (a SECURITY DEFINER
-- function, so it is unaffected); the e2e seed helper inserts with the service
-- role. Reads, edits and deletes keep their per-user RLS.

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

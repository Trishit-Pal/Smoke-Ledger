-- DB hardening: make rate_limit_counters' deny-by-default explicit, and record
-- the accepted-by-design SECURITY DEFINER posture so future audits don't re-flag it.
--
-- Context (verified against live project tvcwrsglceahkjnfuzkn on 2026-06-19):
--   * Supabase advisor 0008 (rls_enabled_no_policy) flags public.rate_limit_counters:
--     RLS is enabled (20260523092236) with REVOKE ALL FROM anon, authenticated, but
--     no POLICY object exists. The table is already doubly locked — client roles hold
--     no table privileges AND RLS denies by default; only service_role (bypasses RLS)
--     and the consume_rate_limit SECURITY DEFINER RPC (runs as table owner) touch it.
--     This migration adds an explicit deny policy to document intent and clear the lint.
--     It is behavior-neutral.
--
--   * Supabase advisor 0029 (authenticated_security_definer_function_executable) still
--     WARNs on 11 user-facing RPCs (create_log_with_rate_limit, list_logs_page,
--     get_daily_summary, get_random_facts, get_health_milestones, mark_fact_seen,
--     export_account_data, erase_account_data, sync_default_brand_catalog,
--     refresh_seed_prices_from_catalog, seed_default_brands_if_empty). This is
--     ACCEPTED BY DESIGN: signed-in clients legitimately call these and each scopes
--     to auth.uid() internally. 20260531075255_lockdown_secdef_execute.sql already
--     revoked anon + PUBLIC EXECUTE (closing advisor 0028) while intentionally keeping
--     `authenticated`. Do NOT revoke `authenticated` from this set — it breaks the app.

-- Explicit deny for client roles (PERMISSIVE policy that never matches). service_role
-- and the SECURITY DEFINER RPC owner bypass RLS, so the rate limiter is unaffected.
DROP POLICY IF EXISTS rate_limit_counters_deny_clients ON public.rate_limit_counters;
CREATE POLICY rate_limit_counters_deny_clients
  ON public.rate_limit_counters
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

COMMENT ON TABLE public.rate_limit_counters IS
  'Rate-limit state. Client roles (anon, authenticated) hold no table privileges and '
  'are denied by RLS (policy rate_limit_counters_deny_clients). Only the '
  'consume_rate_limit SECURITY DEFINER RPC and service_role (which bypasses RLS) '
  'access this table.';

NOTIFY pgrst, 'reload schema';

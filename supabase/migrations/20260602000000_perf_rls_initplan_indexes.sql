-- Performance + correctness pass (zero-risk, DB-only). Idempotent.
--
-- 1. RLS InitPlan: wrap auth.uid() in a scalar subquery so the planner evaluates
--    it ONCE per query (InitPlan) instead of once per row. Semantically identical;
--    silences the `auth_rls_initplan` advisor (17 policies / 13 tables).
--    Ref: https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select
-- 2. Covering indexes for unindexed foreign keys (additive; speeds FK probes and
--    cascade actions on brand/account delete). Silences `unindexed_foreign_keys`.
-- 3. Fix v_daily_summary_user: it was created WITHOUT security_invoker, so it ran
--    with owner privileges and BYPASSED RLS — a signed-in user could read every
--    user's daily aggregates. ALTER only ADDS RLS enforcement; the get_daily_summary
--    RPC path (filters by uid) is unaffected. Silences `security_definer_view` (ERROR).
--
-- NOT included here (deferred to a dedicated security migration): revoking anon/PUBLIC
-- EXECUTE on SECURITY DEFINER RPCs. The privilege flows via PUBLIC, so a safe fix must
-- REVOKE FROM PUBLIC and re-GRANT authenticated per function without breaking the
-- signup trigger (handle_new_user) — out of the zero-risk scope of this migration.

-- ── 1. RLS InitPlan rewrite ─────────────────────────────────────────────────

-- FOR ALL policies (USING + WITH CHECK), keyed on user_id.
ALTER POLICY brands_all            ON public.brands           USING (user_id = (select auth.uid())) WITH CHECK (user_id = (select auth.uid()));
ALTER POLICY variants_all          ON public.brand_variants   USING (user_id = (select auth.uid())) WITH CHECK (user_id = (select auth.uid()));
ALTER POLICY logs_all              ON public.cigarette_logs   USING (user_id = (select auth.uid())) WITH CHECK (user_id = (select auth.uid()));
ALTER POLICY goals_all             ON public.goals            USING (user_id = (select auth.uid())) WITH CHECK (user_id = (select auth.uid()));
ALTER POLICY price_entries_all     ON public.price_entries    USING (user_id = (select auth.uid())) WITH CHECK (user_id = (select auth.uid()));
ALTER POLICY reminders_all         ON public.reminders        USING (user_id = (select auth.uid())) WITH CHECK (user_id = (select auth.uid()));
ALTER POLICY settings_kv_all       ON public.settings_kv      USING (user_id = (select auth.uid())) WITH CHECK (user_id = (select auth.uid()));
ALTER POLICY user_facts_seen_all   ON public.user_facts_seen  USING (user_id = (select auth.uid())) WITH CHECK (user_id = (select auth.uid()));

-- user_profiles: keyed on id.
ALTER POLICY user_profiles_select  ON public.user_profiles    USING (id = (select auth.uid()));
ALTER POLICY user_profiles_insert  ON public.user_profiles    WITH CHECK (id = (select auth.uid()));
ALTER POLICY user_profiles_update  ON public.user_profiles    USING (id = (select auth.uid())) WITH CHECK (id = (select auth.uid()));

-- usage_events: per-command policies.
ALTER POLICY usage_select          ON public.usage_events     USING (user_id = (select auth.uid()));
ALTER POLICY usage_insert          ON public.usage_events     WITH CHECK (user_id = (select auth.uid()));
ALTER POLICY usage_delete          ON public.usage_events     USING (user_id = (select auth.uid()));

-- audit_events: select-only for the owner.
ALTER POLICY audit_events_select   ON public.audit_events     USING (user_id = (select auth.uid()));

-- error_events: insert (own rows) + select (own rows).
ALTER POLICY error_events_insert   ON public.error_events     WITH CHECK (user_id = (select auth.uid()));
ALTER POLICY error_events_select   ON public.error_events     USING (user_id = (select auth.uid()));

-- ── 2. Covering indexes for unindexed foreign keys (additive) ───────────────

CREATE INDEX IF NOT EXISTS idx_logs_brand_id     ON public.cigarette_logs (brand_id);
CREATE INDEX IF NOT EXISTS idx_variants_brand_id ON public.brand_variants (brand_id);
CREATE INDEX IF NOT EXISTS idx_price_entries_user ON public.price_entries (user_id);
CREATE INDEX IF NOT EXISTS idx_reminders_user    ON public.reminders (user_id);

-- ── 3. Close the v_daily_summary_user RLS-bypass (security + correctness) ────

ALTER VIEW public.v_daily_summary_user SET (security_invoker = true);

NOTIFY pgrst, 'reload schema';

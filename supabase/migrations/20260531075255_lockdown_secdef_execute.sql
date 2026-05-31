-- Revoke anon/PUBLIC EXECUTE on public SECURITY DEFINER RPCs.
-- Closes Supabase advisor lint 0028 (anon_security_definer_function_executable) for the full
-- set, and lint 0029 (authenticated_…) for the internal/service-only functions.
-- Applied to live project tvcwrsglceahkjnfuzkn on 2026-05-31 (version 20260531075255).
-- Rationale + verification: see SCALING_PLAN.md §1b / §6.
--
-- handle_new_user fires via the on_auth_user_created trigger as the table owner; trigger
-- execution does NOT require an EXECUTE grant on the function, so signup is unaffected.

-- User-facing RPCs (clients legitimately call these): keep `authenticated`, drop `anon` + PUBLIC.
do $$
declare fn text;
begin
  for fn in
    select format('%I(%s)', p.proname, pg_get_function_identity_arguments(p.oid))
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prosecdef and p.proname in (
      'create_log_with_rate_limit','list_logs_page','get_daily_summary','get_random_facts',
      'get_health_milestones','mark_fact_seen','export_account_data','erase_account_data',
      'sync_default_brand_catalog','refresh_seed_prices_from_catalog','seed_default_brands_if_empty')
  loop
    execute format('revoke execute on function public.%s from anon, public;', fn);
    execute format('grant  execute on function public.%s to authenticated;', fn);
  end loop;
end $$;

-- Internal / trigger / service-only: drop anon + authenticated + PUBLIC (service_role grant stays).
do $$
declare fn text;
begin
  for fn in
    select format('%I(%s)', p.proname, pg_get_function_identity_arguments(p.oid))
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prosecdef and p.proname in (
      'handle_new_user','rls_auto_enable','consume_rate_limit','record_audit_event')
  loop
    execute format('revoke execute on function public.%s from anon, authenticated, public;', fn);
  end loop;
end $$;

-- Realtime CDC opt-in for the tables the web client subscribes to.
--
-- Supabase ships an empty `supabase_realtime` publication; tables must be
-- explicitly added before postgres_changes events fire. RLS on each table
-- continues to scope which rows a given subscriber receives — the publication
-- decides which tables emit CDC at all, not who sees them.
--
-- Idempotent: each ADD is guarded by a pg_publication_tables existence check
-- so re-running the migration on an environment that already has these tables
-- in the publication is a no-op. `ALTER PUBLICATION ... ADD TABLE` is not
-- idempotent on its own and would raise `duplicate_object` otherwise.
--
-- Tables included:
--   - public.cigarette_logs  (high-frequency mutations from log/new + delete)
--   - public.goals           (medium-frequency — cross-tab goal edits)
--   - public.user_profiles   (low-frequency — settings sync across tabs)
--
-- Excluded (by design): brands, brand_variants. Custom brand creation is rare
-- and the channel cost outweighs the UX win.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'cigarette_logs'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.cigarette_logs';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'goals'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.goals';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'user_profiles'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.user_profiles';
  END IF;
END $$;

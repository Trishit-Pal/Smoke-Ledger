-- Enable realtime CDC for the tables both clients subscribe to.
--
-- The earlier migration 20260606000000_realtime_publications.sql was authored
-- but never applied to the live project, so `supabase_realtime` shipped empty
-- and postgres_changes fired on neither web nor mobile. This migration is the
-- corrective, idempotent re-application plus the replica-identity fix needed for
-- DELETE events to survive the client-side row filter.
--
-- Tables (RLS still scopes which rows each subscriber receives):
--   - public.cigarette_logs  (INSERT/UPDATE/DELETE, filtered by user_id)
--   - public.goals           (INSERT/UPDATE/DELETE, filtered by user_id)
--   - public.user_profiles   (UPDATE, filtered by id = the PK)
--
-- REPLICA IDENTITY FULL on cigarette_logs and goals: their realtime filter is
-- `user_id=eq.<uid>`, but the default replica identity only publishes the
-- primary key (id) in the OLD tuple for UPDATE/DELETE. Without FULL, a DELETE
-- would carry no user_id and the filter would drop it, so a row deleted on one
-- device would never disappear on another. user_profiles is filtered on its PK
-- (id), which the default replica identity already publishes, so it is left as
-- default to avoid the extra WAL cost.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'cigarette_logs'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.cigarette_logs';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'goals'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.goals';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'user_profiles'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.user_profiles';
  END IF;
END $$;

ALTER TABLE public.cigarette_logs REPLICA IDENTITY FULL;
ALTER TABLE public.goals REPLICA IDENTITY FULL;

-- Enable realtime CDC for brand + brand_variant changes so favorites, newly
-- added brands, and price edits sync across devices. These tables are written by
-- the app (Settings brand catalog) and read on the dashboard / log / trends, but
-- were never in the supabase_realtime publication, so a brand or price change on
-- one device never surfaced on another until a manual reload.
--
-- Both tables carry user_id and the client subscriptions filter `user_id=eq.<uid>`,
-- so they need REPLICA IDENTITY FULL for UPDATE/DELETE to publish user_id in the
-- OLD tuple (the default replica identity publishes only the PK, so a delete/edit
-- would otherwise be dropped by the client-side row filter). RLS still scopes
-- which rows each subscriber receives. Idempotent.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'brands'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.brands';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'brand_variants'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.brand_variants';
  END IF;
END $$;

ALTER TABLE public.brands REPLICA IDENTITY FULL;
ALTER TABLE public.brand_variants REPLICA IDENTITY FULL;

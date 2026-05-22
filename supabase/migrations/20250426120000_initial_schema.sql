-- Smoke Ledger: multi-tenant schema with RLS. user_id = auth.users.id

CREATE SCHEMA IF NOT EXISTS smoke_seed;

-- Template rows copied for each new user (no RLS exposure to clients)
CREATE TABLE smoke_seed.brand_catalog (
  sort_order int PRIMARY KEY,
  brand_name text NOT NULL,
  category text NOT NULL,
  variant_name text NOT NULL,
  default_pack_size int NOT NULL,
  avg_price_inr numeric NOT NULL
);

INSERT INTO smoke_seed.brand_catalog VALUES
(1, 'Gold Flake', 'regular', 'Kings', 10, 200),
(2, 'Gold Flake', 'regular', 'Small', 10, 130),
(3, 'Gold Flake', 'regular', 'Lights', 10, 190),
(4, 'Classic', 'regular', 'Regular', 10, 200),
(5, 'Classic', 'regular', 'Milds', 10, 210),
(6, 'Classic', 'regular', 'Ultra Milds', 10, 220),
(7, 'Navy Cut', 'regular', 'Filter', 10, 170),
(8, 'Four Square', 'budget', 'Kings', 10, 120),
(9, 'Marlboro', 'premium', 'Red', 20, 380),
(10, 'Marlboro', 'premium', 'Gold', 20, 380),
(11, 'Marlboro', 'premium', 'Advance', 20, 380),
(12, 'Benson & Hedges', 'premium', 'Classic', 20, 410),
(13, 'Dunhill', 'imported', 'Switch', 20, 430),
(14, 'Insignia', 'imported', 'Slim', 20, 430),
(15, 'Wills', 'regular', 'Navy Cut', 10, 170),
(16, 'Capstan', 'budget', 'Original', 10, 110);

REVOKE ALL ON SCHEMA smoke_seed FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA smoke_seed FROM PUBLIC;

-- ---------------------------------------------------------------------------
CREATE TABLE public.user_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  baseline_per_day numeric(5,2), -- C4 audit: changed from double precision pre-launch; existing dev DBs need manual ALTER or reset
  baseline_window_days int NOT NULL DEFAULT 30,
  currency text NOT NULL DEFAULT 'INR',
  discreet_mode boolean NOT NULL DEFAULT false,
  app_lock_enabled boolean NOT NULL DEFAULT false,
  hide_totals_on_home boolean NOT NULL DEFAULT false,
  onboarded_at timestamptz
);

CREATE TABLE public.brands (
  id text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  name text NOT NULL,
  category text NOT NULL DEFAULT 'regular',
  is_seed boolean NOT NULL DEFAULT false,
  is_favorite boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  UNIQUE (user_id, name)
);

CREATE TABLE public.brand_variants (
  id text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  brand_id text NOT NULL REFERENCES public.brands (id) ON DELETE CASCADE,
  name text NOT NULL,
  default_pack_size int NOT NULL DEFAULT 10,
  avg_price_inr numeric,
  last_price_inr numeric,
  last_priced_at timestamptz
);

CREATE TABLE public.cigarette_logs (
  id text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  ts_utc timestamptz NOT NULL,
  local_date text NOT NULL,
  local_hour int NOT NULL,
  brand_id text REFERENCES public.brands (id) ON DELETE SET NULL,
  brand_name_snap text,
  variant_snap text,
  quantity int NOT NULL DEFAULT 1,
  purchase_mode text NOT NULL DEFAULT 'single',
  pack_size int,
  total_price_inr numeric,
  unit_price_inr numeric,
  price_source text NOT NULL DEFAULT 'unknown',
  trigger_tag text,
  mood_before text,
  mood_after text,
  craving int,
  context_tag text,
  notes text,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL
);

CREATE TABLE public.price_entries (
  id text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  brand_id text,
  variant_id text,
  unit_price_inr numeric NOT NULL,
  pack_size int,
  source text NOT NULL DEFAULT 'user',
  observed_at timestamptz NOT NULL
);

CREATE TABLE public.goals (
  id text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  type text NOT NULL,
  target_value double precision NOT NULL,
  current_baseline double precision,
  start_date text NOT NULL,
  end_date text,
  status text NOT NULL DEFAULT 'active',
  meta_json jsonb,
  created_at timestamptz NOT NULL
);

CREATE TABLE public.settings_kv (
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  key text NOT NULL,
  value_json jsonb NOT NULL,
  PRIMARY KEY (user_id, key)
);

CREATE TABLE public.reminders (
  id text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  kind text NOT NULL,
  time_local text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  quiet_start text,
  quiet_end text
);

CREATE TABLE public.usage_events (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  name text NOT NULL,
  props_json jsonb,
  ts timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_logs_user_local_date ON public.cigarette_logs (user_id, local_date DESC);
CREATE INDEX idx_logs_user_created ON public.cigarette_logs (user_id, created_at DESC);
CREATE INDEX idx_logs_user_brand ON public.cigarette_logs (user_id, brand_id);
CREATE INDEX idx_logs_brand ON public.cigarette_logs (brand_id);
CREATE INDEX idx_variants_user_brand ON public.brand_variants (user_id, brand_id);
CREATE INDEX idx_goals_user_status ON public.goals (user_id, status);
CREATE INDEX idx_usage_user_ts ON public.usage_events (user_id, ts DESC);

-- ---------------------------------------------------------------------------
-- Seed brands for a user from catalog (server-side only)
CREATE OR REPLACE FUNCTION smoke_seed.apply_default_brands (target_user uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = smoke_seed, public
AS $$
DECLARE
  cur_brand text := '';
  cur_brand_id text;
  r record;
BEGIN
  FOR r IN
  SELECT *
  FROM smoke_seed.brand_catalog
  ORDER BY sort_order
  LOOP
    IF cur_brand IS DISTINCT FROM r.brand_name THEN
      cur_brand := r.brand_name;
      cur_brand_id := 'brd_' || replace(gen_random_uuid()::text, '-', '');
      INSERT INTO public.brands (
        id,
        user_id,
        name,
        category,
        is_seed,
        is_favorite,
        created_at,
        updated_at
      )
      VALUES (
        cur_brand_id,
        target_user,
        r.brand_name,
        r.category,
        true,
        false,
        now(),
        now()
      );
    END IF;
    INSERT INTO public.brand_variants (
      id,
      user_id,
      brand_id,
      name,
      default_pack_size,
      avg_price_inr,
      last_price_inr,
      last_priced_at
    )
    VALUES (
      'var_' || replace(gen_random_uuid()::text, '-', ''),
      target_user,
      cur_brand_id,
      r.variant_name,
      r.default_pack_size,
      r.avg_price_inr,
      r.avg_price_inr,
      now()
    );
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user ()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, smoke_seed
AS $$
BEGIN
  INSERT INTO public.user_profiles (id)
    VALUES (NEW.id)
  ON CONFLICT (id) DO NOTHING;
  IF NOT EXISTS (
    SELECT
      1
    FROM
      public.brands
    WHERE
      user_id = NEW.id) THEN
    PERFORM smoke_seed.apply_default_brands (NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users FOR EACH ROW
EXECUTE PROCEDURE public.handle_new_user ();

-- Re-seed default brands if user wiped all brands
CREATE OR REPLACE FUNCTION public.seed_default_brands_if_empty ()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, smoke_seed
AS $$
DECLARE
  uid uuid := auth.uid ();
  n int;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  SELECT
    count(*) INTO n
  FROM
    public.brands
  WHERE
    user_id = uid;
  IF n = 0 THEN
    PERFORM smoke_seed.apply_default_brands (uid);
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.seed_default_brands_if_empty () TO authenticated;

-- ---------------------------------------------------------------------------
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brand_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cigarette_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.price_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings_kv ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_events ENABLE ROW LEVEL SECURITY;

-- user_profiles
CREATE POLICY user_profiles_select ON public.user_profiles FOR SELECT TO authenticated
  USING (id = auth.uid ());

CREATE POLICY user_profiles_insert ON public.user_profiles FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid ());

CREATE POLICY user_profiles_update ON public.user_profiles FOR UPDATE TO authenticated
  USING (id = auth.uid ())
  WITH CHECK (id = auth.uid ());

-- brands
CREATE POLICY brands_all ON public.brands FOR ALL TO authenticated
  USING (user_id = auth.uid ())
  WITH CHECK (user_id = auth.uid ());

-- brand_variants
CREATE POLICY variants_all ON public.brand_variants FOR ALL TO authenticated
  USING (user_id = auth.uid ())
  WITH CHECK (user_id = auth.uid ());

-- cigarette_logs
CREATE POLICY logs_all ON public.cigarette_logs FOR ALL TO authenticated
  USING (user_id = auth.uid ())
  WITH CHECK (user_id = auth.uid ());

-- price_entries
CREATE POLICY price_entries_all ON public.price_entries FOR ALL TO authenticated
  USING (user_id = auth.uid ())
  WITH CHECK (user_id = auth.uid ());

-- goals
CREATE POLICY goals_all ON public.goals FOR ALL TO authenticated
  USING (user_id = auth.uid ())
  WITH CHECK (user_id = auth.uid ());

-- settings_kv
CREATE POLICY settings_kv_all ON public.settings_kv FOR ALL TO authenticated
  USING (user_id = auth.uid ())
  WITH CHECK (user_id = auth.uid ());

-- reminders
CREATE POLICY reminders_all ON public.reminders FOR ALL TO authenticated
  USING (user_id = auth.uid ())
  WITH CHECK (user_id = auth.uid ());

-- usage_events
CREATE POLICY usage_select ON public.usage_events FOR SELECT TO authenticated
  USING (user_id = auth.uid ());

CREATE POLICY usage_insert ON public.usage_events FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid ());

CREATE POLICY usage_delete ON public.usage_events FOR DELETE TO authenticated
  USING (user_id = auth.uid ());

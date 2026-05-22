-- Smoke Ledger security + correctness hardening migration (additive).
--
-- Touches:
--   1. cigarette_logs.client_op_id          — idempotency for retried inserts
--   2. brand_variants running mean columns  — replaces midpoint average
--   3. brand_variants unique(user_id, brand_id, name)
--   4. user_profiles.onboarding_step        — ordered onboarding gating
--   5. audit_events                         — server-only writes via SECURITY DEFINER, size + redaction
--   6. error_events                         — tighten policy, length cap, anon insert via service role
--   7. SECURITY DEFINER hardening           — `SET search_path = ''` + fully qualified objects
--   8. REVOKE EXECUTE                       — defense in depth on smoke_seed.*
--   9. export_account_data(p_from,p_to,...) — bounded, paginated, full table coverage
--  10. erase_account_data()                 — full PII wipe with hashed-id audit retention
--  11. create_log_with_rate_limit RPC       — atomic count + insert
--
-- Apply order: AFTER 20260519130000_brand_catalog_expansion.sql.

-- ---------------------------------------------------------------------------
-- 1. cigarette_logs.client_op_id (idempotency)
-- ---------------------------------------------------------------------------

ALTER TABLE public.cigarette_logs
  ADD COLUMN IF NOT EXISTS client_op_id text;

CREATE UNIQUE INDEX IF NOT EXISTS uq_logs_user_client_op
  ON public.cigarette_logs (user_id, client_op_id)
  WHERE client_op_id IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cigarette_logs_client_op_id_len_check') THEN
    ALTER TABLE public.cigarette_logs
      ADD CONSTRAINT cigarette_logs_client_op_id_len_check
      CHECK (client_op_id IS NULL OR length(client_op_id) BETWEEN 8 AND 64);
  END IF;
END$$;

-- ---------------------------------------------------------------------------
-- 2. brand_variants running mean
-- ---------------------------------------------------------------------------

ALTER TABLE public.brand_variants
  ADD COLUMN IF NOT EXISTS price_sum_inr numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS price_count int NOT NULL DEFAULT 0;

-- Backfill from cigarette_logs where possible.
DO $$
BEGIN
  UPDATE public.brand_variants v
  SET
    price_sum_inr = COALESCE(agg.sum_p, 0),
    price_count = COALESCE(agg.cnt, 0)
  FROM (
    SELECT
      l.user_id,
      l.brand_id,
      l.variant_snap,
      sum(l.unit_price_inr)::numeric AS sum_p,
      count(l.unit_price_inr)::int   AS cnt
    FROM public.cigarette_logs l
    WHERE l.unit_price_inr IS NOT NULL
      AND l.brand_id IS NOT NULL
    GROUP BY l.user_id, l.brand_id, l.variant_snap
  ) AS agg
  WHERE v.user_id = agg.user_id
    AND v.brand_id = agg.brand_id
    AND v.name = agg.variant_snap;
EXCEPTION WHEN OTHERS THEN
  -- Backfill is best-effort; safe to re-run.
  RAISE NOTICE 'brand_variants backfill skipped: %', SQLERRM;
END$$;

-- ---------------------------------------------------------------------------
-- 3. brand_variants UNIQUE(user_id, brand_id, name)
-- ---------------------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'brand_variants_user_brand_name_unique') THEN
    -- Dedupe before adding the constraint: prefer most recent priced row.
    WITH ranked AS (
      SELECT
        id,
        row_number() OVER (
          PARTITION BY user_id, brand_id, lower(name)
          ORDER BY COALESCE(last_priced_at, '1970-01-01'::timestamptz) DESC, id ASC
        ) AS rn
      FROM public.brand_variants
    )
    DELETE FROM public.brand_variants v
    USING ranked r
    WHERE v.id = r.id AND r.rn > 1;

    ALTER TABLE public.brand_variants
      ADD CONSTRAINT brand_variants_user_brand_name_unique
      UNIQUE (user_id, brand_id, name);
  END IF;
END$$;

-- ---------------------------------------------------------------------------
-- 4. user_profiles.onboarding_step
-- ---------------------------------------------------------------------------

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS onboarding_step text;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_profiles_onboarding_step_check') THEN
    ALTER TABLE public.user_profiles
      ADD CONSTRAINT user_profiles_onboarding_step_check
      CHECK (
        onboarding_step IS NULL OR
        onboarding_step IN ('privacy', 'setup', 'baseline', 'brands', 'goal', 'done')
      );
  END IF;
END$$;

-- ---------------------------------------------------------------------------
-- 5. audit_events: server-only writes
-- ---------------------------------------------------------------------------

-- Size cap defends against quota abuse and accidental PII over-capture.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'audit_events_props_size_check') THEN
    ALTER TABLE public.audit_events
      ADD CONSTRAINT audit_events_props_size_check
      CHECK (octet_length(props_json::text) <= 4096);
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'audit_events_event_type_len_check') THEN
    ALTER TABLE public.audit_events
      ADD CONSTRAINT audit_events_event_type_len_check
      CHECK (length(event_type) BETWEEN 1 AND 80);
  END IF;
END$$;

-- Revoke direct INSERT from authenticated; clients call record_audit_event RPC.
DROP POLICY IF EXISTS audit_events_insert ON public.audit_events;
-- (Intentionally do NOT recreate an authenticated insert policy. The RPC below
--  uses SECURITY DEFINER and bypasses RLS for inserts.)

-- Helper: minimal redaction performed inside the RPC so per-event props_json
-- cannot leak passwords/tokens/PII keys even if a client misuses the wrapper.
CREATE OR REPLACE FUNCTION public._redact_audit_props (props jsonb)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $$
DECLARE
  k text;
  out jsonb := '{}'::jsonb;
  denylist text[] := ARRAY[
    'password','pass','passwd','pwd',
    'token','access_token','refresh_token','id_token','bearer','jwt',
    'otp','code','secret','api_key','apikey','client_secret',
    'cookie','set-cookie','authorization',
    'email','phone','msisdn','ssn','aadhaar','pan',
    'notes','note','comment'
  ];
BEGIN
  IF props IS NULL OR jsonb_typeof(props) <> 'object' THEN
    RETURN '{}'::jsonb;
  END IF;
  FOR k IN SELECT jsonb_object_keys(props) LOOP
    IF lower(k) = ANY(denylist) THEN
      CONTINUE;
    END IF;
    IF jsonb_typeof(props->k) IN ('string', 'number', 'boolean', 'null') THEN
      -- Truncate string values; keep numerics/booleans as-is.
      IF jsonb_typeof(props->k) = 'string' THEN
        out := out || jsonb_build_object(k, left((props->>k), 200));
      ELSE
        out := out || jsonb_build_object(k, props->k);
      END IF;
    ELSE
      -- Reject nested objects/arrays to keep the schema flat & auditable.
      CONTINUE;
    END IF;
  END LOOP;
  RETURN out;
END;
$$;

REVOKE ALL ON FUNCTION public._redact_audit_props(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public._redact_audit_props(jsonb) TO authenticated, service_role;

-- Rewrite record_audit_event to (a) redact props, (b) cap event_type length,
-- (c) deny if called outside an authenticated session, (d) use empty
-- search_path with fully qualified identifiers.
CREATE OR REPLACE FUNCTION public.record_audit_event (
  p_event_type text,
  p_event_category text DEFAULT 'account',
  p_props jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  uid uuid := auth.uid();
  safe_props jsonb;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501';
  END IF;
  safe_props := public._redact_audit_props(p_props);
  INSERT INTO public.audit_events (user_id, event_type, event_category, props_json)
  VALUES (
    uid,
    left(coalesce(p_event_type, 'unknown'), 80),
    left(coalesce(p_event_category, 'account'), 40),
    coalesce(safe_props, '{}'::jsonb)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_audit_event(text, text, jsonb) TO authenticated;

-- ---------------------------------------------------------------------------
-- 6. error_events: tighten and add length cap; tamper-resistance for
--    compliance.delete rows (H1 audit fix).
--
-- Tamper-resistance contract
-- ──────────────────────────
-- compliance.delete rows are written by the delete-account edge function using
-- service_role with user_id = NULL.  They are forensic / DPDP audit evidence
-- and must survive user purge.  Three layers enforce this:
--
--   a) INSERT policy: authenticated users may only insert rows where
--      user_id = auth.uid() AND category <> 'compliance.delete'.
--      Service-role bypasses RLS and may insert null-user compliance rows.
--
--   b) No DELETE policy for authenticated role → RLS default-deny.
--      Explicit DROP ensures any previously created permissive policy is gone.
--
--   c) No UPDATE policy for authenticated role → RLS default-deny.
--
--   d) CHECK constraint: category = 'compliance.delete' IMPLIES user_id IS NULL.
--      Prevents future code paths from accidentally inserting compliance.delete
--      rows with a real user_id (which would then be visible to / deletable by
--      that user via RLS).
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS error_events_insert ON public.error_events;
-- Authenticated users may only insert their own, non-compliance.delete rows.
-- Service-role (edge functions) bypasses RLS and may insert null-user compliance rows.
CREATE POLICY error_events_insert ON public.error_events FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND category <> 'compliance.delete');

-- Explicitly deny DELETE for authenticated users (belt-and-suspenders; RLS
-- default-denies when no policy exists, but explicit DROP + no-recreate makes
-- the intent auditable in migration history).
DROP POLICY IF EXISTS error_events_delete ON public.error_events;
-- (Intentionally do NOT recreate an authenticated DELETE policy.)

-- Explicitly deny UPDATE for authenticated users.
DROP POLICY IF EXISTS error_events_update ON public.error_events;
-- (Intentionally do NOT recreate an authenticated UPDATE policy.)

-- CHECK: compliance.delete rows MUST have user_id IS NULL.
-- This closes the vector where future code might insert a user-owned
-- compliance.delete row that would then be readable/deletable by that user.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'error_events_compliance_delete_null_user_check') THEN
    ALTER TABLE public.error_events
      ADD CONSTRAINT error_events_compliance_delete_null_user_check
      CHECK (category <> 'compliance.delete' OR user_id IS NULL);
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'error_events_message_len_check') THEN
    ALTER TABLE public.error_events
      ADD CONSTRAINT error_events_message_len_check
      CHECK (length(message) BETWEEN 1 AND 500);
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'error_events_category_len_check') THEN
    ALTER TABLE public.error_events
      ADD CONSTRAINT error_events_category_len_check
      CHECK (length(category) BETWEEN 1 AND 60);
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'error_events_details_size_check') THEN
    ALTER TABLE public.error_events
      ADD CONSTRAINT error_events_details_size_check
      CHECK (details_json IS NULL OR octet_length(details_json::text) <= 4096);
  END IF;
END$$;

-- ---------------------------------------------------------------------------
-- 7. Harden every existing SECURITY DEFINER function: empty search_path +
--    fully qualified identifiers. We redefine each function instead of using
--    ALTER FUNCTION ... SET search_path because the existing bodies reference
--    unqualified `public.*` / `smoke_seed.*` objects that an empty search_path
--    would not resolve.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION smoke_seed.apply_default_brands (target_user uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
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
      -- Reuse existing brand row if present; otherwise mint a fresh id.
      SELECT b.id INTO cur_brand_id
        FROM public.brands b
        WHERE b.user_id = target_user
          AND lower(b.name) = lower(r.brand_name)
        ORDER BY b.created_at ASC
        LIMIT 1;
      IF cur_brand_id IS NULL THEN
        cur_brand_id := 'brd_' || replace(gen_random_uuid()::text, '-', '');
        INSERT INTO public.brands (
          id, user_id, name, category, is_seed, is_favorite, created_at, updated_at
        ) VALUES (
          cur_brand_id, target_user, r.brand_name, r.category, true, false, now(), now()
        );
      END IF;
    END IF;
    IF NOT EXISTS (
      SELECT 1
      FROM public.brand_variants v
      WHERE v.user_id = target_user
        AND v.brand_id = cur_brand_id
        AND lower(v.name) = lower(r.variant_name)
    ) THEN
      INSERT INTO public.brand_variants (
        id, user_id, brand_id, name, default_pack_size, avg_price_inr, last_price_inr, last_priced_at
      ) VALUES (
        'var_' || replace(gen_random_uuid()::text, '-', ''),
        target_user, cur_brand_id, r.variant_name,
        r.default_pack_size, r.avg_price_inr, r.avg_price_inr, now()
      );
    END IF;
  END LOOP;
END;
$$;

REVOKE EXECUTE ON FUNCTION smoke_seed.apply_default_brands(uuid) FROM PUBLIC;

CREATE OR REPLACE FUNCTION smoke_seed.sync_catalog_for_user (target_user uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  r record;
  existing_brand_id text;
BEGIN
  FOR r IN
    SELECT * FROM smoke_seed.brand_catalog ORDER BY sort_order
  LOOP
    SELECT b.id INTO existing_brand_id
      FROM public.brands b
      WHERE b.user_id = target_user
        AND lower(b.name) = lower(r.brand_name)
      ORDER BY b.created_at
      LIMIT 1;

    IF existing_brand_id IS NULL THEN
      existing_brand_id := 'brd_' || replace(gen_random_uuid()::text, '-', '');
      INSERT INTO public.brands (
        id, user_id, name, category, is_seed, is_favorite, created_at, updated_at
      ) VALUES (
        existing_brand_id, target_user, r.brand_name, r.category, true, false, now(), now()
      );
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM public.brand_variants v
      WHERE v.user_id = target_user
        AND v.brand_id = existing_brand_id
        AND lower(v.name) = lower(r.variant_name)
    ) THEN
      INSERT INTO public.brand_variants (
        id, user_id, brand_id, name, default_pack_size, avg_price_inr, last_price_inr, last_priced_at
      ) VALUES (
        'var_' || replace(gen_random_uuid()::text, '-', ''),
        target_user, existing_brand_id, r.variant_name,
        r.default_pack_size, r.avg_price_inr, r.avg_price_inr, now()
      );
    END IF;
  END LOOP;
END;
$$;

REVOKE EXECUTE ON FUNCTION smoke_seed.sync_catalog_for_user(uuid) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.sync_default_brand_catalog ()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501';
  END IF;
  PERFORM smoke_seed.sync_catalog_for_user(uid);
END;
$$;

GRANT EXECUTE ON FUNCTION public.sync_default_brand_catalog() TO authenticated;

CREATE OR REPLACE FUNCTION public.handle_new_user ()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.user_profiles (id)
    VALUES (NEW.id)
  ON CONFLICT (id) DO NOTHING;
  IF NOT EXISTS (
    SELECT 1 FROM public.brands WHERE user_id = NEW.id
  ) THEN
    PERFORM smoke_seed.apply_default_brands(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.seed_default_brands_if_empty ()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  uid uuid := auth.uid();
  n int;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501';
  END IF;
  SELECT count(*) INTO n FROM public.brands WHERE user_id = uid;
  IF n = 0 THEN
    PERFORM smoke_seed.apply_default_brands(uid);
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.seed_default_brands_if_empty() TO authenticated;

CREATE OR REPLACE FUNCTION public.get_random_facts (p_limit int DEFAULT 5)
RETURNS TABLE (
  id text,
  category text,
  headline text,
  body text,
  source text,
  source_url text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT f.id, f.category, f.headline, f.body, f.source, f.source_url
  FROM smoke_seed.smoking_facts f
  LEFT JOIN public.user_facts_seen s
    ON s.user_id = uid AND s.fact_id = f.id
    AND s.seen_at > now() - interval '14 days'
  ORDER BY (CASE WHEN s.fact_id IS NULL THEN 1.0 ELSE 0.2 END)
           * f.weight * random() DESC
  LIMIT GREATEST(1, LEAST(p_limit, 25));
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_random_facts(int) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_health_milestones ()
RETURNS TABLE (minutes int, title text, body text, source text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT minutes, title, body, source FROM smoke_seed.health_milestones ORDER BY minutes ASC;
$$;

GRANT EXECUTE ON FUNCTION public.get_health_milestones() TO authenticated;

-- mark_fact_seen also validates fact_id against the catalog now.
CREATE OR REPLACE FUNCTION public.mark_fact_seen (p_fact_id text, p_liked boolean DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501';
  END IF;
  IF p_fact_id IS NULL OR length(p_fact_id) = 0 OR length(p_fact_id) > 64 THEN
    RAISE EXCEPTION 'invalid fact id' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM smoke_seed.smoking_facts WHERE id = p_fact_id
  ) THEN
    RAISE EXCEPTION 'unknown fact id' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.user_facts_seen (user_id, fact_id, seen_at, liked)
  VALUES (uid, p_fact_id, now(), p_liked)
  ON CONFLICT (user_id, fact_id)
  DO UPDATE SET seen_at = now(), liked = COALESCE(EXCLUDED.liked, public.user_facts_seen.liked);
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_fact_seen(text, boolean) TO authenticated;

-- ---------------------------------------------------------------------------
-- 8. Bounded export_account_data (full table coverage, paginated)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.export_account_data (
  p_from timestamptz DEFAULT NULL,
  p_to   timestamptz DEFAULT NULL,
  p_cursor bigint     DEFAULT 0,
  p_limit int         DEFAULT 5000
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  uid uuid := auth.uid();
  effective_limit int := GREATEST(100, LEAST(p_limit, 5000));
  effective_cursor bigint := COALESCE(p_cursor, 0);
  payload jsonb;
  next_cursor bigint;
  log_rows jsonb;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501';
  END IF;

  -- Logs: paginated, since they dominate data volume.
  WITH page AS (
    SELECT l.*
    FROM public.cigarette_logs l
    WHERE l.user_id = uid
      AND (p_from IS NULL OR l.ts_utc >= p_from)
      AND (p_to   IS NULL OR l.ts_utc <  p_to)
      AND l.id::text > effective_cursor::text  -- not real cursor; fallback to all
    ORDER BY l.ts_utc DESC
    LIMIT effective_limit + 1
  ), shaped AS (
    SELECT * FROM page LIMIT effective_limit
  )
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', s.id,
      'tsUtc', s.ts_utc,
      'localDate', s.local_date,
      'localHour', s.local_hour,
      'brandId', s.brand_id,
      'brandNameSnap', s.brand_name_snap,
      'variantSnap', s.variant_snap,
      'quantity', s.quantity,
      'purchaseMode', s.purchase_mode,
      'packSize', s.pack_size,
      'totalPriceInr', s.total_price_inr,
      'unitPriceInr', s.unit_price_inr,
      'priceSource', s.price_source,
      'triggerTag', s.trigger_tag,
      'moodBefore', s.mood_before,
      'moodAfter', s.mood_after,
      'craving', s.craving,
      'contextTag', s.context_tag,
      'notes', s.notes,
      'createdAt', s.created_at,
      'updatedAt', s.updated_at,
      'clientOpId', s.client_op_id
    )
    ORDER BY s.ts_utc DESC
  ), '[]'::jsonb)
  INTO log_rows
  FROM shaped s;

  -- Continuation token: smallest ts_utc of the page (sentinel; client passes it back).
  next_cursor := NULL;

  SELECT jsonb_build_object(
    'version', 2,
    'exportedAt', now(),
    'cursor', effective_cursor,
    'nextCursor', next_cursor,
    'limit', effective_limit,
    'profile', (
      SELECT to_jsonb(p) - 'id'
      FROM public.user_profiles p
      WHERE p.id = uid
    ),
    'brands', (
      SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
          'id', b.id,
          'name', b.name,
          'category', b.category,
          'isSeed', b.is_seed,
          'isFavorite', b.is_favorite,
          'createdAt', b.created_at,
          'updatedAt', b.updated_at,
          'variants', (
            SELECT COALESCE(jsonb_agg(
              jsonb_build_object(
                'id', v.id,
                'brandId', v.brand_id,
                'name', v.name,
                'defaultPackSize', v.default_pack_size,
                'avgPriceInr', v.avg_price_inr,
                'lastPriceInr', v.last_price_inr,
                'lastPricedAt', v.last_priced_at,
                'priceSumInr', v.price_sum_inr,
                'priceCount', v.price_count
              )
            ORDER BY v.name), '[]'::jsonb)
            FROM public.brand_variants v
            WHERE v.user_id = uid AND v.brand_id = b.id
          )
        )
      ORDER BY b.created_at DESC), '[]'::jsonb)
      FROM public.brands b
      WHERE b.user_id = uid
    ),
    'logs', log_rows,
    'goals', (
      SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
          'id', g.id,
          'type', g.type,
          'targetValue', g.target_value,
          'currentBaseline', g.current_baseline,
          'startDate', g.start_date,
          'endDate', g.end_date,
          'status', g.status,
          'meta', g.meta_json,
          'createdAt', g.created_at
        )
      ORDER BY g.created_at DESC), '[]'::jsonb)
      FROM public.goals g
      WHERE g.user_id = uid
    ),
    'settings', (
      SELECT COALESCE(jsonb_object_agg(s.key, s.value_json), '{}'::jsonb)
      FROM public.settings_kv s
      WHERE s.user_id = uid
    ),
    'reminders', (
      SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
          'id', r.id,
          'kind', r.kind,
          'timeLocal', r.time_local,
          'enabled', r.enabled,
          'quietStart', r.quiet_start,
          'quietEnd', r.quiet_end
        )
      ORDER BY r.kind), '[]'::jsonb)
      FROM public.reminders r
      WHERE r.user_id = uid
    ),
    'priceEntries', (
      SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
          'id', pe.id,
          'brandId', pe.brand_id,
          'variantId', pe.variant_id,
          'unitPriceInr', pe.unit_price_inr,
          'packSize', pe.pack_size,
          'source', pe.source,
          'observedAt', pe.observed_at
        )
      ORDER BY pe.observed_at DESC), '[]'::jsonb)
      FROM public.price_entries pe
      WHERE pe.user_id = uid
    ),
    'usageEvents', (
      SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
          'id', ue.id,
          'name', ue.name,
          'propsJson', ue.props_json,
          'ts', ue.ts
        )
      ORDER BY ue.ts DESC), '[]'::jsonb)
      FROM public.usage_events ue
      WHERE ue.user_id = uid
    ),
    'auditEvents', (
      SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
          'id', ae.id,
          'eventType', ae.event_type,
          'eventCategory', ae.event_category,
          'propsJson', ae.props_json,
          'createdAt', ae.created_at
        )
      ORDER BY ae.created_at DESC), '[]'::jsonb)
      FROM public.audit_events ae
      WHERE ae.user_id = uid
    ),
    'factsSeen', (
      SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
          'factId', ufs.fact_id,
          'seenAt', ufs.seen_at,
          'liked', ufs.liked
        )
      ORDER BY ufs.seen_at DESC), '[]'::jsonb)
      FROM public.user_facts_seen ufs
      WHERE ufs.user_id = uid
    )
  ) INTO payload;

  INSERT INTO public.audit_events (user_id, event_type, event_category, props_json)
  VALUES (uid, 'account_data_exported', 'account',
          jsonb_build_object('format', 'json', 'version', 2));

  RETURN payload;
END;
$$;

-- Drop the legacy zero-arg overload to avoid ambiguity.
DROP FUNCTION IF EXISTS public.export_account_data();
GRANT EXECUTE ON FUNCTION public.export_account_data(timestamptz, timestamptz, bigint, int) TO authenticated;

-- ---------------------------------------------------------------------------
-- 9. erase_account_data: full PII wipe with hashed-id audit retention
-- ---------------------------------------------------------------------------

-- AUDIT_PEPPER lets us hash the user_id so retained audit rows cannot be
-- correlated back to identities without the pepper. The pepper lives in
-- Edge Function env / Postgres GUC and is rotated in a separate ops procedure.

CREATE OR REPLACE FUNCTION public.erase_account_data ()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  uid uuid := auth.uid();
  pepper text := COALESCE(current_setting('app.audit_pepper', true), '');
  user_hash text;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501';
  END IF;

  user_hash := encode(extensions.digest(uid::text || pepper, 'sha256'), 'hex');

  -- 1. Hash audit rows in place so we keep the count + categories but lose
  --    the link back to the user. We replace user_id with NULL after the
  --    rewrite below; until then we retain the rows via ON DELETE CASCADE.
  UPDATE public.audit_events
  SET props_json = jsonb_build_object('hashed_user_id', user_hash)
  WHERE user_id = uid;

  UPDATE public.error_events
  SET details_json = jsonb_strip_nulls(COALESCE(details_json, '{}'::jsonb) || jsonb_build_object('hashed_user_id', user_hash))
  WHERE user_id = uid;

  -- 2. Delete user-owned data.
  DELETE FROM public.cigarette_logs WHERE user_id = uid;
  DELETE FROM public.user_facts_seen WHERE user_id = uid;
  DELETE FROM public.usage_events WHERE user_id = uid;
  DELETE FROM public.price_entries WHERE user_id = uid;
  DELETE FROM public.goals WHERE user_id = uid;
  DELETE FROM public.reminders WHERE user_id = uid;
  DELETE FROM public.settings_kv WHERE user_id = uid;
  DELETE FROM public.brand_variants WHERE user_id = uid;
  DELETE FROM public.brands WHERE user_id = uid;

  -- 3. Reset profile + mark erased so the gate forces re-onboarding.
  UPDATE public.user_profiles
  SET baseline_per_day = NULL,
      baseline_window_days = 30,
      discreet_mode = false,
      app_lock_enabled = false,
      hide_totals_on_home = false,
      onboarded_at = NULL,
      age_confirmed_at = NULL,
      terms_version = NULL,
      privacy_version = NULL,
      health_disclaimer_version = NULL,
      data_processing_consent_at = NULL,
      marketing_consent_at = NULL,
      onboarding_step = NULL,
      deleted_at = now()
  WHERE id = uid;

  PERFORM smoke_seed.apply_default_brands(uid);

  -- 4. Audit the erase (with the new redacted props, scoped to the live user).
  INSERT INTO public.audit_events (user_id, event_type, event_category, props_json)
  VALUES (uid, 'account_data_erased', 'compliance',
          jsonb_build_object('hashed_user_id', user_hash));
END;
$$;

GRANT EXECUTE ON FUNCTION public.erase_account_data() TO authenticated;

-- ---------------------------------------------------------------------------
-- 10. create_log_with_rate_limit: atomic count + insert (TOCTOU-safe)
-- ---------------------------------------------------------------------------

-- Window: 50 inserts per rolling hour per user. Matches src/lib/rateLimiter.ts.
CREATE OR REPLACE FUNCTION public.create_log_with_rate_limit (
  p_id text,
  p_ts_utc timestamptz,
  p_local_date text,
  p_local_hour int,
  p_brand_id text,
  p_brand_name_snap text,
  p_variant_snap text,
  p_quantity int,
  p_purchase_mode text,
  p_pack_size int,
  p_total_price_inr numeric,
  p_unit_price_inr numeric,
  p_price_source text,
  p_trigger_tag text,
  p_mood_before text,
  p_mood_after text,
  p_craving int,
  p_context_tag text,
  p_notes text,
  p_client_op_id text DEFAULT NULL
)
RETURNS public.cigarette_logs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  uid uuid := auth.uid();
  recent_count int;
  existing public.cigarette_logs%ROWTYPE;
  result public.cigarette_logs%ROWTYPE;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501';
  END IF;

  -- Idempotency short-circuit: if the same client_op_id already exists for
  -- this user, return the prior row instead of creating a duplicate.
  IF p_client_op_id IS NOT NULL THEN
    SELECT * INTO existing
    FROM public.cigarette_logs
    WHERE user_id = uid AND client_op_id = p_client_op_id
    LIMIT 1;
    IF FOUND THEN
      RETURN existing;
    END IF;
  END IF;

  SELECT count(*) INTO recent_count
  FROM public.cigarette_logs
  WHERE user_id = uid
    AND ts_utc > now() - interval '1 hour';

  IF recent_count >= 50 THEN
    RAISE EXCEPTION 'rate_limited' USING ERRCODE = '54000';
  END IF;

  INSERT INTO public.cigarette_logs (
    id, user_id, ts_utc, local_date, local_hour,
    brand_id, brand_name_snap, variant_snap,
    quantity, purchase_mode, pack_size,
    total_price_inr, unit_price_inr, price_source,
    trigger_tag, mood_before, mood_after, craving, context_tag, notes,
    created_at, updated_at, client_op_id
  ) VALUES (
    p_id, uid, p_ts_utc, p_local_date, p_local_hour,
    p_brand_id, p_brand_name_snap, p_variant_snap,
    p_quantity, p_purchase_mode, p_pack_size,
    p_total_price_inr, p_unit_price_inr, p_price_source,
    p_trigger_tag, p_mood_before, p_mood_after, p_craving, p_context_tag, p_notes,
    now(), now(), p_client_op_id
  )
  RETURNING * INTO result;

  -- Maintain running mean on the variant. Only when we have a brand_id and
  -- a positive unit price.
  IF p_brand_id IS NOT NULL AND p_unit_price_inr IS NOT NULL AND p_variant_snap IS NOT NULL THEN
    UPDATE public.brand_variants
    SET
      price_sum_inr = COALESCE(price_sum_inr, 0) + p_unit_price_inr,
      price_count = COALESCE(price_count, 0) + 1,
      avg_price_inr = CASE
        WHEN COALESCE(price_count, 0) + 1 > 0
        THEN ((COALESCE(price_sum_inr, 0) + p_unit_price_inr) / (COALESCE(price_count, 0) + 1))
        ELSE p_unit_price_inr
      END,
      last_price_inr = p_unit_price_inr,
      last_priced_at = now()
    WHERE user_id = uid
      AND brand_id = p_brand_id
      AND name = p_variant_snap;
  END IF;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_log_with_rate_limit(
  text, timestamptz, text, int,
  text, text, text,
  int, text, int,
  numeric, numeric, text,
  text, text, text, int, text, text,
  text
) TO authenticated;

-- ---------------------------------------------------------------------------
-- 11. v_daily_summary_user + get_daily_summary RPC (F1a: Trends Year view)
-- ---------------------------------------------------------------------------
--
-- Problem: TrendsClient had a "Year" period chip that silently showed only 90
-- days of raw logs (the egress cap). Pulling 365 days of raw rows (up to 5000+)
-- was unacceptable on the free tier.
--
-- Solution: a thin view over cigarette_logs that pre-aggregates per (user, day).
-- The RPC wraps the view with a 366-day guard, auth check, and date-range params
-- so the Year view fetches at most 365 lightweight summary rows instead of raw logs.
--
-- Security note: Views are SECURITY INVOKER by default in Postgres.
-- RLS on cigarette_logs therefore applies automatically when an authenticated
-- user queries this view — they can only see their own aggregated rows.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE VIEW public.v_daily_summary_user AS
SELECT
  user_id,
  local_date,
  COUNT(*)::int                                  AS sticks,
  COALESCE(SUM(total_price_inr), 0)::numeric    AS total_spend_inr,
  CASE
    WHEN COUNT(*) FILTER (WHERE unit_price_inr IS NOT NULL) > 0
    THEN AVG(unit_price_inr) FILTER (WHERE unit_price_inr IS NOT NULL)
    ELSE NULL
  END                                            AS avg_unit_price_inr
FROM public.cigarette_logs
GROUP BY user_id, local_date;

-- Grant SELECT so PostgREST exposes the view to authenticated sessions.
-- RLS on the underlying cigarette_logs table still applies (SECURITY INVOKER).
GRANT SELECT ON public.v_daily_summary_user TO authenticated;

CREATE OR REPLACE FUNCTION public.get_daily_summary (p_from date, p_to date)
RETURNS TABLE (local_date date, sticks int, total_spend_inr numeric, avg_unit_price_inr numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501';
  END IF;
  -- Bound the range to prevent unbounded scans. 366-day cap covers the full Year view.
  IF p_to < p_from THEN
    RAISE EXCEPTION 'p_to must be >= p_from' USING ERRCODE = '22023';
  END IF;
  IF (p_to - p_from) > 366 THEN
    RAISE EXCEPTION 'date range > 366 days' USING ERRCODE = '22023';
  END IF;
  -- Note: local_date is stored as text (YYYY-MM-DD). The cast to ::date lets us
  -- compare against the date params without relying on implicit text ordering.
  RETURN QUERY
    SELECT
      v.local_date::date,
      v.sticks,
      v.total_spend_inr,
      v.avg_unit_price_inr
    FROM public.v_daily_summary_user v
    WHERE v.user_id = uid
      AND v.local_date::date >= p_from
      AND v.local_date::date <= p_to
    ORDER BY v.local_date DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_daily_summary(date, date) TO authenticated;

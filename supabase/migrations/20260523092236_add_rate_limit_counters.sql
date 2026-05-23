-- Generic Postgres-backed rate limiter for Edge Functions.
--
-- Replaces the Deno KV backing in supabase/functions/_shared/rateLimit.ts.
-- Deno.openKv() is unsupported on Supabase's hosted Edge Runtime, so the helper
-- fail-closed and 429'd every audit-record / delete-account call. This mirrors
-- the atomic SECURITY DEFINER style of create_log_with_rate_limit
-- (20260520000000_security_correctness.sql).

CREATE TABLE IF NOT EXISTS public.rate_limit_counters (
  kind          text        NOT NULL,
  identity      text        NOT NULL,
  window_start  timestamptz NOT NULL DEFAULT now(),
  count         int         NOT NULL DEFAULT 0,
  PRIMARY KEY (kind, identity)
);

-- Only reachable via the SECURITY DEFINER RPC (table owner) / service_role.
ALTER TABLE public.rate_limit_counters ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.rate_limit_counters FROM anon, authenticated;

-- Atomic check-and-increment. Returns TRUE when the call is within budget.
CREATE OR REPLACE FUNCTION public.consume_rate_limit (
  p_kind        text,
  p_key         text,
  p_max         int,
  p_window_sec  int
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_now    timestamptz := now();
  v_count  int;
BEGIN
  IF p_kind IS NULL OR p_key IS NULL OR p_max IS NULL OR p_window_sec IS NULL THEN
    RAISE EXCEPTION 'consume_rate_limit: arguments must be non-null';
  END IF;

  -- Upsert under the row lock taken by ON CONFLICT DO UPDATE. If the window has
  -- elapsed, reset to 1; otherwise increment. Single statement => atomic and
  -- TOCTOU-safe under concurrency.
  INSERT INTO public.rate_limit_counters AS rl (kind, identity, window_start, count)
  VALUES (p_kind, p_key, v_now, 1)
  ON CONFLICT (kind, identity) DO UPDATE
    SET
      count = CASE
        WHEN rl.window_start + make_interval(secs => p_window_sec) <= v_now THEN 1
        ELSE rl.count + 1
      END,
      window_start = CASE
        WHEN rl.window_start + make_interval(secs => p_window_sec) <= v_now THEN v_now
        ELSE rl.window_start
      END
  RETURNING rl.count INTO v_count;

  RETURN v_count <= p_max;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_rate_limit(text, text, int, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.consume_rate_limit(text, text, int, int) TO service_role;

NOTIFY pgrst, 'reload schema';

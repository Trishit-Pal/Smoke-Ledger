-- Smoke Ledger 0.2.0 enhancements: smoking facts catalog, health milestones,
-- per-user fact-seen state, mood/trigger heatmap view, supporting RPCs.
-- Additive only. Safe to run on top of 20250426120000_initial_schema.sql.

-- ---------------------------------------------------------------------------
-- 1. Server-only catalogs (no client RLS exposure; READ via RPCs)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS smoke_seed.smoking_facts (
  id text PRIMARY KEY,
  category text NOT NULL CHECK (category IN ('health', 'india', 'finance', 'recovery', 'environment', 'youth')),
  headline text NOT NULL,
  body text NOT NULL,
  source text NOT NULL,
  source_url text,
  weight int NOT NULL DEFAULT 1
);

REVOKE ALL ON smoke_seed.smoking_facts FROM PUBLIC;

INSERT INTO smoke_seed.smoking_facts (id, category, headline, body, source, source_url, weight) VALUES
  ('fact_who_8m', 'health',
    'Tobacco kills more than 8 million people each year worldwide',
    'Of those, around 1.3 million are non-smokers exposed to second-hand smoke. Tobacco is the single biggest avoidable cause of death globally.',
    'WHO, 2024', 'https://www.who.int/news-room/fact-sheets/detail/tobacco', 3),
  ('fact_gats_india', 'india',
    '267 million Indian adults use tobacco in some form',
    'GATS-2 (Global Adult Tobacco Survey, India) found 28.6% of adults aged 15+ use tobacco. Cigarette smokers number around 37 million.',
    'GATS-2 India, 2017', 'https://main.mohfw.gov.in/sites/default/files/GATS-2-India.pdf', 3),
  ('fact_india_mortality', 'india',
    'Tobacco causes ~1.35 million deaths in India every year',
    'That is roughly 3,700 Indians every day — more than the road-accident toll.',
    'ICMR / Tata Memorial Centre', NULL, 2),
  ('fact_cost_pack_india', 'finance',
    'A 20/day Marlboro habit costs around ₹1.4 lakh per year in India',
    'At ₹19 per stick × 20 × 365 = ₹138,700/year. A modest SIP of the same amount over 10 years at 12% returns would grow to ~₹26 lakh.',
    'Calculation, 2026 retail prices', NULL, 2),
  ('fact_recovery_20min', 'recovery',
    '20 minutes after your last cigarette, heart rate and blood pressure drop',
    'The body starts repairing almost immediately. By 12 hours, blood carbon-monoxide levels return to normal.',
    'CDC', 'https://www.cdc.gov/tobacco/quit_smoking/how_to_quit/benefits/index.htm', 2),
  ('fact_recovery_1y', 'recovery',
    'One year smoke-free halves your excess risk of coronary heart disease',
    'Your risk of heart attack drops sharply. By 5 years, stroke risk approaches that of a non-smoker.',
    'NHS UK', 'https://www.nhs.uk/live-well/quit-smoking/what-happens-when-you-quit-smoking/', 2),
  ('fact_recovery_10y', 'recovery',
    'After 10 smoke-free years, lung cancer death risk falls by about half',
    'Risks of cancer of the mouth, throat, oesophagus, bladder and pancreas also drop.',
    'CDC', 'https://www.cdc.gov/tobacco/quit_smoking/how_to_quit/benefits/index.htm', 2),
  ('fact_passive_smoke', 'health',
    'There is no safe level of second-hand smoke',
    'Even brief exposure can cause immediate harm. Children exposed at home have higher rates of asthma, ear infections and SIDS.',
    'US Surgeon General, 2006', NULL, 2),
  ('fact_butt_litter', 'environment',
    'Cigarette butts are the #1 most-littered item on Earth',
    'About 4.5 trillion are discarded each year. Filters are made of cellulose acetate — a plastic that takes a decade or more to break down.',
    'NOAA / Ocean Conservancy', NULL, 1),
  ('fact_butt_toxic', 'environment',
    'A single cigarette butt can pollute up to 1,000 litres of water',
    'Filters leach nicotine, arsenic, lead and PAHs into soil and waterways.',
    'San Diego State University study, 2011', NULL, 1),
  ('fact_youth_addict', 'youth',
    'About 9 in 10 adult smokers started before age 18',
    'Nicotine reaches peak addictiveness on a developing brain. Most adult smokers report wanting to quit.',
    'CDC Youth Tobacco Survey', NULL, 1),
  ('fact_quit_attempts', 'recovery',
    'Most successful quitters needed 6–30+ attempts before stopping for good',
    'Each attempt builds skills. Slipping is part of the process — not failure.',
    'Addiction journal meta-analysis, 2016', NULL, 2),
  ('fact_smell_taste', 'recovery',
    'Within 48 hours of quitting, taste and smell start coming back',
    'Damaged nerve endings begin regrowing. Food tastes more vivid by the end of the first week.',
    'NHS UK', NULL, 2),
  ('fact_wallet_daily', 'finance',
    'Skipping just 5 cigarettes a day saves ~₹35,000 per year',
    'At ₹19 per premium stick, even small reductions compound into real money — and visibly so on the trends page.',
    'Calculation', NULL, 1),
  ('fact_lung_cilia', 'recovery',
    'Lung cilia regrow within 1–9 months of quitting',
    'These tiny hair-like structures clear mucus and reduce infection risk. Coughing often increases briefly as they recover.',
    'American Lung Association', NULL, 2),
  ('fact_skin_aging', 'health',
    'Smoking accelerates skin aging — wrinkles, dullness, slower wound healing',
    'Nicotine constricts blood vessels, reducing oxygen and nutrients to skin. Effects show within years.',
    'American Academy of Dermatology', NULL, 1),
  ('fact_global_decline', 'health',
    'Global adult smoking prevalence has fallen from 32% in 2000 to ~20% in 2025',
    'Most of the decline came from quitlines, taxation and graphic warning labels — not willpower alone.',
    'WHO Global Tobacco Report, 2024', NULL, 1),
  ('fact_sleep_quality', 'health',
    'Smokers are 4× more likely to feel unrested after a full night''s sleep',
    'Nicotine is a stimulant; nighttime withdrawal causes micro-awakenings. Sleep typically improves within weeks of quitting.',
    'Johns Hopkins University study', NULL, 1),
  ('fact_diabetes_link', 'health',
    'Smokers are 30–40% more likely to develop type-2 diabetes',
    'The risk rises with the number of cigarettes per day and falls after quitting.',
    'CDC', NULL, 1),
  ('fact_rs_lakh_savings', 'finance',
    '10 sticks/day at ₹15 each = ₹54,750 saved annually if you quit',
    'Over 20 years, invested at 10% annual return, that becomes ~₹31 lakh — real generational money.',
    'Calculation', NULL, 1)
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 2. Health-recovery milestone catalog
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS smoke_seed.health_milestones (
  minutes int PRIMARY KEY,
  title text NOT NULL,
  body text NOT NULL,
  source text NOT NULL
);

REVOKE ALL ON smoke_seed.health_milestones FROM PUBLIC;

INSERT INTO smoke_seed.health_milestones (minutes, title, body, source) VALUES
  (20,        '20 minutes',    'Heart rate and blood pressure drop toward normal.',                                      'CDC'),
  (480,       '8 hours',       'Carbon-monoxide level in blood halves; oxygen returns to normal.',                       'NHS'),
  (1440,      '24 hours',      'Excess risk of heart attack begins to fall.',                                            'CDC'),
  (2880,      '48 hours',      'Nerve endings start regrowing — taste and smell sharpen.',                               'NHS'),
  (4320,      '72 hours',      'Bronchial tubes relax; breathing feels easier; energy rises.',                           'American Lung Association'),
  (20160,     '2 weeks',       'Circulation improves; lung function climbs.',                                            'CDC'),
  (43200,     '1 month',       'Cilia in the lungs start regrowing; coughs and shortness of breath ease.',               'American Lung Association'),
  (129600,    '3 months',      'Lung function up by ~30%; exercise feels noticeably easier.',                            'NHS'),
  (525600,    '1 year',        'Excess risk of coronary heart disease is half that of a smoker.',                        'CDC'),
  (2628000,   '5 years',       'Stroke risk approaches that of a non-smoker; mouth/throat cancer risk halves.',          'CDC'),
  (5256000,   '10 years',      'Risk of dying from lung cancer is about half that of a continuing smoker.',              'CDC'),
  (7884000,   '15 years',      'Risk of coronary heart disease is now that of a non-smoker.',                            'CDC')
ON CONFLICT (minutes) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 3. Per-user fact engagement (RLS-enforced)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.user_facts_seen (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  fact_id text NOT NULL,
  seen_at timestamptz NOT NULL DEFAULT now(),
  liked boolean,
  PRIMARY KEY (user_id, fact_id)
);

CREATE INDEX IF NOT EXISTS idx_user_facts_seen_user ON public.user_facts_seen (user_id, seen_at DESC);

ALTER TABLE public.user_facts_seen ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_facts_seen_all ON public.user_facts_seen;
CREATE POLICY user_facts_seen_all ON public.user_facts_seen FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 4. Mood × trigger heatmap view (RLS inherited from cigarette_logs)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE VIEW public.v_mood_trigger_heatmap
WITH (security_invoker = true) AS
SELECT
  user_id,
  mood_before,
  trigger_tag,
  count(*)::int                               AS n,
  round(avg(unit_price_inr)::numeric, 2)      AS avg_unit_price,
  max(ts_utc)                                 AS last_seen
FROM public.cigarette_logs
WHERE mood_before IS NOT NULL
  AND trigger_tag IS NOT NULL
GROUP BY user_id, mood_before, trigger_tag;

GRANT SELECT ON public.v_mood_trigger_heatmap TO authenticated;

-- ---------------------------------------------------------------------------
-- 5. Supporting index for "last cigarette" / streak queries
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_logs_user_ts ON public.cigarette_logs (user_id, ts_utc DESC);

-- ---------------------------------------------------------------------------
-- 6. RPCs
-- ---------------------------------------------------------------------------

-- Returns a weighted-random selection of facts, deprioritizing facts the
-- caller has already marked as seen in the last 14 days.
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
SET search_path = public, smoke_seed
AS $$
DECLARE
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  RETURN QUERY
  SELECT f.id, f.category, f.headline, f.body, f.source, f.source_url
  FROM smoke_seed.smoking_facts f
  LEFT JOIN public.user_facts_seen s
    ON s.user_id = uid
    AND s.fact_id = f.id
    AND s.seen_at > now() - interval '14 days'
  ORDER BY (CASE WHEN s.fact_id IS NULL THEN 1.0 ELSE 0.2 END)
           * f.weight
           * random() DESC
  LIMIT GREATEST(1, LEAST(p_limit, 25));
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_random_facts(int) TO authenticated;

-- Returns the full milestone catalog (small, cacheable client-side).
CREATE OR REPLACE FUNCTION public.get_health_milestones ()
RETURNS TABLE (minutes int, title text, body text, source text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = smoke_seed
AS $$
  SELECT minutes, title, body, source FROM smoke_seed.health_milestones ORDER BY minutes ASC;
$$;

GRANT EXECUTE ON FUNCTION public.get_health_milestones() TO authenticated;

-- Records that the current user saw / liked a fact.
CREATE OR REPLACE FUNCTION public.mark_fact_seen (p_fact_id text, p_liked boolean DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  INSERT INTO public.user_facts_seen (user_id, fact_id, seen_at, liked)
  VALUES (uid, p_fact_id, now(), p_liked)
  ON CONFLICT (user_id, fact_id)
  DO UPDATE SET seen_at = now(), liked = COALESCE(EXCLUDED.liked, public.user_facts_seen.liked);
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_fact_seen(text, boolean) TO authenticated;

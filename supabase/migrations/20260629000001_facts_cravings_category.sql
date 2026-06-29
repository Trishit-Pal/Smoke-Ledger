-- Add 'cravings' category to the CHECK constraint and seed 4 craving-mechanism facts.
-- main's 20260628120000 migration seeded 4 quitting-process facts under 'recovery';
-- this adds the distinct 'cravings' category and 4 different craving-mechanism facts.

ALTER TABLE smoke_seed.smoking_facts DROP CONSTRAINT IF EXISTS smoking_facts_category_check;
ALTER TABLE smoke_seed.smoking_facts ADD CONSTRAINT smoking_facts_category_check
  CHECK (category IN ('health', 'india', 'finance', 'recovery', 'environment', 'youth', 'cravings'));

INSERT INTO smoke_seed.smoking_facts (id, category, headline, body, source, source_url, weight) VALUES
  ('fact_craving_duration', 'cravings',
    'A craving typically peaks and passes in 3–5 minutes',
    'Urges feel permanent but are not. Riding out the wave — walking, breathing, drinking water — is usually enough. Each one you outlast weakens the next.',
    'NHS UK / Allen Carr Foundation', NULL, 3),
  ('fact_nicotine_speed', 'cravings',
    'Nicotine reaches the brain in 10 seconds',
    'That speed is why the loop is so hard to break — relief is nearly instant. Understanding the mechanism takes some of its power away.',
    'NIDA (National Institute on Drug Abuse)', NULL, 2),
  ('fact_brain_reset', 'cravings',
    'The brain''s dopamine system takes 4–12 weeks to rebalance after quitting',
    'Cravings are strongest in the first two weeks, then fade as receptors down-regulate. The hardest stretch is also the shortest before the curve turns.',
    'Neuropsychopharmacology, 2014', NULL, 2),
  ('fact_stress_trigger', 'cravings',
    'Stress is the most common trigger for relapse',
    'Nicotine temporarily suppresses cortisol — so lighting up ''works'' in the short term. Quitters who build a substitute stress outlet halve their relapse risk.',
    'Journal of Abnormal Psychology, 2012', NULL, 2)
ON CONFLICT (id) DO NOTHING;

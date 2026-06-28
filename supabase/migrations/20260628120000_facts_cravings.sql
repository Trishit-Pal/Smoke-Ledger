-- Adds the "why it's hard / cravings" facts to the smoking_facts catalog.
-- Honest, non-endorsing framing (how quitting and cravings actually work),
-- filed under the existing 'recovery' category so the CHECK constraint is
-- unchanged. Additive + idempotent. Mirrors the bundled fallback in
-- src/constants/facts.ts so offline and online show the same set.

INSERT INTO smoke_seed.smoking_facts (id, category, headline, body, source, source_url, weight) VALUES
  ('fact_craving_window', 'recovery',
    'A craving peaks fast and passes in 3–5 minutes',
    'Nicotine reaches the brain in about 10 seconds, which is why urges feel so urgent. But a single craving typically crests and fades within a few minutes whether or not you smoke — riding one out is the whole skill.',
    'NHS UK', 'https://www.nhs.uk/live-well/quit-smoking/', 2),
  ('fact_withdrawal_curve', 'recovery',
    'Withdrawal is worst on days 2–3, then steadily eases',
    'Physical nicotine withdrawal usually peaks around 48–72 hours after the last cigarette and largely settles within two to four weeks. Knowing the curve makes the hard days easier to place.',
    'American Cancer Society', NULL, 2),
  ('fact_trigger_unlearn', 'recovery',
    'Trigger-linked urges weaken the more you don’t act on them',
    'A craving tied to a coffee, a break or a commute fades each time the cue isn’t followed by a cigarette. The association unlearns with repetition — not willpower alone.',
    'National Cancer Institute (smokefree.gov)', 'https://smokefree.gov/', 1),
  ('fact_support_doubles', 'recovery',
    'A plan plus support roughly doubles your odds of quitting',
    'Combining intent with a method — a quitline, behavioural support, or nicotine-replacement therapy — consistently outperforms going it alone. Wanting to stop is the start; a method carries it.',
    'NHS UK / Cochrane reviews', 'https://www.nhs.uk/live-well/quit-smoking/', 1)
ON CONFLICT (id) DO NOTHING;

// Curated, citation-backed smoking facts. Mirrors smoke_seed.smoking_facts
// (see supabase/migrations/20260504000000_enhancements.sql). Bundled so the
// FactsCarousel works offline / before the migration runs.

export type FactCategory =
  | 'health'
  | 'india'
  | 'finance'
  | 'recovery'
  | 'environment'
  | 'youth';

export interface SmokingFact {
  id: string;
  category: FactCategory;
  headline: string;
  body: string;
  source: string;
  sourceUrl?: string;
  weight?: number;
}

export const SMOKING_FACTS: readonly SmokingFact[] = [
  {
    id: 'fact_who_8m', category: 'health',
    headline: 'Tobacco kills more than 8 million people each year worldwide',
    body: 'Of those, around 1.3 million are non-smokers exposed to second-hand smoke. Tobacco is the single biggest avoidable cause of death globally.',
    source: 'WHO, 2024', sourceUrl: 'https://www.who.int/news-room/fact-sheets/detail/tobacco', weight: 3,
  },
  {
    id: 'fact_gats_india', category: 'india',
    headline: '267 million Indian adults use tobacco in some form',
    body: 'GATS-2 (Global Adult Tobacco Survey, India) found 28.6% of adults aged 15+ use tobacco. Cigarette smokers number around 37 million.',
    source: 'GATS-2 India, 2017', sourceUrl: 'https://main.mohfw.gov.in/sites/default/files/GATS-2-India.pdf', weight: 3,
  },
  {
    id: 'fact_india_mortality', category: 'india',
    headline: 'Tobacco causes ~1.35 million deaths in India every year',
    body: 'That is roughly 3,700 Indians every day — more than the road-accident toll.',
    source: 'ICMR / Tata Memorial Centre', weight: 2,
  },
  {
    id: 'fact_cost_pack_india', category: 'finance',
    headline: 'A 20/day premium habit costs ~₹1.4 lakh per year in India',
    body: 'At ₹19 per stick × 20 × 365 = ₹138,700/year. The same money in a 12% SIP over 10 years grows to ~₹26 lakh.',
    source: 'Calculation, 2026 retail prices', weight: 2,
  },
  {
    id: 'fact_recovery_20min', category: 'recovery',
    headline: '20 minutes after your last cigarette, heart rate and BP drop',
    body: 'The body starts repairing almost immediately. By 12 hours, blood carbon-monoxide levels return to normal.',
    source: 'CDC', sourceUrl: 'https://www.cdc.gov/tobacco/quit_smoking/how_to_quit/benefits/index.htm', weight: 2,
  },
  {
    id: 'fact_recovery_1y', category: 'recovery',
    headline: 'One smoke-free year halves your excess risk of heart disease',
    body: 'Heart-attack risk drops sharply. By 5 years, stroke risk approaches that of a non-smoker.',
    source: 'NHS UK', sourceUrl: 'https://www.nhs.uk/live-well/quit-smoking/what-happens-when-you-quit-smoking/', weight: 2,
  },
  {
    id: 'fact_recovery_10y', category: 'recovery',
    headline: 'After 10 smoke-free years, lung-cancer death risk falls by ~half',
    body: 'Risks of mouth, throat, oesophagus, bladder and pancreatic cancer also drop.',
    source: 'CDC', weight: 2,
  },
  {
    id: 'fact_passive_smoke', category: 'health',
    headline: 'There is no safe level of second-hand smoke',
    body: 'Even brief exposure causes harm. Children exposed at home have higher rates of asthma, ear infections and SIDS.',
    source: 'US Surgeon General, 2006', weight: 2,
  },
  {
    id: 'fact_butt_litter', category: 'environment',
    headline: 'Cigarette butts are the #1 most-littered item on Earth',
    body: 'About 4.5 trillion are discarded each year. Filters are cellulose-acetate plastic that takes a decade to break down.',
    source: 'NOAA / Ocean Conservancy', weight: 1,
  },
  {
    id: 'fact_butt_toxic', category: 'environment',
    headline: 'A single butt can pollute up to 1,000 litres of water',
    body: 'Filters leach nicotine, arsenic, lead and PAHs into soil and waterways.',
    source: 'San Diego State University, 2011', weight: 1,
  },
  {
    id: 'fact_youth_addict', category: 'youth',
    headline: '~9 in 10 adult smokers started before age 18',
    body: 'Nicotine reaches peak addictiveness on a developing brain. Most adult smokers report wanting to quit.',
    source: 'CDC Youth Tobacco Survey', weight: 1,
  },
  {
    id: 'fact_quit_attempts', category: 'recovery',
    headline: 'Most successful quitters needed 6–30+ attempts before stopping',
    body: 'Each attempt builds skills. Slipping is part of the process — not failure.',
    source: 'Addiction journal meta-analysis, 2016', weight: 2,
  },
  {
    id: 'fact_smell_taste', category: 'recovery',
    headline: 'Within 48 hours, taste and smell start coming back',
    body: 'Damaged nerve endings begin regrowing. Food tastes vivid again by the end of the first week.',
    source: 'NHS UK', weight: 2,
  },
  {
    id: 'fact_wallet_daily', category: 'finance',
    headline: 'Skipping just 5 cigarettes a day saves ~₹35,000 per year',
    body: 'At ₹19 per premium stick, even small reductions compound — visibly, on the trends page.',
    source: 'Calculation', weight: 1,
  },
  {
    id: 'fact_lung_cilia', category: 'recovery',
    headline: 'Lung cilia regrow within 1–9 months of quitting',
    body: 'These tiny hairs clear mucus and reduce infection risk. Coughing often increases briefly as they recover.',
    source: 'American Lung Association', weight: 2,
  },
  {
    id: 'fact_skin_aging', category: 'health',
    headline: 'Smoking accelerates wrinkles and slows wound healing',
    body: 'Nicotine constricts blood vessels, reducing oxygen and nutrients to skin. Effects show within years.',
    source: 'American Academy of Dermatology', weight: 1,
  },
  {
    id: 'fact_global_decline', category: 'health',
    headline: 'Global adult smoking has fallen from 32% (2000) to ~20% (2025)',
    body: 'Most of the decline came from quitlines, taxation and graphic warning labels — not willpower alone.',
    source: 'WHO Global Tobacco Report, 2024', weight: 1,
  },
  {
    id: 'fact_sleep_quality', category: 'health',
    headline: 'Smokers are 4× more likely to feel unrested after a full night',
    body: 'Nicotine is a stimulant; nighttime withdrawal causes micro-awakenings. Sleep typically improves within weeks of quitting.',
    source: 'Johns Hopkins University study', weight: 1,
  },
  {
    id: 'fact_diabetes_link', category: 'health',
    headline: 'Smokers are 30–40% more likely to develop type-2 diabetes',
    body: 'Risk rises with cigarettes per day and falls after quitting.',
    source: 'CDC', weight: 1,
  },
  {
    id: 'fact_rs_lakh_savings', category: 'finance',
    headline: '10 sticks/day at ₹15 = ₹54,750 saved per year if you quit',
    body: 'Over 20 years invested at 10% annual return, that grows to ~₹31 lakh — real generational money.',
    source: 'Calculation', weight: 1,
  },
] as const;

export function pickRandomFacts(n: number, seenIds: ReadonlySet<string> = new Set()): SmokingFact[] {
  const weighted = SMOKING_FACTS.map((f) => ({
    f,
    score: (seenIds.has(f.id) ? 0.2 : 1.0) * (f.weight ?? 1) * Math.random(),
  }));
  weighted.sort((a, b) => b.score - a.score);
  return weighted.slice(0, Math.max(1, Math.min(n, SMOKING_FACTS.length))).map((w) => w.f);
}

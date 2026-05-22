// Bundled health-recovery milestones, mirrored from `smoke_seed.health_milestones`
// in supabase/migrations/20260504000000_enhancements.sql. Keeps the milestones
// panel useful before the migration is applied / on cold start.
//
// Sourcing (LOW-tier audit): bodies below are general health information drawn
// from three public-health institutions (CDC, NHS, American Lung Association).
// Each entry carries an institutional attribution; the URL field is initialized
// to `null` and is intentionally left for a separate legal/clinical review pass
// to populate with the exact canonical page that backs each claim. Citing a
// specific URL without that review risks linking to a page whose content has
// drifted from the claim in this file. The UI surfaces the institutional name
// today and will surface a link once URLs are populated.
//
// The HealthMilestones component additionally renders a "general health
// information, not medical advice" disclaimer — that is the load-bearing
// liability-mitigation, not the URLs.

export interface HealthMilestone {
  minutes: number;
  title: string;
  body: string;
  /** Public-health institution attributed for the claim. */
  source: 'CDC' | 'NHS' | 'American Lung Association';
  /**
   * Canonical URL backing the claim. Currently `null` — populate during the
   * pre-launch legal/clinical review by linking to the specific institutional
   * page (not the org's homepage). Renders as a link in the UI when present.
   */
  sourceUrl: string | null;
}

export const HEALTH_MILESTONES: readonly HealthMilestone[] = [
  { minutes: 20, title: '20 minutes', body: 'Heart rate and blood pressure drop toward normal.', source: 'CDC', sourceUrl: null },
  { minutes: 480, title: '8 hours', body: 'Carbon-monoxide level in blood halves; oxygen returns to normal.', source: 'NHS', sourceUrl: null },
  { minutes: 1440, title: '24 hours', body: 'Excess risk of heart attack begins to fall.', source: 'CDC', sourceUrl: null },
  { minutes: 2880, title: '48 hours', body: 'Nerve endings start regrowing — taste and smell sharpen.', source: 'NHS', sourceUrl: null },
  { minutes: 4320, title: '72 hours', body: 'Bronchial tubes relax; breathing feels easier; energy rises.', source: 'American Lung Association', sourceUrl: null },
  { minutes: 20160, title: '2 weeks', body: 'Circulation improves; lung function climbs.', source: 'CDC', sourceUrl: null },
  { minutes: 43200, title: '1 month', body: 'Cilia in the lungs start regrowing; coughs and shortness of breath ease.', source: 'American Lung Association', sourceUrl: null },
  { minutes: 129600, title: '3 months', body: 'Lung function up by ~30%; exercise feels noticeably easier.', source: 'NHS', sourceUrl: null },
  { minutes: 525600, title: '1 year', body: 'Excess risk of coronary heart disease is half that of a smoker.', source: 'CDC', sourceUrl: null },
  { minutes: 2628000, title: '5 years', body: 'Stroke risk approaches that of a non-smoker; mouth/throat cancer risk halves.', source: 'CDC', sourceUrl: null },
  { minutes: 5256000, title: '10 years', body: 'Risk of dying from lung cancer is about half that of a continuing smoker.', source: 'CDC', sourceUrl: null },
  { minutes: 7884000, title: '15 years', body: 'Risk of coronary heart disease is now that of a non-smoker.', source: 'CDC', sourceUrl: null },
] as const;

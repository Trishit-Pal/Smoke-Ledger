// Bundled health-recovery milestones, mirrored from `smoke_seed.health_milestones`
// in supabase/migrations/20260504000000_enhancements.sql. Keeps the milestones
// panel useful before the migration is applied / on cold start.
// Sources: CDC, NHS, American Lung Association.

export interface HealthMilestone {
  minutes: number;
  title: string;
  body: string;
  source: string;
}

export const HEALTH_MILESTONES: readonly HealthMilestone[] = [
  { minutes: 20, title: '20 minutes', body: 'Heart rate and blood pressure drop toward normal.', source: 'CDC' },
  { minutes: 480, title: '8 hours', body: 'Carbon-monoxide level in blood halves; oxygen returns to normal.', source: 'NHS' },
  { minutes: 1440, title: '24 hours', body: 'Excess risk of heart attack begins to fall.', source: 'CDC' },
  { minutes: 2880, title: '48 hours', body: 'Nerve endings start regrowing — taste and smell sharpen.', source: 'NHS' },
  { minutes: 4320, title: '72 hours', body: 'Bronchial tubes relax; breathing feels easier; energy rises.', source: 'American Lung Association' },
  { minutes: 20160, title: '2 weeks', body: 'Circulation improves; lung function climbs.', source: 'CDC' },
  { minutes: 43200, title: '1 month', body: 'Cilia in the lungs start regrowing; coughs and shortness of breath ease.', source: 'American Lung Association' },
  { minutes: 129600, title: '3 months', body: 'Lung function up by ~30%; exercise feels noticeably easier.', source: 'NHS' },
  { minutes: 525600, title: '1 year', body: 'Excess risk of coronary heart disease is half that of a smoker.', source: 'CDC' },
  { minutes: 2628000, title: '5 years', body: 'Stroke risk approaches that of a non-smoker; mouth/throat cancer risk halves.', source: 'CDC' },
  { minutes: 5256000, title: '10 years', body: 'Risk of dying from lung cancer is about half that of a continuing smoker.', source: 'CDC' },
  { minutes: 7884000, title: '15 years', body: 'Risk of coronary heart disease is now that of a non-smoker.', source: 'CDC' },
] as const;

/**
 * The DB trigger keep_onboarding_step_monotonic() ranks steps with
 * onboarding_step_rank(); the app gates on ONBOARDING_STEP_INDEX. If they
 * disagree, the trigger either lets a step move backwards or pins a user behind
 * a page the middleware says they have passed. SQL deliberately shares ranks
 * (usage/setup/baseline = 1), so compare rank-for-rank, not just ordering.
 */
import { ONBOARDING_STEP_INDEX } from '@/lib/onboardingSteps';
import { newestFunction } from './helpers/newestMigrationFunction';

function sqlRanks(): Record<string, number> {
  const { body } = newestFunction('onboarding_step_rank');
  const ranks: Record<string, number> = {};
  for (const m of body.matchAll(/WHEN\s+'([a-z_]+)'\s+THEN\s+(\d+)/g)) ranks[m[1]] = Number(m[2]);
  return ranks;
}

describe('onboarding_step_rank() matches ONBOARDING_STEP_INDEX', () => {
  it('parses a non-empty rank table from the newest migration', () => {
    expect(Object.keys(sqlRanks()).length).toBeGreaterThan(0);
  });

  it('ranks every step the app knows, and only those, identically', () => {
    expect(sqlRanks()).toEqual(ONBOARDING_STEP_INDEX);
  });
});

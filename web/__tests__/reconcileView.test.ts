import { describe, expect, it } from 'vitest';
import { planGoalTransitions } from '@/domain/goalTransitions';
import type { Goal } from '@/types';
import { reconcileKey, renderedGoals } from '../lib/goals/reconcileView';

const TODAY = '2026-11-02';
const mkGoal = (o: Partial<Goal> = {}): Goal => ({
  id: 'g1',
  type: 'quit_date',
  targetValue: 0,
  currentBaseline: null,
  startDate: '2026-09-01',
  endDate: '2026-11-01',
  status: 'active',
  meta: null,
  createdAt: '2026-09-01T00:00:00.000Z',
  completedAt: null,
  ...o,
});

describe('reconcileKey', () => {
  it('changes with ids and statuses but not with order-insensitive noise', () => {
    const a = mkGoal({ id: 'a' });
    const b = mkGoal({ id: 'b' });
    expect(reconcileKey([a, b])).toBe(reconcileKey([b, a]));
    expect(reconcileKey([a])).not.toBe(reconcileKey([a, b]));
    expect(reconcileKey([a])).not.toBe(reconcileKey([{ ...a, status: 'completed' }]));
  });
  it('ignores fields that do not move a goal between states', () => {
    const a = mkGoal();
    expect(reconcileKey([a])).toBe(reconcileKey([{ ...a, targetValue: 9 }]));
  });
});


describe('renderedGoals', () => {
  const NOW = '2026-11-02T08:00:00.000Z';

  it('renders a due auto-complete as completed', () => {
    const goals = [mkGoal()];
    const planned = planGoalTransitions(goals, [], TODAY);
    expect(planned).toHaveLength(1);
    expect(renderedGoals(goals, planned, new Set(), NOW)[0]).toMatchObject({ status: 'completed', completedAt: NOW });
  });

  it('does not render a failed transition as applied', () => {
    const goals = [mkGoal(), mkGoal({ id: 'g2', type: 'taper', endDate: null })];
    const planned = planGoalTransitions(goals, [], TODAY);
    const out = renderedGoals(goals, planned, new Set(['g1']), NOW);
    expect(out[0]).toBe(goals[0]);
    expect(out[0].status).toBe('active');
  });
});

import type { CigaretteLog, Goal } from '@/types';
import { dayShift } from '@/domain/calc';
import { applyGoalTransitions, planGoalTransitions } from '@/domain/goalTransitions';

const TODAY = '2025-05-31';

const mkGoal = (overrides: Partial<Goal> = {}): Goal => ({
  id: 'g1',
  type: 'daily_cap',
  targetValue: 5,
  currentBaseline: null,
  startDate: '2025-01-01',
  endDate: null,
  status: 'active',
  meta: null,
  createdAt: '2025-01-01T00:00:00.000Z',
  completedAt: null,
  ...overrides,
});

const mkLog = (date: string, quantity: number): CigaretteLog => ({
  id: `l-${date}`,
  tsUtc: `${date}T12:00:00.000Z`,
  localDate: date,
  localHour: 12,
  brandId: null,
  brandNameSnap: null,
  variantSnap: null,
  quantity,
  purchaseMode: 'single',
  packSize: null,
  totalPriceInr: null,
  unitPriceInr: null,
  priceSource: 'unknown',
  triggerTag: null,
  moodBefore: null,
  moodAfter: null,
  craving: null,
  contextTag: null,
  notes: null,
  createdAt: '',
  updatedAt: '',
});

/** One log per day for `count` days ending yesterday. */
const run = (count: number, qty = 3): CigaretteLog[] =>
  Array.from({ length: count }, (_, i) => mkLog(dayShift(TODAY, -(1 + i)), qty));

describe('planGoalTransitions', () => {
  it('completes a quit-date goal on its date, not the day before', () => {
    const goal = mkGoal({ type: 'quit_date', targetValue: 0, endDate: TODAY });
    expect(planGoalTransitions([goal], [], TODAY)).toEqual([
      { goalId: 'g1', kind: 'auto_complete', reason: 'quit_date' },
    ]);
    expect(planGoalTransitions([goal], [], dayShift(TODAY, -1))).toEqual([]);
  });

  it('marks a held daily cap as met, stamping today into meta', () => {
    const goal = mkGoal({ meta: { startHour: 8 } });
    expect(planGoalTransitions([goal], run(14), TODAY)).toEqual([
      { goalId: 'g1', kind: 'mark_met', meta: { startHour: 8, metOn: TODAY } },
    ]);
  });

  it('does nothing for a daily cap with only 9 logged days in the run', () => {
    // 14 within-cap days, but only 9 of them have a log.
    const logs = run(14).filter((_, i) => i % 14 < 9);
    expect(planGoalTransitions([mkGoal()], logs, TODAY)).toEqual([]);
  });

  it('completes a held taper that has reached its final target', () => {
    const goal = mkGoal({ type: 'taper', targetValue: 2, meta: { finalTarget: 2 } });
    expect(planGoalTransitions([goal], run(14, 1), TODAY)).toEqual([
      { goalId: 'g1', kind: 'auto_complete', reason: 'taper_done' },
    ]);
  });

  it('marks a held taper still above its final target as met', () => {
    const goal = mkGoal({ type: 'taper', targetValue: 4, meta: { finalTarget: 2 } });
    expect(planGoalTransitions([goal], run(14, 1), TODAY)).toEqual([
      { goalId: 'g1', kind: 'mark_met', meta: { finalTarget: 2, metOn: TODAY } },
    ]);
  });

  it('treats a held taper with no final target like a daily cap', () => {
    const goal = mkGoal({ type: 'taper', targetValue: 2 });
    expect(planGoalTransitions([goal], run(14, 1), TODAY)).toEqual([
      { goalId: 'g1', kind: 'mark_met', meta: { metOn: TODAY } },
    ]);
  });

  it('is idempotent: nothing for a goal already met, paused or completed', () => {
    const logs = run(14);
    expect(planGoalTransitions([mkGoal({ meta: { metOn: '2025-05-30' } })], logs, TODAY)).toEqual([]);
    expect(planGoalTransitions([mkGoal({ status: 'paused' })], logs, TODAY)).toEqual([]);
    expect(planGoalTransitions([mkGoal({ status: 'completed' })], logs, TODAY)).toEqual([]);
    const quit = mkGoal({ type: 'quit_date', endDate: TODAY, status: 'completed' });
    expect(planGoalTransitions([quit], [], TODAY)).toEqual([]);
  });

  it('emits at most one transition per goal', () => {
    const goal = mkGoal({ type: 'taper', targetValue: 2, meta: { finalTarget: 2 } });
    expect(planGoalTransitions([goal], run(14, 1), TODAY)).toHaveLength(1);
  });
});

describe('plan -> apply -> plan', () => {
  it('is empty the second time for a mark_met goal and an auto_complete goal', () => {
    const goals = [
      mkGoal({ id: 'cap' }),
      mkGoal({ id: 'quit', type: 'quit_date', targetValue: 0, endDate: TODAY }),
    ];
    const logs = run(14);
    const first = planGoalTransitions(goals, logs, TODAY);
    expect(first.map((t) => t.kind).sort()).toEqual(['auto_complete', 'mark_met']);
    const applied = applyGoalTransitions(goals, first, '2025-05-31T10:00:00.000Z');
    expect(planGoalTransitions(applied, logs, TODAY)).toEqual([]);
  });
});

describe('applyGoalTransitions', () => {
  const NOW = '2025-05-31T10:00:00.000Z';

  it('completes and stamps completedAt without mutating the input', () => {
    const goal = mkGoal();
    const [out] = applyGoalTransitions(
      [goal],
      [{ goalId: 'g1', kind: 'auto_complete', reason: 'quit_date' }],
      NOW,
    );
    expect(out).toMatchObject({ status: 'completed', completedAt: NOW });
    expect(goal.status).toBe('active');
    expect(goal.completedAt).toBeNull();
  });

  it('replaces meta for mark_met and leaves other goals alone', () => {
    const a = mkGoal();
    const b = mkGoal({ id: 'g2' });
    const out = applyGoalTransitions(
      [a, b],
      [{ goalId: 'g1', kind: 'mark_met', meta: { metOn: TODAY } }],
      NOW,
    );
    expect(out[0].meta).toEqual({ metOn: TODAY });
    expect(out[1]).toBe(b);
    expect(a.meta).toBeNull();
  });
});

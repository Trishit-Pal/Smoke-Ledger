import type { CigaretteLog, Goal } from '@/types';
import { dayShift } from '@/domain/calc';
import type { GoalTransition } from '@/domain/goalTransitions';
import { completionMoment, reconcileGoals, type GoalWriter } from '@/services/goalReconcile';

const TODAY = '2025-05-31';
const NOW = '2025-05-31T10:00:00.000Z';

const mkGoal = (overrides: Partial<Goal> = {}): Goal => ({
  id: 'g1',
  type: 'quit_date',
  targetValue: 0,
  currentBaseline: null,
  startDate: '2025-01-01',
  endDate: TODAY,
  status: 'active',
  meta: null,
  createdAt: '2025-01-01T00:00:00.000Z',
  completedAt: null,
  ...overrides,
});

const mkLog = (date: string): CigaretteLog => ({
  id: `l-${date}`,
  tsUtc: `${date}T12:00:00.000Z`,
  localDate: date,
  localHour: 12,
  brandId: null,
  brandNameSnap: null,
  variantSnap: null,
  quantity: 3,
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

const mkWriter = (): jest.Mocked<GoalWriter> => ({
  setGoalStatus: jest.fn().mockResolvedValue(undefined),
  updateGoal: jest.fn().mockResolvedValue(undefined),
});

const heldCap = (id: string): Goal =>
  mkGoal({ id, type: 'daily_cap', targetValue: 5, endDate: null });
const heldLogs = Array.from({ length: 14 }, (_, i) => mkLog(dayShift(TODAY, -(1 + i))));

describe('reconcileGoals', () => {
  it('writes auto_complete via setGoalStatus and mark_met via updateGoal', async () => {
    const writer = mkWriter();
    const goals = [mkGoal({ id: 'q' }), heldCap('c')];
    const res = await reconcileGoals(goals, heldLogs, TODAY, writer, NOW);

    expect(writer.setGoalStatus).toHaveBeenCalledWith('q', 'completed');
    expect(writer.updateGoal).toHaveBeenCalledWith('c', { meta: { metOn: TODAY } });
    expect(res.applied).toHaveLength(2);
    expect(res.goals[0]).toMatchObject({ status: 'completed', completedAt: NOW });
    expect(res.goals[1].meta).toEqual({ metOn: TODAY });
  });

  it('skips a rejected write, still applies the next, and does not throw', async () => {
    const writer = mkWriter();
    writer.setGoalStatus.mockRejectedValueOnce(new Error('offline'));
    const goals = [mkGoal({ id: 'q' }), heldCap('c')];
    const res = await reconcileGoals(goals, heldLogs, TODAY, writer, NOW);

    expect(res.applied.map((t) => t.goalId)).toEqual(['c']);
    expect(res.goals[0].status).toBe('active');
    expect(res.goals[1].meta).toEqual({ metOn: TODAY });
  });

  it('makes zero writer calls when nothing is due', async () => {
    const writer = mkWriter();
    const goals = [mkGoal({ endDate: dayShift(TODAY, 3) })];
    const res = await reconcileGoals(goals, [], TODAY, writer, NOW);

    expect(writer.setGoalStatus).not.toHaveBeenCalled();
    expect(writer.updateGoal).not.toHaveBeenCalled();
    expect(res.applied).toEqual([]);
    expect(res.goals).toEqual(goals);
  });
});

describe('completionMoment', () => {
  it('has copy for quit_date and taper_done, none for mark_met', () => {
    const quit: GoalTransition = { goalId: 'g', kind: 'auto_complete', reason: 'quit_date' };
    const taper: GoalTransition = { goalId: 'g', kind: 'auto_complete', reason: 'taper_done' };
    const met: GoalTransition = { goalId: 'g', kind: 'mark_met', meta: {} };
    expect(completionMoment(quit)).toEqual({
      title: 'Quit day.',
      body: 'The date you set has arrived. The ledger marks it kept.',
    });
    expect(completionMoment(taper)).toEqual({
      title: 'Tapered.',
      body: 'Every step down was yours to accept. All of them, kept.',
    });
    expect(completionMoment(met)).toBeNull();
  });
});

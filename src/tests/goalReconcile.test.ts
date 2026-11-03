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
  completeIfActive: jest.fn().mockResolvedValue(true),
  markMet: jest.fn().mockResolvedValue(true),
});

const heldCap = (id: string): Goal =>
  mkGoal({ id, type: 'daily_cap', targetValue: 5, endDate: null });
const heldLogs = Array.from({ length: 14 }, (_, i) => mkLog(dayShift(TODAY, -(1 + i))));

describe('reconcileGoals', () => {
  it('completes via completeIfActive and marks met via markMet', async () => {
    const writer = mkWriter();
    const goals = [mkGoal({ id: 'q' }), heldCap('c')];
    const res = await reconcileGoals(goals, heldLogs, TODAY, writer, NOW);

    expect(writer.completeIfActive).toHaveBeenCalledWith('q');
    expect(writer.markMet).toHaveBeenCalledWith('c', TODAY, 5);
    expect(res.applied).toHaveLength(2);
    expect(res.failed).toEqual([]);
    expect(res.goals[0]).toMatchObject({ status: 'completed', completedAt: NOW });
    expect(res.goals[1].meta).toEqual({ metOn: TODAY });
  });

  it('skips a rejected write, still applies the next, and does not throw', async () => {
    const writer = mkWriter();
    writer.completeIfActive.mockRejectedValueOnce(new Error('offline'));
    const goals = [mkGoal({ id: 'q' }), heldCap('c')];
    const res = await reconcileGoals(goals, heldLogs, TODAY, writer, NOW);

    expect(res.applied.map((t) => t.goalId)).toEqual(['c']);
    expect(res.failed).toHaveLength(1);
    expect(res.failed[0].transition.goalId).toBe('q');
    expect(res.failed[0].error).toEqual(new Error('offline'));
    expect(res.goals[0].status).toBe('active');
    expect(res.goals[1].meta).toEqual({ metOn: TODAY });
  });

  it('does not apply a completion that matched 0 rows (set aside or deleted elsewhere), so no moment', async () => {
    const writer = mkWriter();
    writer.completeIfActive.mockResolvedValueOnce(false);
    const res = await reconcileGoals([mkGoal({ id: 'q' }), heldCap('c')], heldLogs, TODAY, writer, NOW);

    expect(res.applied.map((t) => t.goalId)).toEqual(['c']);
    expect(res.applied.some((t) => completionMoment(t) !== null)).toBe(false);
    expect(res.skipped.map((t) => t.goalId)).toEqual(['q']);
    expect(res.failed).toEqual([]);
    expect(res.goals[0]).toMatchObject({ status: 'active', completedAt: null });
  });

  it('does not apply a met mark the server refused (the cap changed meanwhile)', async () => {
    const writer = mkWriter();
    writer.markMet.mockResolvedValueOnce(false);
    const res = await reconcileGoals([heldCap('c')], heldLogs, TODAY, writer, NOW);

    expect(res.applied).toEqual([]);
    expect(res.skipped).toHaveLength(1);
    expect(res.goals[0].meta).toBeNull();
  });

  it('makes zero writer calls when nothing is due', async () => {
    const writer = mkWriter();
    const goals = [mkGoal({ endDate: dayShift(TODAY, 3) })];
    const res = await reconcileGoals(goals, [], TODAY, writer, NOW);

    expect(writer.completeIfActive).not.toHaveBeenCalled();
    expect(writer.markMet).not.toHaveBeenCalled();
    expect(res.applied).toEqual([]);
    expect(res.failed).toEqual([]);
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

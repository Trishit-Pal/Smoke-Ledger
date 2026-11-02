/**
 * Mobile goals in the session store: due transitions are reconciled after every load,
 * announced once through consumeGoalMoments, and a failed write is surfaced, never thrown.
 */
jest.mock('@/db/repositories/logs', () => ({
  listLogsPage: jest.fn().mockResolvedValue({ logs: [], nextCursor: null }),
}));
jest.mock('@/db/repositories/summary', () => ({ getDailySummary: jest.fn().mockResolvedValue([]) }));
jest.mock('@/db/repositories/brands', () => ({ listBrandsWithVariants: jest.fn().mockResolvedValue([]) }));
jest.mock('@/db/repositories/goals', () => ({
  listAllGoals: jest.fn(),
  setGoalStatus: jest.fn(),
  updateGoal: jest.fn(),
  createGoal: jest.fn(),
}));
jest.mock('@/db/repositories/profile', () => ({ getProfile: jest.fn().mockResolvedValue(null) }));
jest.mock('@/lib/catalogSync', () => ({ maybeSyncDefaultBrandCatalog: jest.fn().mockResolvedValue(undefined) }));
jest.mock('@/lib/catalogStorageNative', () => ({ makeNativeCatalogStorage: jest.fn().mockResolvedValue({}) }));
jest.mock('@/services/analytics', () => ({ track: jest.fn() }));

import * as goalsRepo from '@/db/repositories/goals';
import * as logsRepo from '@/db/repositories/logs';
import * as profileRepo from '@/db/repositories/profile';
import { track } from '@/services/analytics';
import { AnalyticsEvents } from '@/constants/events';
import { useSession } from '@/store/session';
import type { Goal, UserProfile } from '@/types';

const getProfile = profileRepo.getProfile as jest.Mock;
const listAllGoals = goalsRepo.listAllGoals as jest.Mock;
const setGoalStatus = goalsRepo.setGoalStatus as jest.Mock;
const createGoal = goalsRepo.createGoal as jest.Mock;

// A quit date long past: the planner wants it auto-completed.
const dueGoal = (): Goal => ({
  id: 'g1',
  type: 'quit_date',
  targetValue: 0,
  currentBaseline: null,
  startDate: '2020-01-01',
  endDate: '2020-02-01',
  status: 'active',
  meta: null,
  createdAt: '2020-01-01T00:00:00.000Z',
  completedAt: null,
});

describe('session goals reconcile', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setGoalStatus.mockResolvedValue(undefined);
    useSession.getState().reset();
  });

  it('boot completes a due goal and queues its moment once', async () => {
    listAllGoals.mockResolvedValue([dueGoal()]);
    await useSession.getState().boot();
    expect(setGoalStatus).toHaveBeenCalledWith('g1', 'completed');
    expect(useSession.getState().goals[0].status).toBe('completed');
    expect(useSession.getState().goalsReconcileFailed).toBe(false);

    const moments = useSession.getState().consumeGoalMoments();
    expect(moments).toEqual([{ goalId: 'g1', kind: 'auto_complete', reason: 'quit_date' }]);
    expect(useSession.getState().consumeGoalMoments()).toEqual([]);
  });

  it('boot and refreshLogs read the goal window in one page of up to 2000 rows', async () => {
    listAllGoals.mockResolvedValue([]);
    const listLogsPage = logsRepo.listLogsPage as jest.Mock;
    await useSession.getState().boot();
    await useSession.getState().refreshLogs();
    expect(listLogsPage).toHaveBeenCalledTimes(2);
    for (const [opts] of listLogsPage.mock.calls) {
      expect(opts).toMatchObject({ limit: 2000 });
      expect(opts.fromDate).toBeDefined();
      expect(opts.toDate).toBeDefined();
    }
  });

  it('refreshGoals does not re-announce once the write has landed', async () => {
    listAllGoals.mockResolvedValue([{ ...dueGoal(), status: 'completed' }]);
    await useSession.getState().refreshGoals();
    expect(setGoalStatus).not.toHaveBeenCalled();
    expect(useSession.getState().consumeGoalMoments()).toEqual([]);
  });

  it('does not queue the same goal twice when two refreshes race', async () => {
    listAllGoals.mockResolvedValue([dueGoal()]);
    await Promise.all([useSession.getState().refreshGoals(), useSession.getState().refreshGoals()]);
    expect(useSession.getState().consumeGoalMoments()).toHaveLength(1);
  });

  it('records a failed write, leaves the goal as stored, and never throws', async () => {
    listAllGoals.mockResolvedValue([dueGoal()]);
    setGoalStatus.mockRejectedValue(new Error('offline'));
    await expect(useSession.getState().boot()).resolves.toBeUndefined();
    expect(useSession.getState().goals[0].status).toBe('active');
    expect(useSession.getState().goalsReconcileFailed).toBe(true);
    expect(useSession.getState().consumeGoalMoments()).toEqual([]);
  });

  it('clears the failure flag on a later clean refresh', async () => {
    listAllGoals.mockResolvedValue([dueGoal()]);
    setGoalStatus.mockRejectedValueOnce(new Error('offline'));
    await useSession.getState().refreshGoals();
    expect(useSession.getState().goalsReconcileFailed).toBe(true);
    await useSession.getState().refreshGoals();
    expect(useSession.getState().goalsReconcileFailed).toBe(false);
  });
});

describe('boot reconcile uses the loaded profile zone', () => {
  afterEach(() => {
    jest.useRealTimers();
    getProfile.mockResolvedValue(null);
  });

  // 20:00Z on 31 Oct is already 1 Nov in India but still 31 Oct (21:00) in Paris.
  it('does not complete a quit date that is still tomorrow for a French reader', async () => {
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate', 'setTimeout'] }).setSystemTime(new Date('2026-10-31T20:00:00Z'));
    jest.clearAllMocks();
    useSession.getState().reset();
    getProfile.mockResolvedValue({ country: 'FR' } as UserProfile);
    listAllGoals.mockResolvedValue([{ ...dueGoal(), endDate: '2026-11-01' }]);
    await useSession.getState().boot();
    expect(setGoalStatus).not.toHaveBeenCalled();
    expect(useSession.getState().goals[0].status).toBe('active');
  });
});

describe('session goal actions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useSession.getState().reset();
  });

  it('addGoal tracks goal_created with from_proposal', async () => {
    createGoal.mockResolvedValue({ ...dueGoal(), id: 'g2', type: 'daily_cap' });
    await useSession.getState().addGoal({} as never, { fromProposal: true });
    expect(track).toHaveBeenCalledWith(AnalyticsEvents.GOAL_CREATED, { type: 'daily_cap', from_proposal: true });
  });

  it('addGoal defaults from_proposal to false', async () => {
    createGoal.mockResolvedValue({ ...dueGoal(), id: 'g2', type: 'daily_cap' });
    await useSession.getState().addGoal({} as never);
    expect(track).toHaveBeenCalledWith(AnalyticsEvents.GOAL_CREATED, { type: 'daily_cap', from_proposal: false });
  });

  it('setGoalStatus stamps completedAt for completed/abandoned and clears it otherwise', async () => {
    (goalsRepo.setGoalStatus as jest.Mock).mockResolvedValue(undefined);
    useSession.setState({ goals: [{ ...dueGoal(), id: 'a' }] });
    await useSession.getState().setGoalStatus('a', 'abandoned');
    expect(useSession.getState().goals[0].completedAt).toEqual(expect.any(String));
    await useSession.getState().setGoalStatus('a', 'active');
    expect(useSession.getState().goals[0].completedAt).toBeNull();
  });
});

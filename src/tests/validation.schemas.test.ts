import {
  YmdSchema,
  IdSchema,
  GoalSchema,
  GoalPatchSchema,
  GoalTypeSchema,
  ImportGoalSchema,
  MAX_MONEY_TARGET,
  MAX_STICK_TARGET,
  maxTargetFor,
} from '@/lib/validation';

describe('YmdSchema', () => {
  it('accepts valid calendar dates', () => {
    expect(YmdSchema.safeParse('2025-04-18').success).toBe(true);
    expect(YmdSchema.safeParse('2024-02-29').success).toBe(true);
  });

  it('rejects invalid calendar dates', () => {
    expect(YmdSchema.safeParse('2025-02-30').success).toBe(false);
    expect(YmdSchema.safeParse('25-04-18').success).toBe(false);
  });
});

describe('IdSchema', () => {
  it('requires non-empty ids', () => {
    expect(IdSchema.safeParse('log_abc').success).toBe(true);
    expect(IdSchema.safeParse('').success).toBe(false);
  });
});

describe('GoalSchema', () => {
  it('requires positive target for daily_cap', () => {
    expect(
      GoalSchema.safeParse({
        type: 'daily_cap',
        targetValue: 5,
        startDate: '2025-04-01',
      }).success,
    ).toBe(true);
    expect(
      GoalSchema.safeParse({
        type: 'daily_cap',
        targetValue: -1,
        startDate: '2025-04-01',
      }).success,
    ).toBe(false);
  });
});

describe('goal target limits per unit', () => {
  const goal = (type: string, targetValue: number) =>
    GoalSchema.safeParse({ type, targetValue, startDate: '2025-04-01' }).success;

  it('sticks types stop at 1,000', () => {
    expect(goal('daily_cap', 1000)).toBe(true);
    expect(goal('daily_cap', 1001)).toBe(false);
    expect(goal('weekly_target', 1001)).toBe(false);
  });

  it('spend caps accept up to 100,000', () => {
    expect(goal('spend_cap_daily', 1260)).toBe(true);
    expect(goal('spend_cap_daily', 100_000)).toBe(true);
    expect(goal('spend_cap_daily', 100_001)).toBe(false);
  });

  it('maxTargetFor mirrors the constants', () => {
    expect(maxTargetFor('spend_cap_daily')).toBe(MAX_MONEY_TARGET);
    expect(maxTargetFor('taper')).toBe(MAX_STICK_TARGET);
  });

  it('patch and import allow the money ceiling (the DB CHECK is the per-type authority)', () => {
    expect(GoalPatchSchema.safeParse({ targetValue: 100_000 }).success).toBe(true);
    expect(GoalPatchSchema.safeParse({ targetValue: 100_001 }).success).toBe(false);
    const imp = {
      id: 'g', type: 'spend_cap_daily', targetValue: 5000, currentBaseline: null, startDate: '2025-04-01',
      endDate: null, status: 'active', meta: null, createdAt: '2025-04-01T00:00:00.000Z',
    };
    expect(ImportGoalSchema.safeParse(imp).success).toBe(true);
  });
});

describe('taper goal type and completedAt', () => {
  const base = {
    id: 'goal_1',
    type: 'taper',
    targetValue: 5,
    currentBaseline: null,
    startDate: '2025-04-01',
    endDate: null,
    status: 'active',
    meta: null,
    createdAt: '2025-04-01T00:00:00.000Z',
  };

  it('GoalTypeSchema accepts taper', () => {
    expect(GoalTypeSchema.safeParse('taper').success).toBe(true);
  });

  it('ImportGoalSchema accepts a taper goal with completedAt', () => {
    expect(
      ImportGoalSchema.safeParse({ ...base, completedAt: '2025-05-01T00:00:00.000Z' }).success,
    ).toBe(true);
  });

  it('ImportGoalSchema accepts a goal without completedAt', () => {
    expect(ImportGoalSchema.safeParse(base).success).toBe(true);
  });
});

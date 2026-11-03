import { YmdSchema, IdSchema, GoalSchema, GoalTypeSchema, ImportGoalSchema } from '@/lib/validation';

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

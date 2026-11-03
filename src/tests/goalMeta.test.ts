import type { Goal } from '@/types';
import {
  appendStep,
  capOn,
  currentStepStart,
  isDailyCapLike,
  readGoalMeta,
  spendPeriod,
} from '@/domain/goalMeta';

const goal = (o: Partial<Goal> = {}): Goal => ({
  id: 'g1',
  type: 'daily_cap',
  targetValue: 10,
  currentBaseline: null,
  startDate: '2025-04-01',
  endDate: null,
  status: 'active',
  meta: null,
  createdAt: '2025-04-01T00:00:00.000Z',
  completedAt: null,
  ...o,
});

describe('readGoalMeta', () => {
  it('returns an empty object for null meta', () => {
    expect(readGoalMeta(goal())).toEqual({});
  });

  it('keeps valid fields and drops unknown keys', () => {
    const meta = readGoalMeta(
      goal({
        meta: {
          startHour: 22,
          endHour: 6,
          period: 'week',
          finalTarget: 3,
          metOn: '2025-05-01',
          steps: [{ cap: 8, from: '2025-04-01', reason: 'start' }],
          dismissals: { next: '2025-04-20' },
          junk: 1,
        },
      }),
    );
    expect(meta).toEqual({
      startHour: 22,
      endHour: 6,
      period: 'week',
      finalTarget: 3,
      metOn: '2025-05-01',
      steps: [{ cap: 8, from: '2025-04-01', reason: 'start' }],
      dismissals: { next: '2025-04-20' },
    });
  });

  it('drops a non-numeric finalTarget', () => {
    expect(readGoalMeta(goal({ meta: { finalTarget: '3' } })).finalTarget).toBeUndefined();
    expect(readGoalMeta(goal({ meta: { finalTarget: NaN } })).finalTarget).toBeUndefined();
  });

  it('drops an invalid period', () => {
    expect(readGoalMeta(goal({ meta: { period: 'year' } })).period).toBeUndefined();
  });

  it('drops a malformed step but keeps the valid ones', () => {
    const bad = { cap: 'x', from: '2025-04-01', reason: 'start' };
    const good = { cap: 4, from: '2025-04-09', reason: 'next' as const };
    expect(readGoalMeta(goal({ meta: { steps: [bad, good] } })).steps).toEqual([good]);
    expect(readGoalMeta(goal({ meta: { steps: [bad] } })).steps).toBeUndefined();
    expect(readGoalMeta(goal({ meta: { steps: 'nope' } })).steps).toBeUndefined();
    expect(
      readGoalMeta(goal({ meta: { steps: [{ cap: 5, from: 'tomorrow', reason: 'next' }] } })).steps,
    ).toBeUndefined();
    expect(
      readGoalMeta(goal({ meta: { steps: [{ cap: 5, from: '2025-04-01', reason: 'zzz' }] } })).steps,
    ).toBeUndefined();
  });

  it('drops a bad metOn and invalid dismissal entries', () => {
    const m = readGoalMeta(
      goal({ meta: { metOn: 'soon', dismissals: { next: 'x', reanchor: '2025-04-02', other: '2025-04-03' } } }),
    );
    expect(m.metOn).toBeUndefined();
    expect(m.dismissals).toEqual({ reanchor: '2025-04-02' });
  });
});

describe('spendPeriod / isDailyCapLike', () => {
  it('defaults the period to day', () => {
    expect(spendPeriod(goal({ type: 'spend_cap_daily' }))).toBe('day');
    expect(spendPeriod(goal({ type: 'spend_cap_daily', meta: { period: 'month' } }))).toBe('month');
  });

  it('is true for daily_cap, taper and a daily spend cap only', () => {
    expect(isDailyCapLike(goal({ type: 'daily_cap' }))).toBe(true);
    expect(isDailyCapLike(goal({ type: 'taper' }))).toBe(true);
    expect(isDailyCapLike(goal({ type: 'spend_cap_daily' }))).toBe(true);
    expect(isDailyCapLike(goal({ type: 'spend_cap_daily', meta: { period: 'day' } }))).toBe(true);
    expect(isDailyCapLike(goal({ type: 'spend_cap_daily', meta: { period: 'week' } }))).toBe(false);
    expect(isDailyCapLike(goal({ type: 'spend_cap_daily', meta: { period: 'month' } }))).toBe(false);
    expect(isDailyCapLike(goal({ type: 'weekly_target' }))).toBe(false);
    expect(isDailyCapLike(goal({ type: 'quit_date' }))).toBe(false);
    expect(isDailyCapLike(goal({ type: 'reduction_target' }))).toBe(false);
    expect(isDailyCapLike(goal({ type: 'no_smoke_window' }))).toBe(false);
  });
});

describe('steps', () => {
  const steps = [
    { cap: 10, from: '2025-04-01', reason: 'start' as const },
    { cap: 8, from: '2025-04-15', reason: 'next' as const },
  ];

  it('currentStepStart is the last step from, else startDate', () => {
    expect(currentStepStart(goal())).toBe('2025-04-01');
    expect(currentStepStart(goal({ meta: { steps } }))).toBe('2025-04-15');
  });

  it('appendStep seeds the start step once and returns a new array', () => {
    const g = goal();
    const first = appendStep(g, 8, '2025-04-15', 'next');
    expect(first).toEqual(steps);
    expect(g.meta).toBeNull();
    const withSteps = goal({ meta: { steps: first } });
    const second = appendStep(withSteps, 6, '2025-04-29', 'next');
    expect(second).toEqual([...steps, { cap: 6, from: '2025-04-29', reason: 'next' }]);
    expect(second).not.toBe(first);
    expect(first).toHaveLength(2);
  });

  it('capOn is null before start, then follows the steps', () => {
    const g = goal({ meta: { steps } });
    expect(capOn(g, '2025-03-31')).toBeNull();
    expect(capOn(g, '2025-04-01')).toBe(10);
    expect(capOn(g, '2025-04-14')).toBe(10);
    expect(capOn(g, '2025-04-15')).toBe(8);
    expect(capOn(g, '2026-01-01')).toBe(8);
  });

  it('capOn falls back to targetValue with no steps', () => {
    expect(capOn(goal(), '2025-04-10')).toBe(10);
    expect(capOn(goal(), '2025-03-01')).toBeNull();
  });
});

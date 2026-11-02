import type { Goal } from '@/types';
import { capStepPath, hasCapLine, pickCapGoal, withCapLine } from '@/domain/capLine';

function goal(over: Partial<Goal>): Goal {
  return {
    id: 'g',
    type: 'daily_cap',
    targetValue: 5,
    currentBaseline: null,
    startDate: '2026-10-02',
    endDate: null,
    status: 'active',
    meta: null,
    createdAt: '2026-10-02T00:00:00Z',
    completedAt: null,
    ...over,
  };
}

describe('pickCapGoal', () => {
  it('returns the first active daily_cap or taper goal', () => {
    const goals = [
      goal({ id: 'a', type: 'quit_date' }),
      goal({ id: 'b', type: 'taper' }),
      goal({ id: 'c', type: 'daily_cap' }),
    ];
    expect(pickCapGoal(goals)?.id).toBe('b');
  });
  it('ignores non-active and spend/other goal types', () => {
    const goals = [
      goal({ id: 'a', type: 'daily_cap', status: 'paused' }),
      goal({ id: 'b', type: 'spend_cap_daily' }),
      goal({ id: 'c', type: 'weekly_target' }),
    ];
    expect(pickCapGoal(goals)).toBeNull();
  });
});

describe('withCapLine', () => {
  const points = [
    { label: '10-01', value: 3 },
    { label: '10-02', value: 4 },
    { label: '10-03', value: 6 },
  ];
  const dates = ['2026-10-01', '2026-10-02', '2026-10-03'];

  it('adds the cap in force per day, null before the goal started', () => {
    const out = withCapLine(points, goal({}), dates, true);
    expect(out.map((p) => p.cap)).toEqual([null, 5, 5]);
    expect(out[2]).toMatchObject({ label: '10-03', value: 6 });
  });
  it('follows taper steps', () => {
    const g = goal({
      type: 'taper',
      meta: { steps: [{ cap: 8, from: '2026-10-02', reason: 'start' }, { cap: 6, from: '2026-10-03', reason: 'next' }] },
    });
    expect(withCapLine(points, g, dates, true).map((p) => p.cap)).toEqual([null, 8, 6]);
  });
  it('does not mutate the input points', () => {
    withCapLine(points, goal({}), dates, true);
    expect(points[0]).toEqual({ label: '10-01', value: 3 });
  });
  it('leaves points untouched when there is no goal', () => {
    expect(withCapLine(points, null, dates, true)).toBe(points);
  });
  it('leaves points untouched when a point spans more than one day', () => {
    expect(withCapLine(points, goal({}), dates, false)).toBe(points);
  });
});

describe('hasCapLine', () => {
  it('is true only when some point carries a numeric cap', () => {
    expect(hasCapLine([{ label: 'a', value: 1 }])).toBe(false);
    expect(hasCapLine([{ label: 'a', value: 1, cap: null }])).toBe(false);
    expect(hasCapLine([{ label: 'a', value: 1, cap: null }, { label: 'b', value: 2, cap: 4 }])).toBe(true);
  });
});

describe('capStepPath', () => {
  it('holds each cap until the next point, then steps', () => {
    expect(capStepPath([{ x: 0, y: 10 }, { x: 10, y: 10 }, { x: 20, y: 4 }])).toBe(
      'M 0 10 L 10 10 L 10 10 L 20 10 L 20 4',
    );
  });
  it('starts a fresh segment after a gap and draws nothing for no caps', () => {
    expect(capStepPath([{ x: 0, y: null }, { x: 10, y: 6 }, { x: 20, y: 6 }])).toBe('M 10 6 L 20 6 L 20 6');
    expect(capStepPath([{ x: 0, y: null }, { x: 10, y: null }])).toBe('');
  });
  it('lifts the pen across a mid-series gap', () => {
    expect(capStepPath([{ x: 0, y: 5 }, { x: 10, y: null }, { x: 20, y: 5 }])).toBe('M 0 5 M 20 5');
  });
});

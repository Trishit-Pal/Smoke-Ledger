import type { CigaretteLog, Goal } from '@/types';
import { dayShift } from '@/domain/calc';
import { dailyAdherence, goalState, holdStatus } from '@/domain/goalAdherence';

const TODAY = '2025-05-31'; // a Saturday; the week starts Monday 2025-05-26

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

const mkLog = (date: string, quantity: number, price: number | null = null): CigaretteLog => ({
  id: `l-${date}-${quantity}-${price}`,
  tsUtc: `${date}T12:00:00.000Z`,
  localDate: date,
  localHour: 12,
  brandId: null,
  brandNameSnap: null,
  variantSnap: null,
  quantity,
  purchaseMode: 'single',
  packSize: null,
  totalPriceInr: price,
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

/** One log per day (qty) for `count` days ending `endOffset` days before TODAY. */
const run = (count: number, qty: number, endOffset = 1): CigaretteLog[] =>
  Array.from({ length: count }, (_, i) => mkLog(dayShift(TODAY, -(endOffset + i)), qty));

describe('dailyAdherence', () => {
  it('returns `days` ascending dates ending today with used, cap, over and logged', () => {
    const logs = [mkLog(dayShift(TODAY, -1), 7), mkLog(TODAY, 2)];
    const out = dailyAdherence(mkGoal(), logs, TODAY);
    expect(out).toHaveLength(7);
    expect(out[0].date).toBe(dayShift(TODAY, -6));
    expect(out[6]).toEqual({ date: TODAY, used: 2, cap: 5, over: false, logged: true });
    expect(out[5]).toEqual({ date: dayShift(TODAY, -1), used: 7, cap: 5, over: true, logged: true });
    expect(out[0]).toMatchObject({ used: 0, over: false, logged: false });
  });

  it('uses the step cap in force on each date', () => {
    const goal = mkGoal({
      targetValue: 3,
      meta: {
        steps: [
          { cap: 6, from: '2025-01-01', reason: 'start' },
          { cap: 3, from: dayShift(TODAY, -2), reason: 'next' },
        ],
      },
    });
    const out = dailyAdherence(goal, [], TODAY);
    expect(out[3].cap).toBe(6);
    expect(out[4].cap).toBe(3);
  });

  it('uses spend for a daily spend cap', () => {
    const goal = mkGoal({ type: 'spend_cap_daily', targetValue: 100 });
    const out = dailyAdherence(goal, [mkLog(TODAY, 1, 150)], TODAY, 1);
    expect(out).toEqual([{ date: TODAY, used: 150, cap: 100, over: true, logged: true }]);
  });
});

describe('goalState (daily cap)', () => {
  it('is on_track with a clean week', () => {
    expect(goalState(mkGoal(), run(6, 2), TODAY)).toBe('on_track');
  });

  it('is at_risk with one over day', () => {
    expect(goalState(mkGoal(), [mkLog(dayShift(TODAY, -3), 6)], TODAY)).toBe('at_risk');
  });

  it('is off_track with three over days of seven', () => {
    const logs = [-1, -3, -5].map((d) => mkLog(dayShift(TODAY, d), 6));
    expect(goalState(mkGoal(), logs, TODAY)).toBe('off_track');
  });

  it('is at_risk when today is at 80% of the cap', () => {
    expect(goalState(mkGoal(), [mkLog(TODAY, 4)], TODAY)).toBe('at_risk');
  });

  it('is on_track when today is just under 80%', () => {
    expect(goalState(mkGoal({ targetValue: 10 }), [mkLog(TODAY, 7)], TODAY)).toBe('on_track');
  });

  it('is met when metOn is set and the week is clean', () => {
    const goal = mkGoal({ meta: { metOn: dayShift(TODAY, -1) } });
    expect(goalState(goal, run(6, 2), TODAY)).toBe('met');
  });

  it('is at_risk, not met, when metOn is set but one day is over', () => {
    const goal = mkGoal({ meta: { metOn: dayShift(TODAY, -5) } });
    expect(goalState(goal, [mkLog(dayShift(TODAY, -1), 6)], TODAY)).toBe('at_risk');
  });

  it('is not at_risk for a zero cap with nothing smoked', () => {
    expect(goalState(mkGoal({ targetValue: 0 }), [], TODAY)).toBe('on_track');
  });
});

describe('goalState (other goal types)', () => {
  it('week spend cap follows evaluateGoal: over -> off_track', () => {
    const goal = mkGoal({ type: 'spend_cap_daily', targetValue: 500, meta: { period: 'week' } });
    expect(goalState(goal, [mkLog('2025-05-27', 1, 300), mkLog('2025-05-29', 1, 300)], TODAY)).toBe(
      'off_track',
    );
  });

  it('week spend cap at 80% -> at_risk', () => {
    const goal = mkGoal({ type: 'spend_cap_daily', targetValue: 500, meta: { period: 'week' } });
    expect(goalState(goal, [mkLog('2025-05-27', 1, 420)], TODAY)).toBe('at_risk');
  });

  it('week spend cap well under -> on_track', () => {
    const goal = mkGoal({ type: 'spend_cap_daily', targetValue: 500, meta: { period: 'week' } });
    expect(goalState(goal, [mkLog('2025-05-27', 1, 100)], TODAY)).toBe('on_track');
  });
});

describe('holdStatus', () => {
  // Started exactly 14 days ago, so a clean run is bounded at 14 days.
  const fresh = () => mkGoal({ startDate: dayShift(TODAY, -14) });

  it('is held after 14 clean days with 10 logged', () => {
    const logs = [...run(10, 2)]; // days -1..-10 logged, -11..-14 clean but unlogged
    expect(holdStatus(fresh(), logs, TODAY)).toEqual({ runDays: 14, isHeld: true });
  });

  it('is not held with only 9 logged days', () => {
    expect(holdStatus(fresh(), run(9, 2), TODAY)).toEqual({ runDays: 14, isHeld: false });
  });

  it('stops the run at the first over day', () => {
    const logs = [...run(10, 2), mkLog(dayShift(TODAY, -4), 6)];
    expect(holdStatus(mkGoal(), logs, TODAY).runDays).toBe(3);
  });

  it('does not count today', () => {
    const logs = [...run(14, 2), mkLog(TODAY, 9)];
    expect(holdStatus(fresh(), logs, TODAY)).toEqual({ runDays: 14, isHeld: true });
  });

  it('cuts the run at the current step start', () => {
    const goal = mkGoal({
      targetValue: 3,
      meta: {
        steps: [
          { cap: 5, from: '2025-01-01', reason: 'start' },
          { cap: 3, from: dayShift(TODAY, -5), reason: 'next' },
        ],
      },
    });
    expect(holdStatus(goal, run(14, 2), TODAY).runDays).toBe(5);
  });

  it('is at most 3 for a goal started 3 days ago', () => {
    const goal = mkGoal({ startDate: dayShift(TODAY, -3) });
    expect(holdStatus(goal, run(14, 2), TODAY)).toEqual({ runDays: 3, isHeld: false });
  });

  it('looks back at most 90 days', () => {
    expect(holdStatus(mkGoal(), run(120, 2), TODAY).runDays).toBe(90);
  });

  it('returns zero for goals that are not daily-cap-like', () => {
    const goal = mkGoal({ type: 'weekly_target', targetValue: 30 });
    expect(holdStatus(goal, run(14, 2), TODAY)).toEqual({ runDays: 0, isHeld: false });
  });
});

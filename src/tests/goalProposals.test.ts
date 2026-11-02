import type { CigaretteLog, Goal } from '@/types';
import { dayShift } from '@/domain/calc';
import { holdStatus } from '@/domain/goalAdherence';
import {
  describeProposal,
  hasEnoughHistory,
  loggedDays,
  proposalFor,
  proposeNext,
  proposeReanchor,
  proposeStart,
  type Proposal,
} from '@/domain/goalProposals';

const TODAY = '2025-05-31';
const YESTERDAY = dayShift(TODAY, -1);
const INR = { currency: 'INR' as const };
const EUR = { currency: 'EUR' as const };

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

/** One log per day for `count` days ending `endOffset` days before TODAY. */
const run = (count: number, qty: number, price: number | null = null, endOffset = 1): CigaretteLog[] =>
  Array.from({ length: count }, (_, i) => mkLog(dayShift(TODAY, -(endOffset + i)), qty, price));

const met = (meta: Record<string, unknown> = {}) => ({ metOn: '2025-05-01', ...meta });

describe('loggedDays / hasEnoughHistory', () => {
  it('counts distinct localDates in range, inclusive', () => {
    const logs = [mkLog('2025-05-10', 1), mkLog('2025-05-10', 2), mkLog('2025-05-11', 1), mkLog('2025-05-20', 1)];
    expect(loggedDays(logs, '2025-05-10', '2025-05-11')).toBe(2);
    expect(loggedDays(logs, '2025-05-10', '2025-05-31')).toBe(3);
  });

  it('needs 7 logged days within the last 30', () => {
    expect(hasEnoughHistory(run(6, 3), TODAY)).toBe(false);
    expect(hasEnoughHistory(run(7, 3), TODAY)).toBe(true);
    expect(hasEnoughHistory(run(7, 3, null, 31), TODAY)).toBe(false); // all older than 30 days
  });
});

describe('proposeStart', () => {
  it('returns null with only 6 logged days', () => {
    expect(proposeStart('daily_cap', run(6, 4), TODAY, INR)).toBeNull();
  });

  it('daily_cap and taper start one under the 14-day average', () => {
    const logs = run(14, 4);
    expect(proposeStart('daily_cap', logs, TODAY, INR)).toEqual({
      kind: 'start', type: 'daily_cap', value: 3, unit: 'sticks', basisAvg: 4,
    });
    expect(proposeStart('taper', logs, TODAY, INR)).toMatchObject({ type: 'taper', value: 3 });
  });

  it('is null when the 14-day average is under 1, and floors at 1', () => {
    expect(proposeStart('daily_cap', run(7, 1), TODAY, INR)).toBeNull(); // 7 / 14 = 0.5
    expect(proposeStart('daily_cap', run(14, 1), TODAY, INR)).toMatchObject({ value: 1 });
  });

  it('weekly_target is 90% of the weekly average, rounded', () => {
    expect(proposeStart('weekly_target', run(14, 3), TODAY, INR)).toMatchObject({
      type: 'weekly_target', value: 19, unit: 'sticks', basisAvg: 3,
    });
  });

  it('spend cap rounds to 10 INR', () => {
    // 108/day * 0.9 = 97.2 -> 100; 105/day * 0.9 = 94.5 -> 90
    expect(proposeStart('spend_cap_daily', run(14, 5, 108), TODAY, { ...INR, period: 'day' })).toEqual({
      kind: 'start', type: 'spend_cap_daily', value: 100, unit: 'money', period: 'day', basisAvg: 108,
    });
    expect(proposeStart('spend_cap_daily', run(14, 5, 105), TODAY, INR)).toMatchObject({ value: 90, period: 'day' });
  });

  it('spend cap rounds to 5 EUR', () => {
    expect(proposeStart('spend_cap_daily', run(14, 5, 108), TODAY, EUR)).toMatchObject({ value: 95 });
  });

  it('spend cap scales to the week and month', () => {
    const logs = run(14, 5, 100);
    expect(proposeStart('spend_cap_daily', logs, TODAY, { ...INR, period: 'week' })).toMatchObject({
      value: 630, period: 'week',
    });
    expect(proposeStart('spend_cap_daily', logs, TODAY, { ...INR, period: 'month' })).toMatchObject({
      value: 2700, period: 'month',
    });
  });

  it('spend cap is null when nothing was spent', () => {
    expect(proposeStart('spend_cap_daily', run(14, 5), TODAY, INR)).toBeNull();
  });

  it('quit_date proposes 42 days out', () => {
    expect(proposeStart('quit_date', run(14, 4), TODAY, INR)).toEqual({
      kind: 'start', type: 'quit_date', value: 42, unit: 'sticks', date: dayShift(TODAY, 42), basisAvg: 4,
    });
  });

  it('has no proposal for no_smoke_window or reduction_target', () => {
    const logs = run(14, 4);
    expect(proposeStart('no_smoke_window', logs, TODAY, INR)).toBeNull();
    expect(proposeStart('reduction_target', logs, TODAY, INR)).toBeNull();
  });
});

describe('proposeNext', () => {
  const metGoal = (overrides: Partial<Goal> = {}) => mkGoal({ meta: met(), ...overrides });

  it('steps the cap down to the 7-day average, at most one under the cap', () => {
    expect(proposeNext(metGoal(), run(14, 3), TODAY, INR)).toMatchObject({
      kind: 'next', type: 'daily_cap', value: 3, unit: 'sticks', basisAvg: 3,
    });
    expect(proposeNext(metGoal(), run(14, 5), TODAY, INR)).toMatchObject({ value: 4 });
  });

  it('needs metOn', () => {
    expect(proposeNext(mkGoal(), run(14, 3), TODAY, INR)).toBeNull();
  });

  it('is null for goals that are not daily-cap-like or without enough history', () => {
    expect(proposeNext(metGoal({ type: 'weekly_target' }), run(14, 3), TODAY, INR)).toBeNull();
    expect(
      proposeNext(metGoal({ type: 'spend_cap_daily', meta: met({ period: 'week' }) }), run(14, 3, 50), TODAY, INR),
    ).toBeNull();
    expect(proposeNext(metGoal(), run(6, 3), TODAY, INR)).toBeNull();
  });

  it('is null when the cap cannot go lower', () => {
    expect(proposeNext(metGoal({ targetValue: 1 }), run(14, 1), TODAY, INR)).toBeNull();
  });

  it('honours the snooze through day 13 and shows again on day 14', () => {
    const snoozed = (daysAgo: number) =>
      metGoal({ meta: met({ dismissals: { next: dayShift(TODAY, -daysAgo) } }) });
    expect(proposeNext(snoozed(13), run(14, 3), TODAY, INR)).toBeNull();
    expect(proposeNext(snoozed(14), run(14, 3), TODAY, INR)).not.toBeNull();
  });

  it('floors a taper at its finalTarget', () => {
    const taper = metGoal({ type: 'taper', targetValue: 6, meta: met({ finalTarget: 4 }) });
    expect(proposeNext(taper, run(14, 1), TODAY, INR)).toMatchObject({ type: 'taper', value: 4 });
  });

  it('is null once a taper has reached its finalTarget', () => {
    const taper = metGoal({ type: 'taper', targetValue: 4, meta: met({ finalTarget: 4 }) });
    expect(proposeNext(taper, run(14, 1), TODAY, INR)).toBeNull();
  });

  it('reports the days held', () => {
    const goal = metGoal();
    const logs = run(20, 3);
    const p = proposeNext(goal, logs, TODAY, INR);
    expect(p?.heldDays).toBe(holdStatus(goal, logs, TODAY).runDays);
    expect(p?.heldDays).toBeGreaterThanOrEqual(14);
  });

  it('spend: steps down to 90% of the cap or the 7-day average, to the unit', () => {
    const goal = metGoal({ type: 'spend_cap_daily', targetValue: 100 });
    expect(proposeNext(goal, run(14, 2, 65), TODAY, INR)).toMatchObject({
      type: 'spend_cap_daily', value: 60, unit: 'money', basisAvg: 65,
    });
    expect(proposeNext(goal, run(14, 2, 200), TODAY, INR)).toMatchObject({ value: 90 });
    expect(proposeNext(goal, run(14, 2, 200), TODAY, EUR)).toMatchObject({ value: 90 }); // 90 / 5
    expect(proposeNext(metGoal({ type: 'spend_cap_daily', targetValue: 10 }), run(14, 1, 5), TODAY, INR)).toBeNull();
  });
});

describe('proposeReanchor', () => {
  it('re-anchors to the 7-day average ending today, rounded up', () => {
    const logs = run(14, 9, null, 0);
    expect(proposeReanchor(mkGoal(), logs, TODAY, INR)).toMatchObject({
      kind: 'reanchor', type: 'daily_cap', value: 9, unit: 'sticks', basisAvg: 9, overDays: 7,
    });
    expect(proposeReanchor(mkGoal(), [...run(13, 9, null, 1), mkLog(TODAY, 2)], TODAY, INR)).toMatchObject({
      value: 8, // (6 * 9 + 2) / 7 = 8
    });
  });

  it('is null when the average is not above the cap', () => {
    expect(proposeReanchor(mkGoal(), run(14, 5, null, 0), TODAY, INR)).toBeNull();
    expect(proposeReanchor(mkGoal(), run(14, 3, null, 0), TODAY, INR)).toBeNull();
  });

  it('caps the value at 1000', () => {
    expect(proposeReanchor(mkGoal(), run(14, 5000, null, 0), TODAY, INR)?.value).toBe(1000);
  });

  it('spend rounds up to the unit', () => {
    const goal = mkGoal({ type: 'spend_cap_daily', targetValue: 100 });
    expect(proposeReanchor(goal, run(14, 5, 253, 0), TODAY, INR)).toMatchObject({ value: 260, unit: 'money' });
    expect(proposeReanchor(goal, run(14, 5, 253, 0), TODAY, EUR)).toMatchObject({ value: 255 });
  });

  it('is null for non-daily goals and thin history', () => {
    expect(proposeReanchor(mkGoal({ type: 'weekly_target' }), run(14, 9, null, 0), TODAY, INR)).toBeNull();
    expect(proposeReanchor(mkGoal(), run(6, 9, null, 0), TODAY, INR)).toBeNull();
  });

  it('honours the snooze through day 13 and shows again on day 14', () => {
    const snoozed = (daysAgo: number) =>
      mkGoal({ meta: { dismissals: { reanchor: dayShift(TODAY, -daysAgo) } } });
    const logs = run(14, 9, null, 0);
    expect(proposeReanchor(snoozed(13), logs, TODAY, INR)).toBeNull();
    expect(proposeReanchor(snoozed(14), logs, TODAY, INR)).not.toBeNull();
  });

  it('a next-dismissal does not snooze a re-anchor', () => {
    const goal = mkGoal({ meta: { dismissals: { next: TODAY } } });
    expect(proposeReanchor(goal, run(14, 9, null, 0), TODAY, INR)).not.toBeNull();
  });
});

describe('proposalFor', () => {
  const goal = mkGoal({ meta: met() });
  const logs = run(14, 3, null, 0);

  it('met proposes next, off_track proposes re-anchor, other states none', () => {
    expect(proposalFor(goal, logs, TODAY, 'met', INR)?.kind).toBe('next');
    expect(proposalFor(mkGoal(), run(14, 9, null, 0), TODAY, 'off_track', INR)?.kind).toBe('reanchor');
    expect(proposalFor(goal, logs, TODAY, 'on_track', INR)).toBeNull();
    expect(proposalFor(goal, logs, TODAY, 'at_risk', INR)).toBeNull();
  });
});

describe('describeProposal', () => {
  const formatMoney = (n: number) => `₹${n}`;
  const formatDate = (ymd: string) => `on ${ymd}`;
  const open = { formatMoney, formatDate, hideMoney: false };
  const masked = { formatMoney, formatDate, hideMoney: true };
  const base: Proposal = { kind: 'start', type: 'daily_cap', value: 3, unit: 'sticks', basisAvg: 4.04 };

  it('start, sticks', () => {
    expect(describeProposal(base, open)).toEqual({
      headline: 'Start at 3 a day?',
      basis: 'Your last two weeks average 4.0 a day.',
      valueLabel: '3 / day',
    });
  });

  it('start, weekly', () => {
    expect(describeProposal({ ...base, type: 'weekly_target', value: 19 }, open)).toEqual({
      headline: 'Start at 19 a week?',
      basis: 'Your last two weeks average 4.0 a day.',
      valueLabel: '19 / week',
    });
  });

  it('start, spend per period', () => {
    const p: Proposal = { ...base, type: 'spend_cap_daily', value: 630, unit: 'money', period: 'week', basisAvg: 100 };
    expect(describeProposal(p, open)).toEqual({
      headline: 'Start at ₹630 a week?',
      basis: 'Your last two weeks average ₹100 a day.',
      valueLabel: '₹630 / week',
    });
    expect(describeProposal({ ...p, period: 'month', value: 2700 }, open)).toMatchObject({
      headline: 'Start at ₹2700 a month?',
      valueLabel: '₹2700 / month',
    });
    expect(describeProposal({ ...p, period: 'day', value: 90 }, open)).toMatchObject({
      headline: 'Start at ₹90 a day?',
      valueLabel: '₹90 / day',
    });
  });

  it('start, spend, masked', () => {
    const p: Proposal = { ...base, type: 'spend_cap_daily', value: 630, unit: 'money', period: 'week', basisAvg: 100 };
    expect(describeProposal(p, masked)).toEqual({
      headline: 'Start a little under your recent spend?',
      basis: 'Amounts are hidden in discreet mode.',
      valueLabel: '—',
    });
  });

  it('start, quit_date', () => {
    const p: Proposal = { ...base, type: 'quit_date', value: 42, date: '2025-07-12' };
    expect(describeProposal(p, open)).toEqual({
      headline: 'Quit on on 2025-07-12?',
      basis: 'Six weeks from today. Your last two weeks average 4.0 a day.',
      valueLabel: 'on 2025-07-12',
    });
  });

  it('next, sticks', () => {
    const p: Proposal = { ...base, kind: 'next', value: 4, heldDays: 15 };
    expect(describeProposal(p, { ...open, currentCap: 5 })).toEqual({
      headline: 'Next: 4 a day?',
      basis: 'Fourteen days under 5.',
      valueLabel: '4 / day',
    });
  });

  it('next, spend, with and without discreet mode', () => {
    const p: Proposal = { ...base, kind: 'next', type: 'spend_cap_daily', value: 260, unit: 'money', basisAvg: 250 };
    expect(describeProposal(p, { ...open, currentCap: 300 })).toEqual({
      headline: 'Next: ₹260 a day?',
      basis: 'Fourteen days under ₹300.',
      valueLabel: '₹260 / day',
    });
    const m = describeProposal(p, { ...masked, currentCap: 300 });
    expect(m.headline).toBe('Next: a little lower?');
    expect(m.valueLabel).toBe('—');
  });

  it('reanchor, sticks', () => {
    const p: Proposal = { ...base, kind: 'reanchor', value: 9, overDays: 4 };
    expect(describeProposal(p, open)).toEqual({
      headline: 'Re-anchor to 9 a day?',
      basis: 'Over on 4 of the last 7 days. 9 is where you are now.',
      valueLabel: '9 / day',
    });
  });

  it('reanchor, spend, with and without discreet mode', () => {
    const p: Proposal = {
      ...base, kind: 'reanchor', type: 'spend_cap_daily', value: 260, unit: 'money', basisAvg: 253, overDays: 4,
    };
    expect(describeProposal(p, open)).toEqual({
      headline: 'Re-anchor to ₹260 a day?',
      basis: 'Over on 4 of the last 7 days. ₹260 is where you are now.',
      valueLabel: '₹260 / day',
    });
    expect(describeProposal(p, masked)).toEqual({
      headline: 'Re-anchor to where you are now?',
      basis: 'Over on 4 of the last 7 days.',
      valueLabel: '—',
    });
  });

  it('masked copy never contains the formatted amount', () => {
    const spend = { ...base, type: 'spend_cap_daily' as const, value: 260, unit: 'money' as const, basisAvg: 253 };
    const cases: Proposal[] = [
      { ...spend, period: 'day' },
      { ...spend, kind: 'next' },
      { ...spend, kind: 'reanchor', overDays: 4 },
    ];
    for (const p of cases) {
      const d = describeProposal(p, { ...masked, currentCap: 300 });
      const text = `${d.headline} ${d.basis} ${d.valueLabel}`;
      for (const amount of ['₹260', '₹253', '₹300', '260', '253', '300']) {
        expect(text).not.toContain(amount);
      }
    }
  });
});

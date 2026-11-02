import { describe, expect, it } from 'vitest';
import { emptyGoalForm, proposalToForm, type GoalFormState } from '@/domain/goalForm';
import type { Proposal } from '@/domain/goalProposals';
import type { CigaretteLog, Goal } from '@/types';
import {
  doneLabel,
  isFromProposal,
  offersStartProposal,
  parseTypeParam,
  periodUnitLabel,
  proposalButtonLabel,
  proposalRowLabel,
  unseenActiveTypes,
} from '../app/(app)/goals/goalsView';
import { goalCardModel, stateColor } from '../lib/goals/goalCardModel';

const proposal: Proposal = { kind: 'start', type: 'daily_cap', value: 6, unit: 'sticks', basisAvg: 7.2 };
const seeded = (): GoalFormState => ({ ...emptyGoalForm('daily_cap'), ...proposalToForm(proposal) });

describe('parseTypeParam', () => {
  it('accepts a creatable goal type', () => {
    expect(parseTypeParam('taper')).toBe('taper');
    expect(parseTypeParam('spend_cap_daily')).toBe('spend_cap_daily');
  });
  it('rejects null, junk and legacy-only types', () => {
    expect(parseTypeParam(null)).toBeNull();
    expect(parseTypeParam('')).toBeNull();
    expect(parseTypeParam('nope')).toBeNull();
    expect(parseTypeParam('reduction_target')).toBeNull();
  });
});

describe('isFromProposal', () => {
  it('is false when the form was never seeded', () => {
    expect(isFromProposal(emptyGoalForm(), null)).toBe(false);
  });
  it('is true while target, period and quit date match the seed', () => {
    expect(isFromProposal(seeded(), seeded())).toBe(true);
  });
  it('is false once the target is edited', () => {
    expect(isFromProposal({ ...seeded(), target: '5' }, seeded())).toBe(false);
  });
  it('is false once the period or quit date changes', () => {
    expect(isFromProposal({ ...seeded(), period: 'week' }, seeded())).toBe(false);
    expect(isFromProposal({ ...seeded(), quitDate: '2026-12-01' }, seeded())).toBe(false);
  });
  it('ignores fields the proposal does not own', () => {
    expect(isFromProposal({ ...seeded(), baseline: '9' }, seeded())).toBe(true);
  });
});

describe('periodUnitLabel', () => {
  it('follows currency and period', () => {
    expect(periodUnitLabel('INR', 'day')).toBe('₹/day');
    expect(periodUnitLabel('EUR', 'week')).toBe('€/week');
    expect(periodUnitLabel('INR', 'month')).toBe('₹/month');
  });
});

describe('offersStartProposal', () => {
  it('is false only for the no-smoke window', () => {
    expect(offersStartProposal('no_smoke_window')).toBe(false);
    expect(offersStartProposal('daily_cap')).toBe(true);
    expect(offersStartProposal('quit_date')).toBe(true);
  });
});

describe('proposalButtonLabel', () => {
  it('names the value when it is visible', () => {
    expect(proposalButtonLabel('6 / day', false)).toBe('Use 6 / day');
  });
  it('never echoes a masked value', () => {
    expect(proposalButtonLabel('—', true)).toBe('Use the suggestion');
  });
});

const TODAY = '2026-11-02';
const mkGoal = (o: Partial<Goal> = {}): Goal => ({
  id: 'g1',
  type: 'daily_cap',
  targetValue: 5,
  currentBaseline: null,
  startDate: '2026-01-01',
  endDate: null,
  status: 'active',
  meta: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  completedAt: null,
  ...o,
});
const dayBefore = (n: number): string => {
  const d = new Date(`${TODAY}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
};
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
const everyDay = (n: number, quantity: number): CigaretteLog[] =>
  Array.from({ length: n }, (_, i) => mkLog(dayBefore(i), quantity));
const ctx = { currency: 'INR' as const, formatMoney: (n: number) => `Rs${n}`, formatDate: (d: string) => d, hideMoney: false };

describe('doneLabel', () => {
  const fmt = (d: string) => `<${d}>`;
  it('dates a completed or set-aside goal', () => {
    expect(doneLabel('completed', '2026-10-30T08:00:00.000Z', fmt)).toBe('Completed <2026-10-30T08:00:00.000Z>');
    expect(doneLabel('abandoned', '2026-10-30T08:00:00.000Z', fmt)).toBe('Set aside <2026-10-30T08:00:00.000Z>');
  });
  it('falls back to the bare word without a date', () => {
    expect(doneLabel('completed', null, fmt)).toBe('Completed');
    expect(doneLabel('abandoned', null, fmt)).toBe('Set aside');
  });
});

describe('stateColor', () => {
  it('is teal only for on-track and met', () => {
    expect(stateColor('on_track')).toBe('var(--accent)');
    expect(stateColor('met')).toBe('var(--accent)');
    expect(stateColor('at_risk')).toBe('var(--warn-earth)');
    expect(stateColor('off_track')).toBe('var(--warn-earth)');
  });
});

describe('proposalRowLabel', () => {
  it('names the proposal kind', () => {
    expect(proposalRowLabel('next')).toBe('Next step');
    expect(proposalRowLabel('reanchor')).toBe('Re-anchor');
  });
});

describe('unseenActiveTypes', () => {
  it('lists each active type once and skips ones already seen', () => {
    const goals = [
      mkGoal({ id: 'a', type: 'daily_cap' }),
      mkGoal({ id: 'b', type: 'daily_cap' }),
      mkGoal({ id: 'c', type: 'taper' }),
      mkGoal({ id: 'd', type: 'quit_date', status: 'paused' }),
    ];
    expect(unseenActiveTypes(goals, new Set(['taper']))).toEqual(['daily_cap']);
  });
});

describe('goalCardModel', () => {
  it('reads an on-track goal with no proposal', () => {
    const m = goalCardModel(mkGoal(), everyDay(30, 2), TODAY, ctx);
    expect(m).toMatchObject({ state: 'on_track', overDays: 0, proposal: null, copy: null });
  });

  it('counts over days and offers a re-anchor for an off-track goal', () => {
    const m = goalCardModel(mkGoal(), everyDay(30, 9), TODAY, ctx);
    expect(m.state).toBe('off_track');
    expect(m.overDays).toBe(7);
    expect(m.proposal?.kind).toBe('reanchor');
    expect(m.copy?.headline).toBe('Re-anchor to 9 a day?');
  });

  it('offers the next step for a met goal, naming the cap in force', () => {
    const goal = mkGoal({ targetValue: 5, meta: { metOn: dayBefore(1) } });
    const m = goalCardModel(goal, everyDay(30, 3), TODAY, ctx);
    expect(m.state).toBe('met');
    expect(m.proposal?.kind).toBe('next');
    expect(m.copy?.basis).toBe('Fourteen days under 5.');
    expect(m.heldDays).toBeGreaterThan(0);
  });

  it('offers nothing on a paused goal', () => {
    const m = goalCardModel(mkGoal({ status: 'paused' }), everyDay(30, 9), TODAY, ctx);
    expect(m.proposal).toBeNull();
  });

  it('does not judge a weekly goal against a per-day record', () => {
    const m = goalCardModel(mkGoal({ type: 'weekly_target', targetValue: 30 }), everyDay(30, 2), TODAY, ctx);
    expect(m.overDays).toBe(0);
  });

  it('masks a spend proposal under discreet mode', () => {
    const logs = everyDay(30, 1).map((l) => ({ ...l, totalPriceInr: 900 }));
    const goal = mkGoal({ type: 'spend_cap_daily', targetValue: 100 });
    const m = goalCardModel(goal, logs, TODAY, { ...ctx, hideMoney: true });
    expect(m.proposal?.kind).toBe('reanchor');
    expect(m.copy?.valueLabel).toBe('—');
    expect(JSON.stringify(m.copy)).not.toMatch(/\d{3}/);
  });
});

describe('goalCardModel under discreet mode (next proposal)', () => {
  it('masks the amounts of a spend next-step proposal', () => {
    const logs = everyDay(30, 1).map((l) => ({ ...l, totalPriceInr: 40 }));
    const goal = mkGoal({ type: 'spend_cap_daily', targetValue: 100, meta: { metOn: dayBefore(1) } });
    const m = goalCardModel(goal, logs, TODAY, { ...ctx, hideMoney: true });
    expect(m.proposal?.kind).toBe('next');
    expect(m.copy?.valueLabel).toBe('—');
    expect(`${m.copy?.headline} ${m.copy?.basis}`).not.toMatch(/\d/);
  });
});

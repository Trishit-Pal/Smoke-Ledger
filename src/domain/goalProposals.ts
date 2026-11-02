// Goal proposals: a first cap, the next step down, or a re-anchor, each with its
// editorial copy. Pure: no I/O, no clock; callers inject money/date formatting.

import type { CigaretteLog, Goal, GoalType } from '@/types';
import type { CurrencyCode } from '@/lib/regions';
import { daysUntil } from '@/lib/date';
import { dayShift, rollingAvgSpend, rollingAvgSticks } from './calc';
import { dailyAdherence, holdStatus, type GoalState } from './goalAdherence';
import {
  MIN_LOGGED_DAYS_FOR_PROPOSAL,
  PROPOSAL_DATA_WINDOW_DAYS,
  PROPOSAL_SNOOZE_DAYS,
  QUIT_DATE_PROPOSAL_DAYS,
  capOn,
  isDailyCapLike,
  readGoalMeta,
  type DismissKind,
  type SpendPeriod,
} from './goalMeta';

export type ProposalKind = 'start' | 'next' | 'reanchor';
export interface Proposal {
  kind: ProposalKind;
  type: GoalType;
  value: number; // cap in sticks or money; for quit_date, days until the date
  unit: 'sticks' | 'money';
  period?: SpendPeriod; // spend caps only
  date?: string; // quit_date only: YYYY-MM-DD
  basisAvg: number; // the average the value came from, per day
  overDays?: number; // reanchor only
  heldDays?: number; // next only
}

interface Opts {
  currency: CurrencyCode;
}

const MAX_REANCHOR_VALUE = 1000;
const SPEND_CAP_FACTOR = 0.9;
const PERIOD_DAYS: Record<SpendPeriod, number> = { day: 1, week: 7, month: 30 };
const PER: Record<SpendPeriod, string> = { day: 'a day', week: 'a week', month: 'a month' };

const moneyStep = (currency: CurrencyCode): number => (currency === 'EUR' ? 5 : 10);

/** Distinct local dates with at least one log in [fromYmd, toYmd]. */
export function loggedDays(logs: CigaretteLog[], fromYmd: string, toYmd: string): number {
  return new Set(logs.filter((l) => l.localDate >= fromYmd && l.localDate <= toYmd).map((l) => l.localDate)).size;
}

export function hasEnoughHistory(logs: CigaretteLog[], today: string): boolean {
  const from = dayShift(today, -(PROPOSAL_DATA_WINDOW_DAYS - 1));
  return loggedDays(logs, from, today) >= MIN_LOGGED_DAYS_FOR_PROPOSAL;
}

/** A dismissal stamped on D hides the proposal until PROPOSAL_SNOOZE_DAYS have passed. */
function isSnoozed(goal: Goal, kind: DismissKind, today: string): boolean {
  const stamped = readGoalMeta(goal).dismissals?.[kind];
  return stamped !== undefined && daysUntil(stamped, today) < PROPOSAL_SNOOZE_DAYS;
}

export function proposeStart(
  type: GoalType,
  logs: CigaretteLog[],
  today: string,
  opts: { currency: CurrencyCode; period?: SpendPeriod },
): Proposal | null {
  if (!hasEnoughHistory(logs, today)) return null;
  const yesterday = dayShift(today, -1);
  const avg14 = rollingAvgSticks(logs, yesterday, 14);

  switch (type) {
    case 'daily_cap':
    case 'taper':
      if (avg14 < 1) return null;
      return { kind: 'start', type, value: Math.max(1, Math.round(avg14) - 1), unit: 'sticks', basisAvg: avg14 };
    case 'weekly_target': {
      const value = Math.round(avg14 * 7 * SPEND_CAP_FACTOR);
      return value < 1 ? null : { kind: 'start', type, value, unit: 'sticks', basisAvg: avg14 };
    }
    case 'spend_cap_daily': {
      const period = opts.period ?? 'day';
      const step = moneyStep(opts.currency);
      const avgSpend = rollingAvgSpend(logs, yesterday, 14);
      const value = Math.round((avgSpend * PERIOD_DAYS[period] * SPEND_CAP_FACTOR) / step) * step;
      return value <= 0 ? null : { kind: 'start', type, value, unit: 'money', period, basisAvg: avgSpend };
    }
    case 'quit_date':
      return {
        kind: 'start',
        type,
        value: QUIT_DATE_PROPOSAL_DAYS,
        date: dayShift(today, QUIT_DATE_PROPOSAL_DAYS),
        unit: 'sticks',
        basisAvg: avg14,
      };
    default:
      return null;
  }
}

export function proposeNext(goal: Goal, logs: CigaretteLog[], today: string, opts: Opts): Proposal | null {
  if (!isDailyCapLike(goal) || !readGoalMeta(goal).metOn) return null;
  const hold = holdStatus(goal, logs, today);
  if (!hold.isHeld) return null; // metOn is a past hold; "fourteen days under X" must still be true
  if (!hasEnoughHistory(logs, today) || isSnoozed(goal, 'next', today)) return null;
  const cap = capOn(goal, today) ?? goal.targetValue;
  const yesterday = dayShift(today, -1);
  const heldDays = hold.runDays;

  if (goal.type === 'spend_cap_daily') {
    const step = moneyStep(opts.currency);
    const avgSpend = rollingAvgSpend(logs, yesterday, 7);
    const value = Math.floor(Math.min(cap * SPEND_CAP_FACTOR, avgSpend) / step) * step;
    if (value <= 0 || value >= cap) return null;
    return { kind: 'next', type: goal.type, value, unit: 'money', period: 'day', basisAvg: avgSpend, heldDays };
  }

  const floor = goal.type === 'taper' ? (readGoalMeta(goal).finalTarget ?? 1) : 1;
  const avg7 = rollingAvgSticks(logs, yesterday, 7);
  const value = Math.max(floor, Math.min(cap - 1, Math.round(avg7)));
  if (value >= cap) return null; // already at the floor
  return { kind: 'next', type: goal.type, value, unit: 'sticks', basisAvg: avg7, heldDays };
}

export function proposeReanchor(goal: Goal, logs: CigaretteLog[], today: string, opts: Opts): Proposal | null {
  if (!isDailyCapLike(goal)) return null;
  if (!hasEnoughHistory(logs, today) || isSnoozed(goal, 'reanchor', today)) return null;
  const cap = capOn(goal, today) ?? goal.targetValue;
  const overDays = dailyAdherence(goal, logs, today).filter((d) => d.over).length;

  if (goal.type === 'spend_cap_daily') {
    const step = moneyStep(opts.currency);
    const avgSpend = rollingAvgSpend(logs, today, 7);
    const value = Math.min(MAX_REANCHOR_VALUE, Math.ceil(avgSpend / step) * step);
    if (value <= cap) return null;
    return { kind: 'reanchor', type: goal.type, value, unit: 'money', period: 'day', basisAvg: avgSpend, overDays };
  }

  const avg7 = rollingAvgSticks(logs, today, 7);
  const value = Math.min(MAX_REANCHOR_VALUE, Math.ceil(avg7));
  if (value <= cap) return null;
  return { kind: 'reanchor', type: goal.type, value, unit: 'sticks', basisAvg: avg7, overDays };
}

export function proposalFor(
  goal: Goal,
  logs: CigaretteLog[],
  today: string,
  state: GoalState,
  opts: Opts,
): Proposal | null {
  if (state === 'met') return proposeNext(goal, logs, today, opts);
  if (state === 'off_track') return proposeReanchor(goal, logs, today, opts);
  return null;
}

interface DescribeOpts {
  formatMoney: (n: number) => string;
  formatDate: (ymd: string) => string;
  hideMoney: boolean;
  currentCap?: number;
}
interface Description {
  headline: string;
  basis: string;
  valueLabel: string;
}

const MASKED_VALUE_LABEL = '—';
const sticksBasis = (p: Proposal): string => `Your last two weeks average ${p.basisAvg.toFixed(1)} a day.`;

function describeStart(p: Proposal, o: DescribeOpts): Description {
  if (p.type === 'quit_date') {
    const date = o.formatDate(p.date ?? '');
    return {
      headline: `Quit on ${date}?`,
      basis: `Six weeks from today. ${sticksBasis(p)}`,
      valueLabel: date,
    };
  }
  if (p.unit === 'money') {
    if (o.hideMoney) {
      return {
        headline: 'Start a little under your recent spend?',
        basis: 'Amounts are hidden in discreet mode.',
        valueLabel: MASKED_VALUE_LABEL,
      };
    }
    const period = p.period ?? 'day';
    return {
      headline: `Start at ${o.formatMoney(p.value)} ${PER[period]}?`,
      basis: `Your last two weeks average ${o.formatMoney(p.basisAvg)} a day.`,
      valueLabel: `${o.formatMoney(p.value)} / ${period}`,
    };
  }
  const weekly = p.type === 'weekly_target';
  return {
    headline: `Start at ${p.value} ${weekly ? 'a week' : 'a day'}?`,
    basis: sticksBasis(p),
    valueLabel: `${p.value} / ${weekly ? 'week' : 'day'}`,
  };
}

function describeNext(p: Proposal, o: DescribeOpts): Description {
  if (p.unit === 'money') {
    if (o.hideMoney) {
      return {
        headline: 'Next: a little lower?',
        basis: 'Fourteen days under your current cap.',
        valueLabel: MASKED_VALUE_LABEL,
      };
    }
    return {
      headline: `Next: ${o.formatMoney(p.value)} a day?`,
      basis: `Fourteen days under ${o.formatMoney(o.currentCap ?? 0)}.`,
      valueLabel: `${o.formatMoney(p.value)} / day`,
    };
  }
  return {
    headline: `Next: ${p.value} a day?`,
    basis: `Fourteen days under ${o.currentCap}.`,
    valueLabel: `${p.value} / day`,
  };
}

function describeReanchor(p: Proposal, o: DescribeOpts): Description {
  const over = `Over on ${p.overDays ?? 0} of the last 7 days.`;
  if (p.unit === 'money') {
    if (o.hideMoney) {
      return { headline: 'Re-anchor to where you are now?', basis: over, valueLabel: MASKED_VALUE_LABEL };
    }
    return {
      headline: `Re-anchor to ${o.formatMoney(p.value)} a day?`,
      basis: `${over} ${o.formatMoney(p.value)} is where you are now.`,
      valueLabel: `${o.formatMoney(p.value)} / day`,
    };
  }
  return {
    headline: `Re-anchor to ${p.value} a day?`,
    basis: `${over} ${p.value} is where you are now.`,
    valueLabel: `${p.value} / day`,
  };
}

export function describeProposal(p: Proposal, opts: DescribeOpts): Description {
  if (p.kind === 'start') return describeStart(p, opts);
  if (p.kind === 'next') return describeNext(p, opts);
  return describeReanchor(p, opts);
}

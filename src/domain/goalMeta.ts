// Typed, defensive reader for a goal's `meta_json`, plus the step-history helpers
// the adaptive-goals engine shares. Pure: no I/O, no clock, never mutates a Goal.

import type { Goal } from '@/types';

export const HOLD_DAYS = 14;
export const HOLD_MIN_LOGGED_DAYS = 10;
export const LOOKBACK_DAYS = 7;
export const OFF_TRACK_OVER_DAYS = 3;
export const PROPOSAL_SNOOZE_DAYS = 14;
export const MIN_LOGGED_DAYS_FOR_PROPOSAL = 7; // within the last 30 days
export const PROPOSAL_DATA_WINDOW_DAYS = 30;
export const QUIT_DATE_PROPOSAL_DAYS = 42;
export const AT_RISK_RATIO = 0.8;

export type SpendPeriod = 'day' | 'week' | 'month';
export type StepReason = 'start' | 'next' | 'reanchor' | 'edit';
export interface GoalStep {
  cap: number;
  from: string;
  reason: StepReason;
}
export type DismissKind = 'next' | 'reanchor';
export interface GoalMeta {
  startHour?: number;
  endHour?: number;
  period?: SpendPeriod;
  finalTarget?: number;
  steps?: GoalStep[];
  metOn?: string;
  dismissals?: Partial<Record<DismissKind, string>>;
}

const PERIODS: readonly SpendPeriod[] = ['day', 'week', 'month'];
const REASONS: readonly StepReason[] = ['start', 'next', 'reanchor', 'edit'];
const DISMISS_KINDS: readonly DismissKind[] = ['next', 'reanchor'];
const YMD = /^\d{4}-\d{2}-\d{2}$/;

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isYmd = (v: unknown): v is string => typeof v === 'string' && YMD.test(v);

function readStep(v: unknown): GoalStep | null {
  if (typeof v !== 'object' || v === null) return null;
  const s = v as Record<string, unknown>;
  if (!isNum(s['cap']) || !isYmd(s['from'])) return null;
  const reason = REASONS.find((r) => r === s['reason']);
  return reason ? { cap: s['cap'], from: s['from'], reason } : null;
}

function readDismissals(v: unknown): GoalMeta['dismissals'] {
  if (typeof v !== 'object' || v === null) return undefined;
  const src = v as Record<string, unknown>;
  const out: Partial<Record<DismissKind, string>> = {};
  for (const kind of DISMISS_KINDS) {
    const d = src[kind];
    if (isYmd(d)) out[kind] = d;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

/**
 * Reads `goal.meta` keeping a field only when its shape is right; unknown keys
 * and malformed steps are dropped. Never throws.
 */
export function readGoalMeta(goal: Goal): GoalMeta {
  const raw = goal.meta;
  if (typeof raw !== 'object' || raw === null) return {};
  const out: GoalMeta = {};
  if (isNum(raw['startHour'])) out.startHour = raw['startHour'];
  if (isNum(raw['endHour'])) out.endHour = raw['endHour'];
  const period = PERIODS.find((p) => p === raw['period']);
  if (period) out.period = period;
  if (isNum(raw['finalTarget'])) out.finalTarget = raw['finalTarget'];
  if (Array.isArray(raw['steps'])) {
    const steps = raw['steps'].map(readStep).filter((s): s is GoalStep => s !== null);
    if (steps.length > 0) out.steps = steps;
  }
  if (isYmd(raw['metOn'])) out.metOn = raw['metOn'];
  const dismissals = readDismissals(raw['dismissals']);
  if (dismissals) out.dismissals = dismissals;
  return out;
}

/** Spend-cap window; `'day'` when absent. */
export function spendPeriod(goal: Goal): SpendPeriod {
  return readGoalMeta(goal).period ?? 'day';
}

/** True when the goal is a per-day cap: daily_cap, taper, or a daily spend cap. */
export function isDailyCapLike(goal: Goal): boolean {
  if (goal.type === 'daily_cap' || goal.type === 'taper') return true;
  return goal.type === 'spend_cap_daily' && spendPeriod(goal) === 'day';
}

/** Date the current step began: the last step's `from`, else the goal's start date. */
export function currentStepStart(goal: Goal): string {
  const steps = readGoalMeta(goal).steps;
  return steps ? steps[steps.length - 1].from : goal.startDate;
}

/** New steps array with `{cap, from, reason}` appended, seeding the start step if there is none. */
export function appendStep(goal: Goal, cap: number, from: string, reason: StepReason): GoalStep[] {
  const existing = readGoalMeta(goal).steps ?? [
    { cap: goal.targetValue, from: goal.startDate, reason: 'start' as const },
  ];
  return [...existing, { cap, from, reason }];
}

/** The cap in force on `ymd`; null before the goal started. */
export function capOn(goal: Goal, ymd: string): number | null {
  if (ymd < goal.startDate) return null;
  const steps = readGoalMeta(goal).steps;
  if (!steps) return goal.targetValue;
  let cap = goal.targetValue;
  let found = false;
  for (const s of steps) {
    if (s.from <= ymd) {
      cap = s.cap;
      found = true;
    }
  }
  return found ? cap : goal.targetValue;
}

// Per-day adherence, hold detection and the four-way goal state. Pure: no I/O, no clock.

import type { CigaretteLog, Goal } from '@/types';
import { dayShift, spendOn, sticksOn } from './calc';
import { evaluateGoal } from './goals';
import {
  AT_RISK_RATIO,
  HOLD_DAYS,
  HOLD_MIN_LOGGED_DAYS,
  LOOKBACK_DAYS,
  OFF_TRACK_OVER_DAYS,
  capOn,
  currentStepStart,
  isDailyCapLike,
  readGoalMeta,
} from './goalMeta';

export type GoalState = 'on_track' | 'at_risk' | 'off_track' | 'met';
export interface DayAdherence {
  date: string;
  used: number;
  cap: number;
  over: boolean;
  logged: boolean;
}
export interface HoldStatus {
  runDays: number;
  isHeld: boolean;
}

const MAX_HOLD_LOOKBACK_DAYS = 90;

function dayAdherenceOn(goal: Goal, logs: CigaretteLog[], date: string): DayAdherence {
  const used = goal.type === 'spend_cap_daily' ? spendOn(logs, date) : sticksOn(logs, date);
  const cap = capOn(goal, date) ?? goal.targetValue;
  return { date, used, cap, over: used > cap, logged: logs.some((l) => l.localDate === date) };
}

/**
 * The last `days` days ending `today`, ascending, each judged against the cap in force that day.
 * Days before the goal started are omitted, so a new goal has a short record.
 */
export function dailyAdherence(
  goal: Goal,
  logs: CigaretteLog[],
  today: string,
  days = LOOKBACK_DAYS,
): DayAdherence[] {
  return Array.from({ length: days }, (_, i) => dayShift(today, -(days - 1 - i)))
    .filter((date) => date >= goal.startDate)
    .map((date) => dayAdherenceOn(goal, logs, date));
}

/**
 * Consecutive within-cap days ending yesterday (never before the current step),
 * and whether that run is a "hold": long enough and logged often enough to trust.
 */
export function holdStatus(goal: Goal, logs: CigaretteLog[], today: string): HoldStatus {
  if (!isDailyCapLike(goal)) return { runDays: 0, isHeld: false };
  const stepStart = currentStepStart(goal);
  let runDays = 0;
  let loggedInWindow = 0;
  for (let i = 1; i <= MAX_HOLD_LOOKBACK_DAYS; i++) {
    const day = dayAdherenceOn(goal, logs, dayShift(today, -i));
    if (day.date < stepStart || day.over) break;
    runDays++;
    if (i <= HOLD_DAYS && day.logged) loggedInWindow++;
  }
  return {
    runDays,
    isHeld: runDays >= HOLD_DAYS && loggedInWindow >= HOLD_MIN_LOGGED_DAYS,
  };
}

function dailyCapState(goal: Goal, logs: CigaretteLog[], today: string): GoalState {
  const week = dailyAdherence(goal, logs, today);
  const over = week.filter((d) => d.over).length;
  if (over >= OFF_TRACK_OVER_DAYS) return 'off_track';
  if (over >= 1) return 'at_risk';
  const t = week[week.length - 1];
  if (!t) return 'on_track'; // goal starts after today
  // `used > 0` keeps a zero cap with nothing smoked from reading as at risk.
  if (t.used > 0 && t.used >= t.cap * AT_RISK_RATIO) return 'at_risk';
  return readGoalMeta(goal).metOn ? 'met' : 'on_track';
}

export function goalState(goal: Goal, logs: CigaretteLog[], today: string): GoalState {
  if (isDailyCapLike(goal)) return dailyCapState(goal, logs, today);
  const p = evaluateGoal(goal, logs, today);
  if (!p.isOnTrack) return 'off_track';
  return p.atRisk ? 'at_risk' : 'on_track';
}

/** The one-line, money-free caption for a goal's state; shared by web and mobile. */
export function stateCaption(state: GoalState, overDays: number, heldDays: number): string {
  switch (state) {
    case 'on_track':
      return 'On track';
    case 'at_risk':
      if (overDays === 0) return 'At risk · close to the cap';
      return overDays === 1
        ? `At risk · over once in the last ${LOOKBACK_DAYS} days`
        : `At risk · over ${overDays} times in the last ${LOOKBACK_DAYS} days`;
    case 'off_track':
      // ponytail: goals without a daily record (weekly cap) report 0 over days; say so plainly.
      return overDays === 0 ? 'Off track' : `Off track · over ${overDays} of the last ${LOOKBACK_DAYS} days`;
    case 'met':
      return `Met · held ${heldDays} days`;
  }
}

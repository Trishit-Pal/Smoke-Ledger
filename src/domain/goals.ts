// Goal evaluator. Pure functions, side-effect free.

import type { CigaretteLog, Goal } from '@/types';
import { rollingAvgSticks, sticksOn, spendOn, dayShift } from './calc';
import { startOfWeekIst, todayIst, daysBetween } from '@/lib/date';
import { formatMoney } from '@/lib/format';
import type { CurrencyCode } from '@/lib/regions';

export interface EvaluateGoalMoney {
  currency?: CurrencyCode;
  locale?: string;
}

export interface GoalProgress {
  goalId: string;
  label: string;
  valueCurrent: number;
  valueTarget: number;
  unit: 'sticks' | 'inr' | 'days' | 'percent';
  /** 0..100 where 100 means "all the way to the target". */
  percent: number;
  /** Convention: true = goal is currently met or trending well. */
  isOnTrack: boolean;
  /** Optional softer signal between 80% utilization and breach. */
  atRisk: boolean;
  /**
   * Remaining headroom in the unit. For caps this is `target - current`;
   * for reduction goals it is `current - target`; for quit_date it is days.
   */
  remaining: number;
  explanation: string;
}

const WEEK_DAYS = 7;
const REDUCTION_BASELINE_WINDOW = 30; // days

function clampPercent(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n * 10) / 10));
}

export function evaluateGoal(
  goal: Goal,
  logs: CigaretteLog[],
  today = todayIst(),
  money?: EvaluateGoalMoney,
): GoalProgress {
  switch (goal.type) {
    case 'daily_cap': {
      const used = sticksOn(logs, today);
      const target = goal.targetValue;
      const percent = target > 0 ? clampPercent((used / target) * 100) : 0;
      return {
        goalId: goal.id,
        label: `Daily cap: ${target}/day`,
        valueCurrent: used,
        valueTarget: target,
        unit: 'sticks',
        percent,
        isOnTrack: used <= target,
        atRisk: used >= target * 0.8 && used < target,
        remaining: Math.max(0, target - used),
        explanation: `You have smoked ${used} of ${target} today.`,
      };
    }

    case 'spend_cap_daily': {
      const used = spendOn(logs, today);
      const target = goal.targetValue;
      const percent = target > 0 ? clampPercent((used / target) * 100) : 0;
      const currency = money?.currency ?? 'INR';
      const targetLabel = formatMoney(target, currency, { locale: money?.locale });
      const usedLabel = formatMoney(used, currency, { locale: money?.locale });
      return {
        goalId: goal.id,
        label: `Daily spend cap: ${targetLabel}`,
        valueCurrent: used,
        valueTarget: target,
        unit: 'inr',
        percent,
        isOnTrack: used <= target,
        atRisk: used >= target * 0.8 && used < target,
        remaining: Math.max(0, target - used),
        explanation: `You have spent ${usedLabel} of ${targetLabel} today.`,
      };
    }

    case 'no_smoke_window': {
      const start = Number((goal.meta?.['startHour'] as number) ?? 0);
      const end = Number((goal.meta?.['endHour'] as number) ?? 0);
      // Overnight windows (start >= end, e.g. 22:00 - 06:00) wrap midnight.
      const inWindow = (hour: number) => (start < end ? hour >= start && hour < end : hour >= start || hour < end);
      const inside = logs.filter((l) => l.localDate === today && inWindow(l.localHour));
      const used = inside.reduce((a, l) => a + l.quantity, 0);
      return {
        goalId: goal.id,
        label: `No-smoke window ${String(start).padStart(2, '0')}:00–${String(end).padStart(2, '0')}:00`,
        valueCurrent: used,
        valueTarget: 0,
        unit: 'sticks',
        percent: used === 0 ? 100 : 0,
        isOnTrack: used === 0,
        atRisk: false,
        remaining: 0,
        explanation:
          used === 0
            ? 'No cigarettes in this window today.'
            : `${used} smoked inside your no-smoke window today.`,
      };
    }

    case 'weekly_target': {
      // Target = max sticks allowed for the calendar week (Mon..today).
      const weekStart = startOfWeekIst(today);
      let used = 0;
      let cur = weekStart;
      while (cur <= today) {
        used += sticksOn(logs, cur);
        cur = dayShift(cur, 1);
      }
      const target = goal.targetValue;
      const percent = target > 0 ? clampPercent((used / target) * 100) : 0;
      return {
        goalId: goal.id,
        label: `Weekly cap: ${target}/week`,
        valueCurrent: used,
        valueTarget: target,
        unit: 'sticks',
        percent,
        isOnTrack: used <= target,
        atRisk: used >= target * 0.8 && used < target,
        remaining: Math.max(0, target - used),
        explanation: `${used} smoked this week (of ${target}).`,
      };
    }

    case 'reduction_target': {
      // Target = new daily rolling average. Baseline locked at goal creation
      // (`current_baseline`) or computed from a rolling baseline window if
      // the goal pre-dates the column.
      const target = goal.targetValue;
      const baseline =
        goal.currentBaseline != null
          ? goal.currentBaseline
          : rollingAvgSticks(logs, dayShift(goal.startDate, -1), REDUCTION_BASELINE_WINDOW);
      const current = rollingAvgSticks(logs, today, WEEK_DAYS);
      // Progress: 0% at baseline, 100% at target (or better).
      const span = baseline - target;
      const traveled = baseline - current;
      const percent =
        span <= 0 ? (current <= target ? 100 : 0) : clampPercent((traveled / span) * 100);
      const onTrack = current <= target || percent >= 50;
      return {
        goalId: goal.id,
        label: `Reduce to ${target}/day (from ${baseline.toFixed(1)})`,
        valueCurrent: Math.round(current * 10) / 10,
        valueTarget: target,
        unit: 'sticks',
        percent,
        isOnTrack: onTrack,
        atRisk: !onTrack,
        remaining: Math.max(0, Math.round((current - target) * 10) / 10),
        explanation:
          current <= target
            ? `Smoking ${current.toFixed(1)}/day — at or below target.`
            : `Smoking ${current.toFixed(1)}/day (target ${target}, baseline ${baseline.toFixed(1)}).`,
      };
    }

    case 'quit_date': {
      // Target = quit date (stored in goal.endDate). targetValue is days until quit.
      const quitDate = goal.endDate ?? goal.startDate;
      const totalDays = Math.max(1, daysBetween(goal.startDate, quitDate));
      const remainingDays = Math.max(0, daysBetween(today, quitDate));
      const elapsedDays = Math.max(0, totalDays - remainingDays);
      const percent = clampPercent((elapsedDays / totalDays) * 100);
      // "On track" if the rolling 7-day average is trending below baseline.
      const baseline = goal.currentBaseline ?? rollingAvgSticks(logs, goal.startDate, WEEK_DAYS);
      const current = rollingAvgSticks(logs, today, WEEK_DAYS);
      const onTrack = baseline === 0 ? current === 0 : current <= baseline;
      return {
        goalId: goal.id,
        label: `Quit by ${quitDate}`,
        valueCurrent: elapsedDays,
        valueTarget: totalDays,
        unit: 'days',
        percent,
        isOnTrack: onTrack,
        atRisk: !onTrack && remainingDays <= 7,
        remaining: remainingDays,
        explanation:
          remainingDays === 0
            ? 'Quit day reached.'
            : `${remainingDays} day${remainingDays === 1 ? '' : 's'} to quit (~${current.toFixed(1)}/day now).`,
      };
    }
  }
}

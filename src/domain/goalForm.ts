// Goal form helpers. Pure, framework-free — shared by the web and mobile goal
// forms and unit-tested. Maps UI form state to repository create/update inputs
// per goal type, with cheap pre-validation before the Zod schema runs.

import type { CigaretteLog, GoalType } from '@/types';
import type { GoalPatchInput } from '@/lib/validation';
import { rollingAvgSticks } from './calc';
import { daysUntil, todayIst } from '@/lib/date';

const BASELINE_WINDOW_DAYS = 30;

export interface GoalTypeMeta {
  type: GoalType;
  label: string;
  /** Short helper text describing what the target means. */
  blurb: string;
  /** Unit shown next to the numeric target input, or null when the type has no scalar target. */
  targetUnit: string | null;
}

/** Canonical display order + copy for the goal type picker (single source for both platforms). */
export const GOAL_TYPE_META: readonly GoalTypeMeta[] = [
  { type: 'daily_cap', label: 'Daily cap', blurb: 'Stay under a number of sticks each day.', targetUnit: 'sticks/day' },
  { type: 'weekly_target', label: 'Weekly cap', blurb: 'Stay under a number of sticks each week.', targetUnit: 'sticks/week' },
  { type: 'spend_cap_daily', label: 'Daily spend cap', blurb: 'Keep daily spend under a rupee limit.', targetUnit: '₹/day' },
  { type: 'reduction_target', label: 'Reduce average', blurb: 'Bring your daily average down to a target.', targetUnit: 'sticks/day' },
  { type: 'no_smoke_window', label: 'No-smoke window', blurb: 'Avoid smoking during set hours.', targetUnit: null },
  { type: 'quit_date', label: 'Quit by a date', blurb: 'Work toward a quit date.', targetUnit: null },
];

/** Form state captured by the goal form UI. Web and mobile share this shape. */
export interface GoalFormState {
  type: GoalType;
  /** Numeric target as typed (daily_cap, weekly_target, spend_cap_daily, reduction_target). */
  target: string;
  /** Reduction/quit baseline as typed; blank = derive from recent logs. */
  baseline: string;
  /** No-smoke window hours (0–23). */
  startHour: number;
  endHour: number;
  /** Quit date (YYYY-MM-DD) for quit_date goals. */
  quitDate: string;
}

/** Repository create input (structurally matches `createGoal`). */
export interface GoalCreateInput {
  type: GoalType;
  targetValue: number;
  currentBaseline?: number | null;
  startDate?: string;
  endDate?: string | null;
  meta?: Record<string, unknown> | null;
}

export type GoalPayloadResult =
  | { ok: true; payload: GoalCreateInput }
  | { ok: false; error: string };

export type GoalPatchResult =
  | { ok: true; patch: GoalPatchInput }
  | { ok: false; error: string };

/** Empty form state for a given type (used to seed a fresh create form). */
export function emptyGoalForm(type: GoalType = 'daily_cap'): GoalFormState {
  return { type, target: '', baseline: '', startHour: 22, endHour: 6, quitDate: '' };
}

/** Rounded 30-day rolling daily average — the default baseline for reduction/quit goals. */
export function deriveReductionBaseline(logs: CigaretteLog[], today: string = todayIst()): number {
  return Math.round(rollingAvgSticks(logs, today, BASELINE_WINDOW_DAYS) * 10) / 10;
}

function isHour(h: number): boolean {
  return Number.isInteger(h) && h >= 0 && h <= 23;
}

/**
 * Build a `createGoal` payload from form state. Returns a discriminated result so
 * the UI can show a friendly message before the Zod schema (and DB) reject it.
 */
export function buildGoalPayload(
  form: GoalFormState,
  logs: CigaretteLog[],
  today: string = todayIst(),
): GoalPayloadResult {
  switch (form.type) {
    case 'daily_cap':
    case 'weekly_target':
    case 'spend_cap_daily': {
      const v = Number(form.target);
      if (!Number.isFinite(v) || v <= 0) return { ok: false, error: 'Enter a target greater than 0.' };
      return { ok: true, payload: { type: form.type, targetValue: v } };
    }

    case 'reduction_target': {
      const v = Number(form.target);
      if (!Number.isFinite(v) || v <= 0) return { ok: false, error: 'Enter a target greater than 0.' };
      const baseline = form.baseline.trim() ? Number(form.baseline) : deriveReductionBaseline(logs, today);
      if (!Number.isFinite(baseline) || baseline <= 0) {
        return { ok: false, error: 'Set a baseline — log a few days first or enter it manually.' };
      }
      if (v >= baseline) return { ok: false, error: 'Target should be below your baseline.' };
      return { ok: true, payload: { type: form.type, targetValue: v, currentBaseline: baseline } };
    }

    case 'no_smoke_window': {
      if (!isHour(form.startHour) || !isHour(form.endHour)) {
        return { ok: false, error: 'Choose start and end hours (0–23).' };
      }
      if (form.startHour === form.endHour) return { ok: false, error: 'Start and end hours must differ.' };
      // targetValue is unused by the evaluator for this type, but GoalSchema requires
      // a positive value, so we store an inert 1. Window bounds live in meta.
      return {
        ok: true,
        payload: { type: form.type, targetValue: 1, meta: { startHour: form.startHour, endHour: form.endHour } },
      };
    }

    case 'quit_date': {
      if (!form.quitDate) return { ok: false, error: 'Pick a quit date.' };
      const days = daysUntil(today, form.quitDate);
      if (days <= 0) return { ok: false, error: 'Choose a future date.' };
      const baseline = form.baseline.trim() ? Number(form.baseline) : deriveReductionBaseline(logs, today);
      return {
        ok: true,
        payload: {
          type: form.type,
          targetValue: days,
          endDate: form.quitDate,
          currentBaseline: Number.isFinite(baseline) && baseline > 0 ? baseline : null,
        },
      };
    }
  }
}

/**
 * Build an `updateGoal` patch from form state — the editable fields only
 * (type and startDate are immutable). For quit_date, targetValue is recomputed
 * from the edited date.
 */
export function buildGoalPatch(
  form: GoalFormState,
  logs: CigaretteLog[],
  today: string = todayIst(),
): GoalPatchResult {
  const result = buildGoalPayload(form, logs, today);
  if (!result.ok) return result;
  const { type: _type, startDate: _startDate, ...patch } = result.payload;
  return { ok: true, patch };
}

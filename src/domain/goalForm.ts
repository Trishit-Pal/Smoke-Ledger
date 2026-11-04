// Goal form helpers. Pure, framework-free — shared by the web and mobile goal
// forms and unit-tested. Maps UI form state to repository create/update inputs
// per goal type, with cheap pre-validation before the Zod schema runs.

import type { CigaretteLog, Goal, GoalType } from '@/types';
import { maxTargetFor, type GoalPatchInput } from '@/lib/validation';
import { rollingAvgSticks } from './calc';
import { daysUntil, todayIst } from '@/lib/date';
import { localeForCountry } from '@/lib/regions';
import {
  appendStep,
  capOn,
  isDailyCapLike,
  readGoalMeta,
  type DismissKind,
  type SpendPeriod,
} from './goalMeta';
import type { Proposal } from './goalProposals';

const BASELINE_WINDOW_DAYS = 30;

export interface GoalTypeMeta {
  type: GoalType;
  label: string;
  /** Short helper text describing what the target means. */
  blurb: string;
  /** Unit shown next to the numeric target input, or null when the type has no scalar target. */
  targetUnit: string | null;
  /** False for types that exist on old goals but can no longer be created. */
  creatable: boolean;
}

/** Canonical display order + copy for the goal type picker (single source for both platforms). */
export const GOAL_TYPE_META: readonly GoalTypeMeta[] = [
  { type: 'daily_cap', label: 'Daily cap', blurb: 'Stay under a number of sticks each day.', targetUnit: 'sticks/day', creatable: true },
  { type: 'taper', label: 'Taper', blurb: 'Step the daily cap down every two weeks, each step offered first.', targetUnit: 'sticks/day', creatable: true },
  { type: 'quit_date', label: 'Quit by a date', blurb: 'Work toward a quit date.', targetUnit: null, creatable: true },
  { type: 'spend_cap_daily', label: 'Spend cap', blurb: 'Keep spend under a limit for the day, week, or month.', targetUnit: '₹', creatable: true },
  { type: 'weekly_target', label: 'Weekly cap', blurb: 'Stay under a number of sticks each week.', targetUnit: 'sticks/week', creatable: true },
  { type: 'no_smoke_window', label: 'No-smoke window', blurb: 'Avoid smoking during set hours.', targetUnit: null, creatable: true },
  { type: 'reduction_target', label: 'Reduce average', blurb: 'Bring your daily average down to a target.', targetUnit: 'sticks/day', creatable: false },
];

/** The goal types a user can start today (excludes legacy-only types). */
export function creatableGoalTypes(): readonly GoalTypeMeta[] {
  return GOAL_TYPE_META.filter((m) => m.creatable);
}

/**
 * Generic, money-free display label for a goal type. Safe to show under discreet
 * mode (unlike `evaluateGoal().label`, which embeds the ₹ target for spend caps).
 */
export function goalTypeLabel(type: GoalType): string {
  return GOAL_TYPE_META.find((m) => m.type === type)?.label ?? 'Goal';
}

/**
 * The existing goal of the same type that blocks creating a new one. A user may
 * hold at most ONE active-or-paused goal per type; a same-type goal can only be
 * created again once the prior is completed or abandoned. Editing is unaffected.
 * Shared by both platforms so the rule reads identically on web and mobile.
 */
export function blockingSameTypeGoal(type: GoalType, goals: readonly Goal[]): Goal | null {
  return (
    goals.find((g) => g.type === type && (g.status === 'active' || g.status === 'paused')) ?? null
  );
}

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
  /** Spend-cap window (spend_cap_daily only). */
  period: SpendPeriod;
  /** Taper end-point as typed (taper only). */
  finalTarget: string;
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
  return { type, target: '', baseline: '', startHour: 22, endHour: 6, quitDate: '', period: 'day', finalTarget: '' };
}

/** Hours fall back to the default no-smoke window when absent/invalid. */
const DEFAULT_START_HOUR = 22;
const DEFAULT_END_HOUR = 6;

/**
 * Seed form state from an existing goal for editing — the inverse of
 * `buildGoalPayload`'s field mapping. Only the four scalar-target types expose a
 * numeric `target`; `quit_date` and `no_smoke_window` derive their stored value
 * from the date/window instead, so their `target` stays blank. Shared by both
 * the web and mobile edit forms so the prefill never drifts between platforms.
 */
export function goalToFormState(goal: Goal): GoalFormState {
  const meta = readGoalMeta(goal);
  const hasScalarTarget =
    goal.type === 'daily_cap' ||
    goal.type === 'taper' ||
    goal.type === 'weekly_target' ||
    goal.type === 'spend_cap_daily' ||
    goal.type === 'reduction_target';
  return {
    type: goal.type,
    target: hasScalarTarget ? String(goal.targetValue) : '',
    baseline: goal.currentBaseline != null ? String(goal.currentBaseline) : '',
    startHour: meta.startHour ?? DEFAULT_START_HOUR,
    endHour: meta.endHour ?? DEFAULT_END_HOUR,
    quitDate: goal.endDate ?? '',
    period: meta.period ?? 'day',
    finalTarget: meta.finalTarget !== undefined ? String(meta.finalTarget) : '',
  };
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
  locale: string = localeForCountry(null),
): GoalPayloadResult {
  switch (form.type) {
    case 'daily_cap':
    case 'weekly_target':
    case 'spend_cap_daily': {
      const v = Number(form.target);
      if (!Number.isFinite(v) || v <= 0) return { ok: false, error: 'Enter a target greater than 0.' };
      const max = maxTargetFor(form.type);
      // The max is a bare count or amount, so only the reader's digit grouping applies (en-IN: 1,00,000).
      if (v > max) return { ok: false, error: `Enter a target no higher than ${max.toLocaleString(locale)}.` };
      if (form.type === 'spend_cap_daily') {
        return { ok: true, payload: { type: form.type, targetValue: v, meta: { period: form.period } } };
      }
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

    case 'taper': {
      const cap = Number(form.target);
      if (!Number.isFinite(cap) || cap <= 0) return { ok: false, error: 'Enter a starting cap greater than 0.' };
      const final = Number(form.finalTarget);
      if (!Number.isFinite(final) || final <= 0) return { ok: false, error: 'Enter a final target greater than 0.' };
      if (final >= cap) return { ok: false, error: 'The final target should be below the starting cap.' };
      return {
        ok: true,
        payload: {
          type: 'taper',
          targetValue: cap,
          currentBaseline: deriveReductionBaseline(logs, today) || null,
          meta: { finalTarget: final, steps: [{ cap, from: today, reason: 'start' }] },
        },
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
 * from the edited date. With `existing`, the patch meta layers the form's
 * type-specific meta over the goal's current meta (so dismissals etc. survive),
 * and changing a daily-cap-like target appends an `edit` step and clears `metOn`.
 */
export function buildGoalPatch(
  form: GoalFormState,
  logs: CigaretteLog[],
  today: string = todayIst(),
  existing?: Goal,
  locale?: string,
): GoalPatchResult {
  const result = buildGoalPayload(form, logs, today, locale);
  if (!result.ok) return result;
  const { type: _type, startDate: _startDate, ...patch } = result.payload;
  if (!existing) return { ok: true, patch };

  const { metOn, ...current } = readGoalMeta(existing);
  // A taper's steps are history: the form's fresh start step must not replace them.
  const { steps: _freshSteps, ...formMeta } = patch.meta ?? {};
  const meta: Record<string, unknown> = { ...current, ...formMeta };
  const changed = isDailyCapLike(existing) && patch.targetValue !== existing.targetValue;
  if (changed) meta['steps'] = appendStep(existing, patch.targetValue, today, 'edit');
  else if (metOn !== undefined) meta['metOn'] = metOn;
  // A taper edit keeps the baseline it started from.
  if (existing.type === 'taper') delete patch.currentBaseline;
  return { ok: true, patch: Object.keys(meta).length > 0 ? { ...patch, meta } : patch };
}

/** Patch that applies an accepted proposal: new cap, a step in the history, `metOn` cleared. */
export function acceptProposalPatch(goal: Goal, p: Proposal, today: string): GoalPatchInput {
  const { metOn: _metOn, ...meta } = readGoalMeta(goal);
  return {
    targetValue: p.value,
    meta: { ...meta, steps: appendStep(goal, p.value, today, p.kind === 'reanchor' ? 'reanchor' : 'next') },
  };
}

/** Patch that snoozes a proposal kind by stamping today into `meta.dismissals`. */
export function dismissProposalPatch(goal: Goal, kind: DismissKind, today: string): GoalPatchInput {
  const meta = readGoalMeta(goal);
  return { meta: { ...meta, dismissals: { ...meta.dismissals, [kind]: today } } };
}

/** Form values to prefill when the user chooses to start from a proposal. */
export function proposalToForm(p: Proposal): Partial<GoalFormState> {
  return { type: p.type, target: String(p.value), period: p.period ?? 'day', quitDate: p.date ?? '' };
}

/** The cap in force on each date (null before the goal started) — for charting. */
export function capSeries(goal: Goal, dates: readonly string[]): (number | null)[] {
  return dates.map((d) => capOn(goal, d));
}

// Plans and applies the automatic goal status changes (quit day reached, taper
// finished, cap held). Pure: no I/O, no clock; `today` is a YYYY-MM-DD string.

import type { CigaretteLog, Goal } from '@/types';
import { holdStatus } from './goalAdherence';
import { isDailyCapLike, readGoalMeta, type GoalMeta } from './goalMeta';

export type GoalTransition =
  | { goalId: string; kind: 'auto_complete'; reason: 'quit_date' | 'taper_done' }
  | { goalId: string; kind: 'mark_met'; meta: GoalMeta };

function planOne(goal: Goal, logs: CigaretteLog[], today: string): GoalTransition | null {
  if (goal.status !== 'active') return null;
  if (goal.type === 'quit_date') {
    return goal.endDate && today >= goal.endDate
      ? { goalId: goal.id, kind: 'auto_complete', reason: 'quit_date' }
      : null;
  }
  const meta = readGoalMeta(goal);
  if (!isDailyCapLike(goal) || meta.metOn || !holdStatus(goal, logs, today).isHeld) return null;
  if (goal.type === 'taper' && meta.finalTarget !== undefined && goal.targetValue <= meta.finalTarget) {
    return { goalId: goal.id, kind: 'auto_complete', reason: 'taper_done' };
  }
  return { goalId: goal.id, kind: 'mark_met', meta: { ...meta, metOn: today } };
}

/** At most one transition per active goal; empty when nothing is due. */
export function planGoalTransitions(
  goals: Goal[],
  logs: CigaretteLog[],
  today: string,
): GoalTransition[] {
  return goals.flatMap((g) => planOne(g, logs, today) ?? []);
}

/** Returns new goals with `transitions` applied; inputs are never mutated. */
export function applyGoalTransitions(
  goals: Goal[],
  transitions: GoalTransition[],
  nowIso: string,
): Goal[] {
  return goals.map((g) => {
    const t = transitions.find((x) => x.goalId === g.id);
    if (!t) return g;
    return t.kind === 'auto_complete'
      ? { ...g, status: 'completed', completedAt: nowIso }
      : { ...g, meta: { ...t.meta } };
  });
}

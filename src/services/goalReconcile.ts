// Shared by web and mobile: plans goal transitions and persists them through an
// injected writer, so it never imports a repository.

import type { CigaretteLog, Goal } from '@/types';
import type { GoalPatchInput } from '@/lib/validation';
import {
  applyGoalTransitions,
  planGoalTransitions,
  type GoalTransition,
} from '@/domain/goalTransitions';

export interface GoalWriter {
  setGoalStatus: (id: string, status: Goal['status']) => Promise<void>;
  updateGoal: (id: string, patch: GoalPatchInput) => Promise<unknown>;
}

function write(writer: GoalWriter, t: GoalTransition): Promise<unknown> {
  return t.kind === 'auto_complete'
    ? writer.setGoalStatus(t.goalId, 'completed')
    : writer.updateGoal(t.goalId, { meta: { ...t.meta } });
}

/**
 * Writes each due transition in order. A rejected write is skipped (it stays out
 * of `applied`) so one failure never blocks the rest or throws.
 */
export async function reconcileGoals(
  goals: Goal[],
  logs: CigaretteLog[],
  today: string,
  writer: GoalWriter,
  nowIso: string = new Date().toISOString(),
): Promise<{ goals: Goal[]; applied: GoalTransition[] }> {
  const applied: GoalTransition[] = [];
  for (const t of planGoalTransitions(goals, logs, today)) {
    try {
      await write(writer, t);
      applied.push(t);
    } catch {
      // ponytail: skipped; the next reconcile re-plans it, so no retry queue.
    }
  }
  return { goals: applyGoalTransitions(goals, applied, nowIso), applied };
}

/** The quiet moment to show when a goal completes; null when there is nothing to say. */
export function completionMoment(t: GoalTransition): { title: string; body: string } | null {
  if (t.kind !== 'auto_complete') return null;
  return t.reason === 'quit_date'
    ? { title: 'Quit day.', body: 'The date you set has arrived. The ledger marks it kept.' }
    : { title: 'Tapered.', body: 'Every step down was yours to accept. All of them, kept.' };
}

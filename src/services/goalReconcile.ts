// Shared by web and mobile: plans goal transitions and persists them through an
// injected writer, so it never imports a repository.

import type { CigaretteLog, Goal } from '@/types';
import {
  applyGoalTransitions,
  planGoalTransitions,
  type GoalTransition,
} from '@/domain/goalTransitions';

export interface GoalWriter {
  /** Completes the goal only while it is still active; false when no row changed. */
  completeIfActive: (id: string) => Promise<boolean>;
  /** Marks a cap met on the current row; false when the goal is gone, inactive, or its cap moved. */
  markMet: (id: string, metOn: string, targetValue: number) => Promise<boolean>;
}

export interface ReconcileFailure {
  transition: GoalTransition;
  error: unknown;
}
export interface ReconcileResult {
  goals: Goal[];
  applied: GoalTransition[];
  /** Planned from a stale snapshot: the server refused (goal changed elsewhere). Not an error, no moment. */
  skipped: GoalTransition[];
  failed: ReconcileFailure[];
}

function write(writer: GoalWriter, t: GoalTransition, goal: Goal): Promise<boolean> {
  return t.kind === 'auto_complete'
    ? writer.completeIfActive(t.goalId)
    : writer.markMet(t.goalId, t.meta.metOn ?? '', goal.targetValue);
}

/**
 * Writes each due transition in order. A rejected write stays out of `applied` and
 * is reported in `failed`, so one failure never blocks the rest or throws. A write the
 * server declines (the goal changed on another device) lands in `skipped`, not `applied`.
 */
export async function reconcileGoals(
  goals: Goal[],
  logs: CigaretteLog[],
  today: string,
  writer: GoalWriter,
  nowIso: string = new Date().toISOString(),
): Promise<ReconcileResult> {
  const applied: GoalTransition[] = [];
  const skipped: GoalTransition[] = [];
  const failed: ReconcileFailure[] = [];
  for (const t of planGoalTransitions(goals, logs, today)) {
    const goal = goals.find((g) => g.id === t.goalId);
    if (!goal) continue;
    try {
      (await write(writer, t, goal) ? applied : skipped).push(t);
    } catch (error: unknown) {
      // ponytail: failures are reported, not dropped; no retry queue, the next reconcile re-plans them.
      failed.push({ transition: t, error });
    }
  }
  return { goals: applyGoalTransitions(goals, applied, nowIso), applied, skipped, failed };
}

/** The quiet moment to show when a goal completes; null when there is nothing to say. */
export function completionMoment(t: GoalTransition): { title: string; body: string } | null {
  if (t.kind !== 'auto_complete') return null;
  return t.reason === 'quit_date'
    ? { title: 'Quit day.', body: 'The date you set has arrived. The ledger marks it kept.' }
    : { title: 'Tapered.', body: 'Every step down was yours to accept. All of them, kept.' };
}

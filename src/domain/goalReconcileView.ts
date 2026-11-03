// Pure decisions behind useGoalReconcile (kept out of the hook so they are unit-testable and
// importable from any page without pulling in a route module).

import { applyGoalTransitions, type GoalTransition } from '@/domain/goalTransitions';
import type { Goal } from '@/types';

/** Page-level notice when a due goal update could not be written. */
export const RECONCILE_FAILED_NOTICE = 'Some goal updates could not be saved. They will be retried next time.';

/** Identity of a goals snapshot as far as reconcile cares: which goals, in which status. */
export function reconcileKey(goals: readonly Goal[]): string {
  return goals
    .map((g) => `${g.id}:${g.status}`)
    .sort()
    .join('|');
}

/**
 * The goals to render: server truth with every due transition applied, except those whose
 * write failed. A failed transition must not read as done while the database still holds
 * the old state.
 */
export function renderedGoals(
  goals: Goal[],
  planned: GoalTransition[],
  failedIds: ReadonlySet<string>,
  nowIso: string,
): Goal[] {
  return applyGoalTransitions(
    goals,
    planned.filter((t) => !failedIds.has(t.goalId)),
    nowIso,
  );
}

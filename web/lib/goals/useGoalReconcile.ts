'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { safeRevalidateAppViews as revalidateAppViews } from '@web/lib/safeRevalidate';
import { completeGoalIfActive, markGoalMet } from '@/db/repositories/goals';
import { planGoalTransitions } from '@/domain/goalTransitions';
import { completionMoment, reconcileGoals } from '@/services/goalReconcile';
import { track } from '@/services/analytics';
import { AnalyticsEvents } from '@/constants/events';
import { dispatchGoalCompletion } from '@web/lib/character/mood';
import { RECONCILE_FAILED_NOTICE, reconcileKey, renderedGoals } from './reconcileView';
import type { CigaretteLog, Goal } from '@/types';

export interface GoalReconcile {
  /** The goals with each due transition applied, except any whose write failed. */
  view: Goal[];
  /** Set when a due update could not be saved; null otherwise. */
  failedNotice: string | null;
}

const WRITER = { completeIfActive: completeGoalIfActive, markMet: markGoalMet };

/**
 * Safe to mount on two pages at once (Home and Goals): the writes are idempotent (a fixed
 * status, the same metOn), the single GoalMoment instance replaces its state, and at worst
 * analytics double-counts a completion in that narrow race.
 *
 * Writes the goal transitions that have come due (met, auto-complete) once per distinct
 * goals snapshot, announces completions, then refreshes the page. After the write the
 * planner is empty, so the refreshed render plans nothing and the loop ends.
 */
export function useGoalReconcile(goals: Goal[], logs: CigaretteLog[], today: string): GoalReconcile {
  const router = useRouter();
  const [failedNotice, setFailedNotice] = React.useState<string | null>(null);
  const planned = React.useMemo(() => planGoalTransitions(goals, logs, today), [goals, logs, today]);
  // Goals whose write failed: the database still holds the old state, so the view must too.
  const [failedIds, setFailedIds] = React.useState<ReadonlySet<string>>(() => new Set());
  const view = React.useMemo(
    () => renderedGoals(goals, planned, failedIds, new Date().toISOString()),
    [goals, planned, failedIds],
  );

  // Keyed by ids+statuses (not by array identity) so strict-mode's double effect and a
  // refresh that returns the same goals never write twice.
  const lastKey = React.useRef<string | null>(null);
  const key = reconcileKey(goals);
  React.useEffect(() => {
    if (lastKey.current === key) return;
    lastKey.current = key;
    if (planned.length === 0) return;
    void (async () => {
      const { applied, skipped, failed } = await reconcileGoals(goals, logs, today, WRITER);
      // A skipped write means the goal changed elsewhere: keep it as stored until the refresh below.
      setFailedIds(new Set([...failed.map((f) => f.transition.goalId), ...skipped.map((t) => t.goalId)]));
      setFailedNotice(failed.length > 0 ? RECONCILE_FAILED_NOTICE : null);
      for (const t of applied) {
        const moment = completionMoment(t);
        const goal = goals.find((g) => g.id === t.goalId);
        if (!moment || !goal || t.kind !== 'auto_complete') continue;
        dispatchGoalCompletion(moment);
        void track(AnalyticsEvents.GOAL_AUTO_COMPLETED, { type: goal.type, reason: t.reason });
      }
      if (applied.length === 0 && skipped.length === 0) return;
      await revalidateAppViews();
      router.refresh();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once per goals snapshot (key), by design
  }, [key]);

  return { view, failedNotice };
}

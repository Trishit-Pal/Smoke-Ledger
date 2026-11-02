import type { GoalType } from '@/types';

export interface GoalStepState {
  /** The earlier-goal lookup has resolved (both buttons wait for it). */
  loaded: boolean;
  /** `null` is the "Suggest one later" card. */
  type: GoalType | null;
  /** The numeric/window card for `type`, or null when `type` has no card. */
  selected: { window?: boolean } | null;
  target: string;
}

/** Whether the goal step's Continue is enabled. */
export function canContinueGoalStep({ loaded, type, selected, target }: GoalStepState): boolean {
  if (!loaded) return false;
  if (type == null) return true;
  if (!selected) return false;
  return Boolean(selected.window) || Number(target) > 0;
}

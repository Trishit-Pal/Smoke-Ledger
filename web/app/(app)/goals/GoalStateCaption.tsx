import * as React from 'react';
import { stateCaption, type GoalState } from '@/domain/goalAdherence';
import { stateColor } from './goalsView';

export interface GoalStateCaptionProps {
  state: GoalState;
  overDays: number;
  heldDays: number;
}

/** One quiet line under a goal's heading: where it stands this week. */
export function GoalStateCaption({ state, overDays, heldDays }: GoalStateCaptionProps) {
  return (
    <span className="editorial-caption" style={{ color: stateColor(state) }}>
      {stateCaption(state, overDays, heldDays)}
    </span>
  );
}

export default GoalStateCaption;

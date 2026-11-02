// Web-only colour mapping; the per-goal view model itself is shared in src/domain.

import type { GoalState } from '@/domain/goalAdherence';

export * from '@/domain/goalCardModel';

/** Teal only for a goal that is on track or met; terracotta for any concern. */
export function stateColor(state: GoalState): string {
  return state === 'on_track' || state === 'met' ? 'var(--accent)' : 'var(--warn-earth)';
}

// Starter questions appear as the data that answers them exists, so the panel
// never offers a question whose honest answer is "nothing yet".

import type { ToolContext } from './context';

export type StarterId = 'goal' | 'compare' | 'cost' | 'when' | 'so_far';

export interface Starter {
  id: StarterId;
  text: string;
}

const STARTERS: Record<StarterId, string> = {
  goal: 'How am I doing on my goal?',
  compare: 'How did this week compare to last?',
  cost: 'What does this cost me in a year?',
  when: 'When, and why, do I smoke most?',
  so_far: 'What does my ledger say so far?',
};

const MAX_STARTERS = 4;
const DAYS_FOR_COMPARE = 14;
const DAYS_FOR_COST = 7;

export function starterQuestions(ctx: ToolContext): Starter[] {
  const daysWithData = ctx.rows.filter((r) => r.sticks > 0).length;
  if (daysWithData === 0) return [];

  const ids: StarterId[] = [];
  if (ctx.goals.some((g) => g.status === 'active')) ids.push('goal');
  if (daysWithData >= DAYS_FOR_COMPARE) ids.push('compare');
  if (daysWithData >= DAYS_FOR_COST && ctx.rows.some((r) => r.spendInr > 0)) ids.push('cost');
  if (ctx.logs.some((l) => l.moodBefore || l.moodAfter || l.triggerTag)) ids.push('when');
  if (ids.length === 0) ids.push('so_far');

  return ids.slice(0, MAX_STARTERS).map((id) => ({ id, text: STARTERS[id] }));
}

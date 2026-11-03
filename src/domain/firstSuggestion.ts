// Pure decisions behind Home's first-goal suggestion (kept out of the TSX so they are unit-testable).

import type { Proposal } from '@/domain/goalProposals';

const MASK = '••';

export function shouldShowFirstSuggestion(o: {
  hasActiveGoal: boolean;
  proposal: Proposal | null;
  dismissed: boolean;
  /** The dismissal is keyed by user; until the id is known it cannot be read, so stay quiet. */
  userKnown: boolean;
}): boolean {
  return !o.hasActiveGoal && o.proposal !== null && !o.dismissed && o.userKnown;
}

/** The suggestion sentence; every figure is masked while Home totals are hidden. */
export function firstSuggestionSentence(p: Proposal, loggedDays: number, hidden: boolean): string {
  const days = hidden ? MASK : loggedDays;
  const avg = hidden ? MASK : p.basisAvg.toFixed(1);
  const value = hidden ? MASK : p.value;
  return `${days} days in the ledger. Your average is ${avg} a day — a cap at ${value}?`;
}

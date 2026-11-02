// The per-goal computation shared by the goals page, Home and the mobile goals tab: state, week record, any proposal.
// Platform-free; the web's CSS colour mapping stays in web/lib/goals/goalCardModel.ts.

import { dailyAdherence, goalState, holdStatus, type GoalState } from '@/domain/goalAdherence';
import { capOn, isDailyCapLike } from '@/domain/goalMeta';
import { describeProposal, proposalFor, type Proposal } from '@/domain/goalProposals';
import type { CurrencyCode } from '@/lib/regions';
import type { CigaretteLog, Goal } from '@/types';

export interface ProposalCopy {
  headline: string;
  basis: string;
  valueLabel: string;
}
export interface GoalCardModel {
  state: GoalState;
  overDays: number;
  heldDays: number;
  proposal: Proposal | null;
  copy: ProposalCopy | null;
}
export interface CardContext {
  currency: CurrencyCode;
  formatMoney: (n: number) => string;
  formatDate: (ymd: string) => string;
  hideMoney: boolean;
}

/** Everything a card shows beyond the evaluated progress: state, week record, and any proposal. */
export function goalCardModel(goal: Goal, logs: CigaretteLog[], today: string, ctx: CardContext): GoalCardModel {
  const state = goalState(goal, logs, today);
  // Over-days and holds are per-day notions; a weekly cap has no daily record to count.
  const perDay = isDailyCapLike(goal);
  const overDays = perDay ? dailyAdherence(goal, logs, today).filter((d) => d.over).length : 0;
  const heldDays = holdStatus(goal, logs, today).runDays;
  const proposal =
    goal.status === 'active' ? proposalFor(goal, logs, today, state, { currency: ctx.currency }) : null;
  const copy = proposal
    ? describeProposal(proposal, {
        formatMoney: ctx.formatMoney,
        formatDate: ctx.formatDate,
        hideMoney: ctx.hideMoney,
        currentCap: capOn(goal, today) ?? goal.targetValue,
      })
    : null;
  return { state, overDays, heldDays, proposal, copy };
}

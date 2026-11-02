// Pure decision logic for the /goals create form (kept out of the TSX so it is unit-testable).

import { creatableGoalTypes, type GoalFormState } from '@/domain/goalForm';
import { dailyAdherence, goalState, holdStatus, type GoalState } from '@/domain/goalAdherence';
import { capOn, isDailyCapLike, type SpendPeriod } from '@/domain/goalMeta';
import { describeProposal, proposalFor, type Proposal, type ProposalKind } from '@/domain/goalProposals';
import type { CurrencyCode } from '@/lib/regions';
import type { CigaretteLog, Goal, GoalType } from '@/types';

/** A `?type=` search param, accepted only when it names a goal type that can still be created. */
export function parseTypeParam(raw: string | null): GoalType | null {
  return creatableGoalTypes().find((m) => m.type === raw)?.type ?? null;
}

/** True iff the form was seeded by "Use" and the proposal-owned fields are untouched. */
export function isFromProposal(form: GoalFormState, seeded: GoalFormState | null): boolean {
  return (
    seeded !== null &&
    form.target === seeded.target &&
    form.period === seeded.period &&
    form.quitDate === seeded.quitDate
  );
}

/** Unit shown beside a spend-cap target: follows currency and period ("₹/day", "€/week"). */
export function periodUnitLabel(currency: CurrencyCode, period: SpendPeriod): string {
  return `${currency === 'EUR' ? '€' : '₹'}/${period}`;
}

/** Types the ledger can propose a starting value for (a no-smoke window has no number to suggest). */
export function offersStartProposal(type: GoalType): boolean {
  return type !== 'no_smoke_window';
}

/** Button text for accepting a proposal; under discreet mode the (masked) value is not echoed. */
export function proposalButtonLabel(valueLabel: string, hidden: boolean): string {
  return hidden ? 'Use the suggestion' : `Use ${valueLabel}`;
}

/** Teal only for a goal that is on track or met; terracotta for any concern. */
export function stateColor(state: GoalState): string {
  return state === 'on_track' || state === 'met' ? 'var(--accent)' : 'var(--warn-earth)';
}

/** The row label above a card proposal. */
export function proposalRowLabel(kind: ProposalKind): 'Next step' | 'Re-anchor' {
  return kind === 'next' ? 'Next step' : 'Re-anchor';
}

/** Done-section line: the outcome and, when the DB stamped one, its date. */
export function doneLabel(
  status: Goal['status'],
  completedAt: string | null,
  formatDate: (d: string) => string,
): string {
  const word = status === 'abandoned' ? 'Set aside' : 'Completed';
  return completedAt ? `${word} ${formatDate(completedAt)}` : word;
}

/** Active goal types not yet reported, each once (a type has at most one live goal, but stay safe). */
export function unseenActiveTypes(goals: readonly Goal[], seen: ReadonlySet<GoalType>): GoalType[] {
  const types = goals.filter((g) => g.status === 'active').map((g) => g.type);
  return [...new Set(types)].filter((t) => !seen.has(t));
}

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
interface CardContext {
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

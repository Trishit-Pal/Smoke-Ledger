// Pure decision logic for the /goals create form (kept out of the TSX so it is unit-testable).

import { creatableGoalTypes, type GoalFormState } from '@/domain/goalForm';
import type { SpendPeriod } from '@/domain/goalMeta';
import type { ProposalKind } from '@/domain/goalProposals';
import { formatIndianDate, IST, toLocalDate } from '@/lib/date';
import type { CurrencyCode } from '@/lib/regions';
import type { Goal, GoalType } from '@/types';

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

/** The row label above a card proposal. */
export function proposalRowLabel(kind: ProposalKind): 'Next step' | 'Re-anchor' {
  return kind === 'next' ? 'Next step' : 'Re-anchor';
}

/**
 * Done-section line: the outcome and, when the DB stamped one, its date. `completedAt` is a UTC
 * instant, so the day is read in the reader's ledger `zone` (not the runtime's, which would
 * mismatch between server render and browser and name the wrong day near midnight).
 */
export function doneLabel(status: Goal['status'], completedAt: string | null, zone: string = IST): string {
  const word = status === 'abandoned' ? 'Set aside' : 'Completed';
  return completedAt ? `${word} ${formatIndianDate(toLocalDate(completedAt, zone))}` : word;
}

/** Active goal types not yet reported, each once (a type has at most one live goal, but stay safe). */
export function unseenActiveTypes(goals: readonly Goal[], seen: ReadonlySet<GoalType>): GoalType[] {
  const types = goals.filter((g) => g.status === 'active').map((g) => g.type);
  return [...new Set(types)].filter((t) => !seen.has(t));
}

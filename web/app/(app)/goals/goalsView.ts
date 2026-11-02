// Pure decision logic for the /goals create form (kept out of the TSX so it is unit-testable).

import { creatableGoalTypes, type GoalFormState } from '@/domain/goalForm';
import type { SpendPeriod } from '@/domain/goalMeta';
import type { CurrencyCode } from '@/lib/regions';
import type { GoalType } from '@/types';

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

// Onboarding draft store — in-memory only (NOT persisted). Holds the values a
// user types into the multi-step onboarding wizard so that navigating back and
// forth between steps does not lose un-committed input. Cleared on onboarding
// completion and on logout (see useSession.reset wiring). Per the product
// decision, retention is scoped to the login session, so this store is never
// written to AsyncStorage/localStorage.

import { create } from 'zustand';
import type { GoalType } from '@/types';

export type PurchasePref = 'single' | 'pack' | 'mixed';

interface UsagePatch {
  perDay?: number;
  windowDays?: 7 | 30;
  purchasePref?: PurchasePref;
}

interface GoalPatch {
  goalType?: GoalType | null;
  goalTarget?: string;
}

interface OnboardingDraftState {
  // privacy step — consent checkbox values keyed by row id.
  consents: Record<string, boolean>;
  // usage step.
  perDay: number | null;
  windowDays: 7 | 30 | null;
  purchasePref: PurchasePref | null;
  // goal step.
  goalType: GoalType | null;
  goalTarget: string;

  setConsent: (id: string, value: boolean) => void;
  setUsage: (patch: UsagePatch) => void;
  setGoal: (patch: GoalPatch) => void;
  clear: () => void;
}

const EMPTY: Omit<
  OnboardingDraftState,
  'setConsent' | 'setUsage' | 'setGoal' | 'clear'
> = {
  consents: {},
  perDay: null,
  windowDays: null,
  purchasePref: null,
  goalType: null,
  goalTarget: '',
};

/**
 * True when the usage step holds no un-saved input. Read at resolve time by the
 * usage pages so a server load never overwrites an edit made while it was in flight.
 */
export function isUsageDraftEmpty(): boolean {
  const d = useOnboardingDraft.getState();
  return d.perDay == null && d.windowDays == null && d.purchasePref == null;
}

export const useOnboardingDraft = create<OnboardingDraftState>((set) => ({
  ...EMPTY,

  setConsent: (id, value) =>
    set((s) => ({ consents: { ...s.consents, [id]: value } })),
  setUsage: (patch) => set((s) => ({ ...s, ...patch })),
  setGoal: (patch) => set((s) => ({ ...s, ...patch })),
  clear: () => set({ ...EMPTY }),
}));

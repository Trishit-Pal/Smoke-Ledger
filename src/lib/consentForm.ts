// The one rule for when the sign-up / re-consent screens let the reader continue.
// Shared by the web and Expo screens so the two cannot drift.

/** The Ask the ledger choice: true = Yes, false = No, null = not answered yet. */
export type ChatAnswer = boolean | null;

export interface ConsentFormState {
  /** The single agreement tick (age, terms, privacy, medical notice, processing). */
  agreed: boolean;
  /** Whether the explicit health-data tick is shown at all. */
  needsHealth: boolean;
  health: boolean;
  /** Whether the optional chat Yes / No pair is shown. */
  chatShown: boolean;
  chatAnswer: ChatAnswer;
}

/** Every shown required tick is ticked and a shown chat pair is answered (No still continues). */
export function canContinueConsent(s: ConsentFormState): boolean {
  if (!s.agreed) return false;
  if (s.needsHealth && !s.health) return false;
  if (s.chatShown && s.chatAnswer === null) return false;
  return true;
}

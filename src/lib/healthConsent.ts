// Copy for the explicit health-data consent (GDPR Art 9(2)(a), DPDP s6) and for
// withdrawing it. Shared by the web and Expo screens so the two cannot drift.

/** Verbatim consent statement. Shown on an unticked row; never pre-filled. */
export const HEALTH_CONSENT_LABEL =
  'I explicitly consent to Smoke Ledger processing my smoking, spending, mood, craving and notes — information about my health — to keep my ledger.';

export const HEALTH_CONSENT_SUB =
  'You can withdraw this at any time in Settings. Withdrawing means your data is erased.';

/** The decline path sits beside the consent row at the same size as the accept control. */
export const HEALTH_DECLINE_LABEL = "I don't consent";

export const HEALTH_DECLINE_NOTE =
  "Nothing has been saved. Without this consent we can't keep a ledger, so we can't go further. Tick the box above whenever you change your mind.";

/** Re-consent screens: the reader already has a ledger, so nothing is lost by declining. */
export const HEALTH_DECLINE_NOTE_EXISTING =
  "Your ledger stays exactly as it is. Without this consent we can't keep it going, so we can't go further. You can export or delete it from Settings, or tick the box above whenever you change your mind.";

export const WITHDRAW_ROW_LABEL = 'Withdraw consent';
export const WITHDRAW_ROW_SUBLABEL =
  'Take back your consent to keep a ledger of your health information.';

export const WITHDRAW_EXPLANATION =
  "A ledger can't be kept without your consent to process your health information, so withdrawing it means your data goes. First, export a copy if you want one. The export includes your account email and phone. Then choose what happens next: erase everything you've recorded and keep your login, or delete the account.";

export const WITHDRAW_ERASE_LABEL = 'Withdraw and erase my data';
export const WITHDRAW_DELETE_LABEL = 'Withdraw and delete my account';

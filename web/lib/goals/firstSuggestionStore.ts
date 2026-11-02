// "Not now" on Home's first-goal suggestion lives on this device only: localStorage, one key
// per user, the date it was dismissed. Same storage-injection pattern as the chat transcript store.
// Key and snooze rule are shared with mobile: src/lib/goals/firstSuggestionDismissal.ts.

import { firstSuggestionKey, isDismissalStampActive } from '@/lib/goals/firstSuggestionDismissal';

function defaultStorage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

/** True while a dismissal stamped within PROPOSAL_SNOOZE_DAYS of `today` is on record. */
export function isFirstSuggestionDismissed(
  userId: string,
  today: string,
  store: Storage | null = defaultStorage(),
): boolean {
  try {
    return isDismissalStampActive(store?.getItem(firstSuggestionKey(userId)), today);
  } catch {
    return false;
  }
}

export function dismissFirstSuggestion(
  userId: string,
  today: string,
  store: Storage | null = defaultStorage(),
): void {
  try {
    store?.setItem(firstSuggestionKey(userId), today);
  } catch {
    // Quota or private mode: the suggestion simply returns on the next visit.
  }
}

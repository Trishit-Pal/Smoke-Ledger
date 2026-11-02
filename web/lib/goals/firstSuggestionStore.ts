// "Not now" on Home's first-goal suggestion lives on this device only: localStorage, one key
// per user, the date it was dismissed. Same storage-injection pattern as the chat transcript store.

import { PROPOSAL_SNOOZE_DAYS } from '@/domain/goalMeta';
import { daysUntil } from '@/lib/date';

const KEY_PREFIX = 'goals.firstSuggestion.dismissedOn:';
const YMD = /^\d{4}-\d{2}-\d{2}$/;

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
    const stamped = store?.getItem(`${KEY_PREFIX}${userId}`);
    return !!stamped && YMD.test(stamped) && daysUntil(stamped, today) < PROPOSAL_SNOOZE_DAYS;
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
    store?.setItem(`${KEY_PREFIX}${userId}`, today);
  } catch {
    // Quota or private mode: the suggestion simply returns on the next visit.
  }
}

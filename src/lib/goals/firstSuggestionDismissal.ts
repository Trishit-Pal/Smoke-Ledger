// Storage-agnostic half of "Not now" on Home's first-goal suggestion: the per-user key and the
// snooze rule. Web (localStorage) and mobile (AsyncStorage) each do their own I/O around this.

import { PROPOSAL_SNOOZE_DAYS } from '@/domain/goalMeta';
import { daysUntil } from '@/lib/date';

const KEY_PREFIX = 'goals.firstSuggestion.dismissedOn:';
const YMD = /^\d{4}-\d{2}-\d{2}$/;

export const firstSuggestionKey = (userId: string): string => `${KEY_PREFIX}${userId}`;

/** True while a stamp within PROPOSAL_SNOOZE_DAYS of `today` is on record; garbage is "not dismissed". */
export function isDismissalStampActive(stamped: string | null | undefined, today: string): boolean {
  return !!stamped && YMD.test(stamped) && daysUntil(stamped, today) < PROPOSAL_SNOOZE_DAYS;
}

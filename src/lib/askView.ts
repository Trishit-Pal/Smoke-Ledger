// Pure view helpers for the Ask screen: row masking, the notice and the calm
// copy for each way a question can fail. No React, so jest covers them.

import { LEDGER_CHAT_NOTICE } from '@/domain/ledgerChat/notice';
import type { Row } from '@/domain/ledgerChat/types';
import { maskCount, maskInr } from '@/lib/discreet';
import { formatMoney } from '@/lib/format';
import type { CurrencyCode } from '@/lib/regions';
import type { ChatFailure } from '@/services/ledgerChat';

/** Only figures that reveal totals are masked; labels, percentages and text stay. */
export function isRowMaskable(row: Row): boolean {
  return row.unit === 'money' || row.unit === 'sticks';
}

/** Same helpers Home uses, so the mask glyph and rules stay in one place. */
export function rowDisplay(
  row: Row,
  masked: boolean,
  money: { currency: CurrencyCode; locale?: string },
): string {
  if (row.unit === 'money') {
    return typeof row.value === 'number'
      ? maskInr(row.value, masked, (n) => formatMoney(n, money.currency, { locale: money.locale }))
      : String(row.value);
  }
  if (row.unit === 'sticks') return maskCount(row.value, masked);
  if (row.unit === 'percent') return `${row.value}%`;
  return String(row.value);
}

/** What the phone says where the web says "in this browser": nothing is kept on the device. */
export const MOBILE_DEVICE_NOTE =
  'We store no questions or replies on our servers, and the app keeps none on this device. The conversation lives only on this screen, and leaving it clears it. You can turn this off in Settings at any time.';

/** The shared notice, in reading order, with the device line made true for the app. */
export function mobileNoticeParagraphs(): string[] {
  const { lead, scope, sent, discreet, retention } = LEDGER_CHAT_NOTICE;
  return [lead, scope, sent, discreet, retention, MOBILE_DEVICE_NOTE];
}

export const ASK_COPY = {
  title: 'Ask the ledger',
  deck: "Answers are written by an AI model from your ledger's own figures. Nothing is kept once you leave this screen.",
  empty: 'Log a few days first; then ask how your week compares.',
  loading: 'Reading the ledger…',
  footnote: 'Not medical advice. A daily limit applies.',
  consentTitle: 'Before the first answer',
} as const;

/** Calm, one-sentence copy per failure; never alarm wording. */
export const FAILURE_COPY: Record<ChatFailure, string> = {
  disabled: 'Ask the ledger is resting for now.',
  signed_out: 'Please sign in again to ask the ledger.',
  consent_required: 'Turn on Ask the ledger to continue.',
  consent_outdated: 'Your agreements changed. Review them to keep asking.',
  rate_limited: "You've reached today's limit. The ledger is still here tomorrow.",
  unavailable: "The ledger couldn't be read just now. Your charts still can.",
  network: "Couldn't reach the ledger. Check your connection and try again.",
};

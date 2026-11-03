// Pure view helpers for the Ask screen: row masking, the notice and the calm
// copy for each way a question can fail. No React, so jest covers them.

import { LEDGER_CHAT_NOTICE } from '@/domain/ledgerChat/notice';
import type { ChatStateResponse, Row } from '@/domain/ledgerChat/types';
import { maskCount, maskInr, maskNumbers } from '@/lib/discreet';
import { formatMoney } from '@/lib/format';
import type { CurrencyCode } from '@/lib/regions';
import type { ChatFailure } from '@/services/ledgerChat';

/** Only figures that reveal totals are masked; labels, percentages and text stay. */
export function isRowMaskable(row: Row): boolean {
  return row.unit === 'money' || row.unit === 'sticks';
}

/** Totals are hidden when the server says so, and until the state is known (fail closed). */
export function isHidden(state: Pick<ChatStateResponse, 'hideTotals'> | null): boolean {
  return state ? state.hideTotals : true;
}

/** A row starts masked when totals are hidden, until the reader reveals it. */
export function rowMasked(row: Row, hidden: boolean, revealed: ReadonlySet<string>): boolean {
  return hidden && isRowMaskable(row) && !revealed.has(row.id);
}

/** The paragraph is masked only when hiding would change it, and it has not been revealed. */
export function proseMasked(answer: string, hidden: boolean, revealed: boolean): boolean {
  return hidden && !revealed && maskNumbers(answer, true) !== answer;
}

/**
 * The question typed before opting in, to send once the opt-in is saved. It is
 * taken a single time, so a second tap cannot ask it twice.
 */
export function takeWaitingQuestion(draft: string, alreadyTaken: boolean): string | null {
  const q = draft.trim();
  return alreadyTaken || !q ? null : q;
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
// Part of the consent notice: bump LEDGER_CHAT_NOTICE_VERSION with any change here.
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
  waiting: 'Your question is sent once you turn this on.',
  readFailed: "Couldn't read this setting just now.",
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

// How one answer's rows are shown and spoken. The panel renders rows with
// rowDisplay, and a screen reader hears announcementFor; both mask through the
// same helpers Home uses, so what is hidden on screen is hidden aloud too.

import type { ChatResponse, Row } from '@/domain/ledgerChat/types';
import { maskCount, maskInr, maskNumbers } from '@/lib/discreet';

/** Money and stick rows are the reader's totals; percentages and text are not. */
export function rowMaskable(row: Row): boolean {
  return row.unit === 'money' || row.unit === 'sticks';
}

export function rowDisplay(row: Row, masked: boolean, money: (n: number) => string): string {
  if (row.unit === 'money') return typeof row.value === 'number' ? maskInr(row.value, masked, money) : String(row.value);
  if (row.unit === 'sticks') return maskCount(row.value, masked);
  if (row.unit === 'percent') return `${row.value}%`;
  return String(row.value);
}

/**
 * The narration, then each row as "label value". A hidden row is read as
 * "label hidden", the same words as its own aria-label, never as "•••".
 */
export function announcementFor(
  response: Pick<ChatResponse, 'answer' | 'rows'>,
  opts: { masked: boolean; money: (n: number) => string },
): string {
  const rows = response.rows
    .map((r) => (opts.masked && rowMaskable(r) ? `${r.label} hidden` : `${r.label} ${rowDisplay(r, false, opts.money)}`))
    .join('; ');
  return [maskNumbers(response.answer, opts.masked), rows].filter(Boolean).join(' ');
}

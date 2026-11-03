import { LEDGER_CHAT_NOTICE } from '@/domain/ledgerChat/notice';
import type { Row } from '@/domain/ledgerChat/types';
import {
  FAILURE_COPY,
  isHidden,
  isRowMaskable,
  mobileNoticeParagraphs,
  proseMasked,
  rowDisplay,
  rowMasked,
  takeWaitingQuestion,
} from '@/lib/askView';

jest.mock('@/lib/supabase', () => ({ getSupabase: jest.fn() }));

const money = { currency: 'INR' as const, locale: 'en-IN' };
const row = (unit: Row['unit'], value: Row['value']): Row => ({ id: 'r', label: 'L', value, unit });

describe('rowDisplay', () => {
  it('masks money and sticks when hidden, and shows them when not', () => {
    expect(rowDisplay(row('money', 1200), true, money)).toBe('•••');
    expect(rowDisplay(row('sticks', 14), true, money)).toBe('•••');
    expect(rowDisplay(row('money', 1200), false, money)).toContain('1,200');
    expect(rowDisplay(row('sticks', 14), false, money)).toBe('14');
  });

  it('leaves percent, days and text alone, and never masks them', () => {
    expect(rowDisplay(row('percent', 12), true, money)).toBe('12%');
    expect(rowDisplay(row('days', 3), true, money)).toBe('3');
    expect(rowDisplay(row('text', 'Evening'), true, money)).toBe('Evening');
    expect(isRowMaskable(row('percent', 12))).toBe(false);
    expect(isRowMaskable(row('money', 1))).toBe(true);
    expect(isRowMaskable(row('sticks', 1))).toBe(true);
  });
});

describe('isHidden', () => {
  const state = (hideTotals: boolean) => ({ hideTotals }) as Parameters<typeof isHidden>[0];
  it('hides when the server says totals are hidden', () => {
    expect(isHidden(state(true))).toBe(true);
  });
  it('shows when the server says they are not', () => {
    expect(isHidden(state(false))).toBe(false);
  });
  it('fails closed while the state is unknown', () => {
    expect(isHidden(null)).toBe(true);
  });
});

describe('rowMasked and proseMasked', () => {
  const none: ReadonlySet<string> = new Set();
  it('masks money and sticks when hidden, until revealed', () => {
    expect(rowMasked(row('money', 5), true, none)).toBe(true);
    expect(rowMasked(row('sticks', 5), true, none)).toBe(true);
    expect(rowMasked(row('money', 5), true, new Set(['r']))).toBe(false);
  });
  it('never masks when totals are not hidden, nor non-figure rows', () => {
    expect(rowMasked(row('money', 5), false, none)).toBe(false);
    expect(rowMasked(row('percent', 5), true, none)).toBe(false);
    expect(rowMasked(row('text', 'x'), true, none)).toBe(false);
  });
  it('masks the paragraph only when hidden, it holds figures, and it is not revealed', () => {
    expect(proseMasked('You logged 4 today.', true, false)).toBe(true);
    expect(proseMasked('You logged 4 today.', true, true)).toBe(false);
    expect(proseMasked('You logged 4 today.', false, false)).toBe(false);
    expect(proseMasked('A quiet week.', true, false)).toBe(false);
  });
});

describe('takeWaitingQuestion', () => {
  it('returns the trimmed question the first time only', () => {
    expect(takeWaitingQuestion('  How was today?  ', false)).toBe('How was today?');
    expect(takeWaitingQuestion('How was today?', true)).toBeNull();
  });
  it('returns null for an empty draft', () => {
    expect(takeWaitingQuestion('   ', false)).toBeNull();
  });
});

describe('mobileNoticeParagraphs', () => {
  it('carries every shared notice line except the browser-specific one', () => {
    const paragraphs = mobileNoticeParagraphs();
    const { lead, scope, sent, discreet, retention, device } = LEDGER_CHAT_NOTICE;
    for (const line of [lead, scope, sent, discreet, retention]) expect(paragraphs).toContain(line);
    expect(paragraphs).not.toContain(device);
    expect(paragraphs.join(' ').toLowerCase()).not.toContain('browser');
  });
});

describe('FAILURE_COPY', () => {
  it('has a calm line for every failure and never alarm wording', () => {
    for (const text of Object.values(FAILURE_COPY)) {
      expect(text.length).toBeGreaterThan(0);
      expect(text).not.toMatch(/error|failed|warning|danger|!/i);
    }
  });
});

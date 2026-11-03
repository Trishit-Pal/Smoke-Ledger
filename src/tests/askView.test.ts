import { LEDGER_CHAT_NOTICE } from '@/domain/ledgerChat/notice';
import type { Row } from '@/domain/ledgerChat/types';
import { FAILURE_COPY, isRowMaskable, mobileNoticeParagraphs, rowDisplay } from '@/lib/askView';

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

import { LEDGER_CHAT_NOTICE, LEDGER_CHAT_NOTICE_TEXT } from '@/domain/ledgerChat/notice';
import { maskNumbers } from '@/lib/discreet';
import type { Row } from '@/domain/ledgerChat/types';
import {
  answerAnnouncement,
  ASK_COPY,
  FAILURE_COPY,
  isHidden,
  isRowMaskable,
  leaveTarget,
  mobileNoticeParagraphs,
  proseMasked,
  rowDisplay,
  rowMasked,
  takeWaitingQuestion,
  waitingTakenAfter,
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

describe('waitingTakenAfter', () => {
  it('re-arms the waiting question when the ask is refused for consent', () => {
    expect(waitingTakenAfter(true, 'consent_required')).toBe(false);
  });
  it('keeps the question taken for every other outcome', () => {
    expect(waitingTakenAfter(true, 'network')).toBe(true);
    expect(waitingTakenAfter(true, null)).toBe(true);
    expect(waitingTakenAfter(false, 'rate_limited')).toBe(false);
  });
});

describe('leaveTarget', () => {
  it('goes back when there is somewhere to go back to', () => {
    expect(leaveTarget(true)).toBe('back');
  });
  it('falls back to the tabs after a cold start from a deep link', () => {
    expect(leaveTarget(false)).toBe('/(tabs)');
  });
});

describe('answerAnnouncement', () => {
  it('speaks the answer as written when totals are shown', () => {
    expect(answerAnnouncement('You logged 4 today.', false)).toBe('You logged 4 today.');
  });
  it('speaks "hidden" for each figure, not the bullet glyph, when totals are hidden', () => {
    const spoken = answerAnnouncement('You logged 4 sticks, costing 1,200.', true);
    expect(spoken).toBe('You logged hidden sticks, costing hidden.');
    expect(spoken).not.toMatch(/[0-9•]/);
    // The drawn text keeps the glyph.
    expect(maskNumbers('You logged 4 sticks', true)).toBe('You logged ••• sticks');
  });
  it('joins paragraphs into one sentence run', () => {
    expect(answerAnnouncement('A quiet week.\n\nNothing to add.', false)).toBe('A quiet week. Nothing to add.');
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

describe('ASK_COPY.waiting (the line under the box before consent)', () => {
  it('says consent is needed, in the same words as the web panel, and stays calm', () => {
    expect(ASK_COPY.waiting).toContain('Off until you consent to AI processing of your ledger data.');
    expect(ASK_COPY.waiting).not.toMatch(/error|failed|warning|danger|!/i);
  });

  it('is outside the hash-pinned notice, so wording it never re-asks anyone', () => {
    expect(mobileNoticeParagraphs().join(' ')).not.toContain('Off until you consent');
    expect(LEDGER_CHAT_NOTICE_TEXT).not.toContain('Off until you consent');
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

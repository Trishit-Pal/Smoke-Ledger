import { describe, expect, test } from 'vitest';
import type { Row } from '@/domain/ledgerChat/types';
import { announcementFor } from '@web/components/chat/announce';

// What a screen reader hears when an answer arrives: the narration, then each
// row as "label value", masked exactly as the screen masks it.
const money = (n: number) => `₹${n}`;
const rows: Row[] = [
  { id: 'compare.week.current.sticks', label: 'This week', value: 8, unit: 'sticks' },
  { id: 'compare.week.current.spend', label: 'Spend, this week', value: 160, unit: 'money' },
  { id: 'compare.week.delta', label: 'Change, this week', value: -33.3, unit: 'percent', tone: 'accent' },
];

describe('announcementFor', () => {
  test('reads the narration, then each row as label and value', () => {
    expect(announcementFor({ answer: 'Fewer than last week.', rows }, { masked: false, money })).toBe(
      'Fewer than last week. This week 8; Spend, this week ₹160; Change, this week -33.3%',
    );
  });

  test('masks prose figures and money and stick rows when totals are hidden', () => {
    const said = announcementFor({ answer: 'This week came to 8 sticks.', rows }, { masked: true, money });
    expect(said).toBe(
      'This week came to ••• sticks. This week hidden; Spend, this week hidden; Change, this week -33.3%',
    );
    expect(said).not.toContain('160');
  });

  test('is the narration alone when there are no rows', () => {
    expect(announcementFor({ answer: 'Fewer than last week.', rows: [] }, { masked: false, money })).toBe(
      'Fewer than last week.',
    );
  });
});

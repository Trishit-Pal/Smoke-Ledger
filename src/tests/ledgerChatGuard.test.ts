import { allowedNumbers, findUnverifiedNumberWords, findUnverifiedNumbers, sanitizeNarration } from '@/domain/ledgerChat/guard';
import type { ToolOutcome } from '@/domain/ledgerChat/tools';

const outcome: ToolOutcome = {
  ok: true,
  data: { spendInr: 1200, stickDeltaPct: -21.27, sticks: 8, note: 'Peak hour 18:00–19:00' },
  rows: [{ id: 'r', label: 'Saved', value: 345.5, unit: 'money' }],
};
const allowed = allowedNumbers([outcome], { year: '2026' });

describe('findUnverifiedNumbers', () => {
  it('accepts a grouped money figure that exists in the tool data', () => {
    expect(findUnverifiedNumbers('The ledger shows ₹1,200 this week.', allowed)).toEqual([]);
  });

  it('flags a figure that no tool produced', () => {
    expect(findUnverifiedNumbers('About 15 sticks, give or take.', allowed)).toEqual(['15']);
  });

  it('accepts small day and hour counts and the current year', () => {
    expect(findUnverifiedNumbers('Over the last 7 days, mostly around 9 pm, as in 2026.', allowed)).toEqual([]);
  });

  it('accepts a rounded percentage of a value in the data', () => {
    expect(findUnverifiedNumbers('Down 21.3% on last week, and 21% rounded.', allowed)).toEqual([]);
  });

  it('accepts digits that appear inside tool strings and row values', () => {
    expect(findUnverifiedNumbers('Peak between 18:00 and 19:00; ₹345.50 saved.', allowed)).toEqual([]);
  });
});

describe('sanitizeNarration', () => {
  it('strips links, markdown, and html but keeps the words', () => {
    const text = 'See [the chart](https://example.com) or www.example.com **now** <b>please</b>\n# Title\n- item';
    expect(sanitizeNarration(text)).toBe('See the chart or now please\nTitle\nitem');
  });

  it('caps the narration at 800 characters', () => {
    expect(sanitizeNarration('a'.repeat(1000)).length).toBe(800);
  });
});

describe('findUnverifiedNumberWords', () => {
  const plain = { discreet: false };

  it.each([
    ['About three sticks a day.', ['three']],
    ['Roughly twenty-one this week.', ['twenty-one']],
    ['Close to a thousand rupees.', ['thousand']],
    ['Nearly a lakh, maybe a crore.', ['lakh', 'crore']],
    ['Up twelve percent, or twelve per cent.', ['twelve', 'percent', 'twelve', 'per cent']],
    ['A hundred and ninety-nine of them.', ['hundred', 'ninety-nine']],
    ['Over a million.', ['million']],
  ])('flags English number words: %s', (text, expected) => {
    expect(findUnverifiedNumberWords(text, plain)).toEqual(expected);
  });

  it.each([
    ['Aaj teen sticks liye.', ['teen']],
    ['Paanch rupees ka.', ['Paanch']],
    ['Ek baar subah, do packs hafte mein.', ['Ek', 'do']],
    ['Das cigarettes, saat rs.', ['Das', 'saat']],
  ])('flags Hinglish number words before a unit: %s', (text, expected) => {
    expect(findUnverifiedNumberWords(text, plain)).toEqual(expected);
  });

  it.each([
    'Do you want to look at last week?',
    'One of the evenings stood out.',
    'Once in the morning, and two more in the evening.',
    'Two quiet days, then one busy one.',
    'Teen years ago is outside the ledger.',
    'I do not have that.',
    'The last three days and the past seven-day stretch.',
    'Mostly around nine pm, sometimes at ten o’clock.',
    'Pichhle teen din aur do ghante.',
    'Down 21 percent on last week.',
    'Someone, everyone, often, tension, eighteenth.',
  ])('passes ordinary words, durations and times: %s', (text) => {
    expect(findUnverifiedNumberWords(text, plain)).toEqual([]);
  });

  it('in discreet mode every number word is unverified, durations included', () => {
    expect(findUnverifiedNumberWords('The last three days, teen din.', { discreet: true })).toEqual(['three', 'teen']);
    expect(findUnverifiedNumberWords('Do you want one of those?', { discreet: true })).toEqual([]);
  });
});

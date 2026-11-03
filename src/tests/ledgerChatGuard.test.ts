import {
  allowedNumbers,
  findUnverifiedFigures,
  findUnverifiedNumberWords,
  findUnverifiedNumbers,
  sanitizeNarration,
} from '@/domain/ledgerChat/guard';
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

describe('Hinglish hundreds, thousands and money (fix round 1, I1)', () => {
  it.each([
    ['Teen sau rupaye lage.', ['Teen', 'sau']],
    ['Do hazaar ka kharcha.', ['Do', 'hazaar']],
    ['Paanch rupaye ka.', ['Paanch']],
    ['Das paise kam.', ['Das']],
  ])('flags them outside discreet mode: %s', (text, expected) => {
    expect(findUnverifiedNumberWords(text, { discreet: false })).toEqual(expected);
  });

  it.each([
    ['Teen sau rupaye lage.', ['Teen', 'sau']],
    ['Paanch rupaye ka.', ['Paanch']],
    ['Do hazaar ka kharcha.', ['Do', 'hazaar']],
    ['Kal saat, aaj teen.', ['saat', 'teen']],
    ['Ek hazar.', ['Ek', 'hazar']],
  ])('flags every Hinglish number word in discreet mode, unit or not: %s', (text, expected) => {
    expect(findUnverifiedNumberWords(text, { discreet: true })).toEqual(expected);
  });

  it.each(['Do you want to look at last week?', 'What do you see in it?', 'I do.'])(
    '"do" as English is never flagged, discreet or not: %s',
    (text) => {
      expect(findUnverifiedNumberWords(text, { discreet: true })).toEqual([]);
      expect(findUnverifiedNumberWords(text, { discreet: false })).toEqual([]);
    },
  );
});

describe('Unicode digits, zero, and the review strings (review fixes, Task 7)', () => {
  const discreet = { discreet: true };

  // The five strings the review ran through the discreet guard, all unflagged before:
  // - "Kal bees cigarettes, pachaas rupaye": Hindi number words outside the Hinglish list
  //   ("bees" is also English). Prevented by the prompt: discreet replies are English.
  // - "आपने पाँच सिगरेट पी, ५०० रुपये": the guard flags the Devanagari digits; the word "पाँच" is
  //   prevented by the prompt.
  // - "Vous avez fumé quinze cigarettes": French. Prevented by the prompt.
  // - "Two packs, zero today": the guard flags both words.
  // - Mixed digits, "Aaj १५ sticks, kal 8.": the guard flags the made-up १५ (15), not the 8 in the data.
  it.each([
    ['आपने पाँच सिगरेट पी, ५०० रुपये', ['500']],
    ['Two packs, zero today', ['Two', 'zero']],
    ['Aaj १५ sticks, kal 8.', ['15']],
  ])('flags what the guard can see in discreet mode: %s', (text, expected) => {
    expect(findUnverifiedFigures(text, allowed, discreet)).toEqual(expected);
  });

  it('reads a figure in any script by its value, so a verified one passes', () => {
    expect(findUnverifiedNumbers('Is hafte ८ sticks, ₹१,2०० kharch.', allowed)).toEqual([]);
    expect(findUnverifiedNumbers('Fullwidth ８ and Arabic-Indic ٨ too.', allowed)).toEqual([]);
  });

  it('a number word right after non-ASCII digits is left to the digit check', () => {
    expect(findUnverifiedNumberWords('Down २१ percent.', { discreet: false })).toEqual([]);
  });

  it('zero is a figure only in discreet mode', () => {
    expect(findUnverifiedNumberWords('Zero entries today.', { discreet: false })).toEqual([]);
    expect(findUnverifiedNumberWords('Zero entries today.', discreet)).toEqual(['Zero']);
  });

  it('in discreet mode one and two count before a unit, like "do"', () => {
    expect(findUnverifiedNumberWords('One stick, then two cigarettes.', discreet)).toEqual(['One', 'two']);
    expect(findUnverifiedNumberWords('One of the evenings, two quiet days.', discreet)).toEqual([]);
  });
});

describe('dates and hours verify no figures (review fixes, Task 7)', () => {
  const entries: ToolOutcome = {
    ok: true,
    data: {
      startYmd: '2026-06-08',
      entries: [{ date: '2026-06-14', hour: 21, quantity: 2 }],
      edits: [{ entryDate: '2026-06-12', entryHour: 9, editedOn: '2026-06-16' }],
      goals: [{ startDate: '2025-12-01' }],
    },
    rows: [{ id: 'r', label: 'Sticks, 2026-06-08 to 2026-06-14', value: 2, unit: 'sticks' }],
  };
  const allowedHere = allowedNumbers([entries], { year: '2026', extraText: ['- Today: 2026-06-23 (Asia/Kolkata)'] });

  it.each(['14', '6', '8', '12', '16', '23', '21', '9'])('a made-up %s sticks is flagged, though it is a date part or an hour', (n) => {
    expect(findUnverifiedNumbers(`${n} sticks on Tuesday.`, allowedHere)).toEqual([n]);
  });

  it('a numeric field still verifies its figure', () => {
    expect(findUnverifiedNumbers('2 sticks on Tuesday.', allowedHere)).toEqual([]);
  });

  it('a date keeps its year, and a day before a month reads as a date', () => {
    expect(findUnverifiedNumbers('You set it in December 2025.', allowedHere)).toEqual([]);
    expect(findUnverifiedNumbers('You edited the 12 June entry on 16th June, and 14th of June.', allowedHere)).toEqual([]);
  });

  it('hours read as times by their context', () => {
    expect(findUnverifiedNumbers('Mostly around 9 pm, or 21:00.', allowedHere)).toEqual([]);
  });
});

describe('decimals pass only as roundings of the data (review fixes, Task 7)', () => {
  const allowedHere = allowedNumbers([{ ok: true, data: { unitPrice: 18 }, rows: [] }], { year: '2026' });

  it('₹18.40 is not verified by an 18 in the data', () => {
    expect(findUnverifiedNumbers('Each one cost ₹18.40.', allowedHere)).toEqual(['18.40']);
  });

  it('the value itself and its fixed-point forms pass', () => {
    expect(findUnverifiedNumbers('₹18 a stick, or ₹18.00.', allowedHere)).toEqual([]);
  });
});

describe('brand names are not figures (fix round 1, I2)', () => {
  const brandOutcome: ToolOutcome = {
    ok: true,
    data: { brands: [{ brand: 'Four Square', sharePct: 60 }] },
    rows: [],
  };
  const allowedHere = allowedNumbers([brandOutcome], { year: '2026' });
  const phrases = ['Four Square', 'Seven Hills Kings'];

  it('an answer naming a brand from the tool data passes', () => {
    expect(findUnverifiedFigures('Most of it went on four square lately.', allowedHere, { discreet: false, allowedPhrases: phrases })).toEqual([]);
    expect(findUnverifiedFigures('Seven Hills Kings came second.', allowedHere, { discreet: false, allowedPhrases: phrases })).toEqual([]);
  });

  it('a number word outside the brand name is still flagged', () => {
    expect(
      findUnverifiedFigures('Four Square, about four packs.', allowedHere, { discreet: false, allowedPhrases: phrases }),
    ).toEqual(['four']);
  });

  it('without the phrase the brand word trips the guard, as before', () => {
    expect(findUnverifiedFigures('Four Square led.', allowedHere, { discreet: false })).toEqual(['Four']);
  });
});

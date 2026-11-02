import { maskNumbers } from '@/lib/discreet';

// Model prose is a render site too: a verified figure in the narration must be
// masked exactly like the row beside it when totals are hidden.
describe('maskNumbers', () => {
  it('replaces every figure in prose when masking is on', () => {
    expect(maskNumbers('This week came to 8 sticks and ₹1,200 by 9 pm.', true)).toBe(
      'This week came to ••• sticks and ₹••• by ••• pm.',
    );
  });

  it('leaves prose untouched when masking is off', () => {
    const text = 'Down 21.3% on last week.';
    expect(maskNumbers(text, false)).toBe(text);
  });

  it('passes through empty and null-ish text', () => {
    expect(maskNumbers('', true)).toBe('');
  });
});

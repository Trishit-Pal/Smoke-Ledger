import { describe, expect, it } from 'vitest';
import { brandRows } from '@web/lib/trends/brandRows';

const mix = [
  { brand: 'Marlboro', spendInr: 120, sticks: 12, share: 0.6 },
  { brand: 'Camel', spendInr: 80, sticks: 8, share: 0.4 },
];

describe('brandRows', () => {
  it('shows names, keys and share percent when not discreet', () => {
    const rows = brandRows(mix, false);
    expect(rows.map((r) => r.name)).toEqual(['Marlboro', 'Camel']);
    expect(rows.map((r) => r.key)).toEqual(['Marlboro', 'Camel']);
    expect(rows.map((r) => r.shareText)).toEqual(['60%', '40%']);
  });

  it('aliases by position, keys by index and masks share with no % when discreet', () => {
    const rows = brandRows(mix, true);
    expect(rows.map((r) => r.name)).toEqual(['Brand A', 'Brand B']);
    expect(rows.map((r) => r.key)).toEqual(['0', '1']);
    expect(rows.map((r) => r.shareText)).toEqual(['•••', '•••']);
    expect(JSON.stringify(rows)).not.toMatch(/Marlboro|Camel/);
  });
});

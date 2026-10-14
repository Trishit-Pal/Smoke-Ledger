import { describe, it, expect } from 'vitest';
import { buildPricePreview } from '@web/app/(app)/log/new/pricePreview';
import { formatInr, formatMoney, formatPerStick } from '@/lib/format';

describe('buildPricePreview', () => {
  it('returns null when nothing is typed', () => {
    expect(buildPricePreview('', 1)).toBeNull();
  });

  it('rejects a non-numeric price', () => {
    expect(buildPricePreview('abc', 1)).toBe('Enter a valid price per stick.');
  });

  it('rejects a negative price', () => {
    expect(buildPricePreview('-5', 1)).toBe('Enter a valid price per stick.');
  });

  it('accepts 0 as a valid (free) per-stick price', () => {
    const r = buildPricePreview('0', 2);
    expect(r).not.toBe('Enter a valid price per stick.');
    expect(r).toContain(formatInr(0));
    expect(r).toContain(formatPerStick(0));
  });

  it('multiplies the per-stick price by quantity for the total', () => {
    const r = buildPricePreview('100', 4);
    expect(r?.startsWith('= ')).toBe(true);
    expect(r).toContain(formatInr(400)); // total = 100 x 4
    expect(r).toContain(formatPerStick(100)); // per-stick rate, unchanged by qty
  });

  it('clamps a zero / blank / non-numeric quantity to 1', () => {
    expect(buildPricePreview('50', '0')).toContain(formatInr(50));
    expect(buildPricePreview('50', '')).toContain(formatInr(50));
    expect(buildPricePreview('50', 'xyz')).toContain(formatInr(50));
  });

  it('formats the preview in the given currency', () => {
    const r = buildPricePreview('13.5', 2, 'EUR', 'fr-FR');
    expect(r).toContain(formatMoney(27, 'EUR', { locale: 'fr-FR' }));
    expect(r).toContain(formatPerStick(13.5, { currency: 'EUR', locale: 'fr-FR' }));
    expect(r).not.toContain('₹');
  });
});

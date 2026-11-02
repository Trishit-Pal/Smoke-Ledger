import { brandAlias, maskBrandAt } from '@/lib/discreet';

describe('brandAlias', () => {
  it('letters A..Z by index, then numbers', () => {
    expect(brandAlias(0)).toBe('Brand A');
    expect(brandAlias(25)).toBe('Brand Z');
    expect(brandAlias(26)).toBe('Brand 27');
  });
});

describe('maskBrandAt', () => {
  it('gives each index its own alias when discreet', () => {
    expect(maskBrandAt('Marlboro', 0, true)).toBe('Brand A');
    expect(maskBrandAt('Camel', 1, true)).toBe('Brand B');
  });

  it('passes the name through when not discreet', () => {
    expect(maskBrandAt('Marlboro', 0, false)).toBe('Marlboro');
  });

  it('never renders "undefined" for a negative index', () => {
    expect(brandAlias(-1)).toBe('Brand hidden');
    expect(maskBrandAt('Marlboro', -1, true)).toBe('Brand hidden');
  });

  it('shows a dash for an empty name when not discreet', () => {
    expect(maskBrandAt(null, 0, false)).toBe('—');
    expect(maskBrandAt('', 0, false)).toBe('—');
    expect(maskBrandAt(undefined, 0, false)).toBe('—');
  });
});

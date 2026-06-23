import { describe, it, expect } from 'vitest';
import {
  CATEGORY_ORDER,
  CATEGORY_LABELS,
  presentCategories,
  filterByCategory,
} from '@web/components/brands/categoryFilter';
import type { BrandCategory } from '@/types';

type TestBrand = { id: string; category: BrandCategory };

function mk(id: string, category: BrandCategory): TestBrand {
  return { id, category };
}

describe('CATEGORY_ORDER / CATEGORY_LABELS', () => {
  it('covers every BrandCategory with a label', () => {
    for (const c of CATEGORY_ORDER) {
      expect(CATEGORY_LABELS[c]).toBeTruthy();
    }
    expect(Object.keys(CATEGORY_LABELS).sort()).toEqual([...CATEGORY_ORDER].sort());
  });

  it('lists the canonical categories in order', () => {
    expect(CATEGORY_ORDER).toEqual(['budget', 'regular', 'premium', 'imported', 'other']);
  });
});

describe('presentCategories', () => {
  it('returns categories in canonical order regardless of input order', () => {
    const brands = [mk('a', 'premium'), mk('b', 'budget'), mk('c', 'imported')];
    expect(presentCategories(brands)).toEqual(['budget', 'premium', 'imported']);
  });

  it('dedupes repeated categories', () => {
    const brands = [mk('a', 'regular'), mk('b', 'regular'), mk('c', 'budget')];
    expect(presentCategories(brands)).toEqual(['budget', 'regular']);
  });

  it('omits categories that are not present', () => {
    const brands = [mk('a', 'budget'), mk('b', 'other')];
    expect(presentCategories(brands)).toEqual(['budget', 'other']);
  });

  it('returns an empty array for no brands', () => {
    expect(presentCategories([])).toEqual([]);
  });
});

describe('filterByCategory', () => {
  const brands = [
    mk('a', 'budget'),
    mk('b', 'regular'),
    mk('c', 'budget'),
    mk('d', 'premium'),
  ];

  it("'all' returns every brand", () => {
    expect(filterByCategory(brands, 'all').map((b) => b.id)).toEqual(['a', 'b', 'c', 'd']);
  });

  it("'all' returns a new array, not the original reference", () => {
    const result = filterByCategory(brands, 'all');
    expect(result).not.toBe(brands);
    expect(result).toEqual(brands);
  });

  it('narrows to a single category', () => {
    expect(filterByCategory(brands, 'budget').map((b) => b.id)).toEqual(['a', 'c']);
  });

  it('returns an empty array when no brand matches the category', () => {
    expect(filterByCategory(brands, 'imported')).toEqual([]);
  });
});

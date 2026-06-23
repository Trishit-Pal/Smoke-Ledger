'use client';

import * as React from 'react';
import type { BrandCategory } from '@/types';

/** 'all' is the always-present tab that lists every brand across categories. */
export type CategoryFilterValue = BrandCategory | 'all';

/** Canonical display order for category tabs. */
export const CATEGORY_ORDER: BrandCategory[] = [
  'budget',
  'regular',
  'premium',
  'imported',
  'other',
];

export const CATEGORY_LABELS: Record<BrandCategory, string> = {
  budget: 'Budget',
  regular: 'Regular',
  premium: 'Premium',
  imported: 'Imported',
  other: 'Other',
};

/** The categories actually present among `brands`, in canonical order. */
export function presentCategories<T extends { category: BrandCategory }>(
  brands: readonly T[],
): BrandCategory[] {
  const set = new Set(brands.map((b) => b.category));
  return CATEGORY_ORDER.filter((c) => set.has(c));
}

/** Filter brands by tab. 'all' returns every brand unconditionally. */
export function filterByCategory<T extends { category: BrandCategory }>(
  brands: readonly T[],
  value: CategoryFilterValue,
): T[] {
  return value === 'all' ? [...brands] : brands.filter((b) => b.category === value);
}

/**
 * Shared brand category-tab state. `filtered` always contains every brand under
 * 'all'; switching tabs narrows it. The selected brand id (held by the caller) is
 * untouched, so a selection is retained across tab switches. Falls back to 'all'
 * if the active category disappears (e.g. a brand was deleted).
 */
export function useBrandCategoryFilter<T extends { category: BrandCategory }>(
  brands: readonly T[],
) {
  const [category, setCategory] = React.useState<CategoryFilterValue>('all');
  const categories = React.useMemo(() => presentCategories(brands), [brands]);

  React.useEffect(() => {
    if (category !== 'all' && !categories.includes(category)) setCategory('all');
  }, [category, categories]);

  const filtered = React.useMemo(() => filterByCategory(brands, category), [brands, category]);
  return { category, setCategory, categories, filtered };
}

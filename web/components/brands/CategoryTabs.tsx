'use client';

import * as React from 'react';
import type { BrandCategory } from '@/types';
import { ChoiceRun } from '@web/components/visual';
import { CATEGORY_LABELS, type CategoryFilterValue } from './categoryFilter';

export interface CategoryTabsProps {
  /** Categories present among the brands (from useBrandCategoryFilter). */
  categories: BrandCategory[];
  value: CategoryFilterValue;
  onChange: (next: CategoryFilterValue) => void;
  ariaLabel?: string;
}

/**
 * Editorial category tab-run: "All · Budget · Regular · …". Always leads with
 * "All" (every brand). Renders nothing when there's only one category, since a
 * single flat list already shows everything. Delegates to ChoiceRun so the run
 * shares its 44px targets and focus ring.
 */
export function CategoryTabs({
  categories,
  value,
  onChange,
  ariaLabel = 'Brand category',
}: CategoryTabsProps) {
  if (categories.length <= 1) return null;
  const options = [
    { value: 'all' as CategoryFilterValue, label: 'All' },
    ...categories.map((c) => ({ value: c as CategoryFilterValue, label: CATEGORY_LABELS[c] })),
  ];

  return (
    <div className="mb-sm">
      <ChoiceRun
        options={options}
        value={value}
        allowClear={false}
        ariaLabel={ariaLabel}
        onSelect={(next) => {
          if (next !== null) onChange(next);
        }}
      />
    </div>
  );
}

export default CategoryTabs;

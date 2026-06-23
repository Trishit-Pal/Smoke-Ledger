'use client';

import * as React from 'react';
import type { BrandCategory } from '@/types';
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
 * single flat list already shows everything.
 */
export function CategoryTabs({
  categories,
  value,
  onChange,
  ariaLabel = 'Brand category',
}: CategoryTabsProps) {
  if (categories.length <= 1) return null;
  const tabs: CategoryFilterValue[] = ['all', ...categories];

  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className="flex flex-wrap items-baseline gap-y-xs mb-sm"
    >
      {tabs.map((t, i) => {
        const active = t === value;
        const label = t === 'all' ? 'All' : CATEGORY_LABELS[t as BrandCategory];
        return (
          <React.Fragment key={t}>
            {i > 0 ? (
              <span aria-hidden className="text-text-faint mx-xs select-none">
                ·
              </span>
            ) : null}
            <button
              type="button"
              aria-pressed={active}
              onClick={() => onChange(t)}
              className={
                'editorial-caption px-xs py-xs rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg ' +
                (active
                  ? 'text-text underline underline-offset-4 decoration-1'
                  : 'text-text-muted hover:text-text')
              }
              style={active ? { textDecorationColor: 'var(--rule-strong)' } : undefined}
            >
              {label}
            </button>
          </React.Fragment>
        );
      })}
    </div>
  );
}

export default CategoryTabs;

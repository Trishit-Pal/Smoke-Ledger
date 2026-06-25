/*
 * ChoiceRun — small-caps text choices separated by middots, the editorial
 * surface's replacement for a chip/segmented control. Active choice is
 * underlined; the run wraps and aligns to the baseline.
 *
 * Used across the log form (purchase mode, trigger, mood, context, craving,
 * quantity presets) and the backdate "When" presets. Extracted from
 * LogNewClient so every caller shares one radiogroup implementation rather
 * than re-deriving the markup.
 */

import * as React from 'react';

export interface ChoiceRunProps<T extends string | number> {
  options: readonly { value: T; label: string }[];
  value: T | null;
  onSelect: (next: T | null) => void;
  /** When true (default), clicking the active choice clears it. */
  allowClear?: boolean;
  /** Accessible group name for the radiogroup. */
  ariaLabel?: string;
}

export function ChoiceRun<T extends string | number>({
  options,
  value,
  onSelect,
  allowClear = true,
  ariaLabel,
}: ChoiceRunProps<T>) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className="flex flex-wrap items-baseline">
      {options.map((opt, i) => {
        const active = opt.value === value;
        return (
          <React.Fragment key={String(opt.value)}>
            {i > 0 ? (
              <span aria-hidden className="text-text-faint mx-xs select-none">
                ·
              </span>
            ) : null}
            <button
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onSelect(active && allowClear ? null : opt.value)}
              className={
                'editorial-caption px-xs py-xs rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg ' +
                (active
                  ? 'text-text underline underline-offset-4 decoration-1'
                  : 'text-text-muted hover:text-text')
              }
              style={active ? { textDecorationColor: 'var(--rule-strong)' } : undefined}
            >
              {opt.label}
            </button>
          </React.Fragment>
        );
      })}
    </div>
  );
}

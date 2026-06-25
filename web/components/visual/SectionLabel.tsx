/*
 * SectionLabel — the small all-caps label that opens every editorial section.
 *
 * Wraps the `<h2 className="editorial-caption">` pattern that appears 30+
 * times across dashboard / trends / history / log. Adds an optional hairline
 * rule below the label so the section feels like a printed chapter heading
 * rather than a UI eyebrow.
 *
 * Use `withRule` to draw a 60px hairline aligned to the label (matches the
 * editorial-headline → rule-draw pattern in EditorialMasthead). Default is
 * rule-hair (full-width, faint).
 *
 * Why a component and not just a class: keeps the heading hierarchy explicit
 * (always h2, always aria-labelledby-friendly via id passthrough) and lets us
 * tweak one place if we ever want the caption to use a different tracking or
 * size on a single page.
 */

import * as React from 'react';
import { cn } from '@web/components/ui/cn';

export type SectionLabelTone = 'default' | 'inverse' | 'muted';

export interface SectionLabelProps {
  children: React.ReactNode;
  id?: string;
  /** 'rule' (faint full-width) or 'rule-strong' (more visible, used for the
   *  first section after a masthead) or 'none'. */
  rule?: 'hair' | 'strong' | 'none';
  /** 'inverse' swaps to the ink-surface palette for sections that live inside
   *  an .ink-panel inversion. */
  tone?: SectionLabelTone;
  /** Extra padding above the label — useful when stacking two sections close
   *  together. */
  spacing?: 'none' | 'sm' | 'md';
  className?: string;
}

export function SectionLabel({
  children,
  id,
  rule = 'hair',
  tone = 'default',
  spacing = 'md',
  className,
}: SectionLabelProps) {
  return (
    <h2
      id={id}
      className={cn(
        'editorial-caption',
        tone === 'inverse' && 'ink-muted',
        tone === 'muted' && 'text-text-faint',
        spacing === 'none' && 'mb-0',
        spacing === 'sm' && 'mb-sm',
        spacing === 'md' && 'mb-md',
        className,
      )}
    >
      <span>{children}</span>
    </h2>
  );
}

/**
 * SectionDivider — the hairline rule that follows a SectionLabel. Rendered as
 * a separate element so the rule width can vary (full-bleed vs 60px) and so
 * the entrance animation can stagger independently.
 */
export interface SectionDividerProps {
  variant?: 'hair' | 'strong';
  width?: 'full' | 'short';
  className?: string;
}

export function SectionDivider({ variant = 'hair', width = 'full', className }: SectionDividerProps) {
  return (
    <div
      aria-hidden
      className={cn(
        variant === 'strong' ? 'rule-hair-strong' : 'rule-hair',
        width === 'short' ? 'w-[60px]' : 'w-full',
        className,
      )}
    />
  );
}

/*
 * MetricRow — labelled hairline-row used throughout the editorial surface.
 *
 * Encapsulates the `grid grid-cols-[1fr_auto] items-baseline gap-md py-md
 * rule-hair[-strong]` pattern that opens every ledger entry on dashboard,
 * history, settings, log. The pattern appears 40+ times in the codebase
 * today, so DRY-ing it removes ~80 lines of duplicated Tailwind class soup.
 *
 * Slots:
 *   - label (left): the metric name + optional subtitle/description
 *   - value (right): the metric figure — usually an editorial-numeral-* class
 *
 * Variants:
 *   - 'default': top hairline + standard vertical padding
 *   - 'first': stronger top rule so the row reads as the chapter's first entry
 *   - 'flat': no top rule (use when stacking under a sibling)
 */

import * as React from 'react';
import { cn } from '@web/components/ui/cn';

export type MetricRowTone = 'neutral' | 'accent' | 'warn';

export interface MetricRowProps {
  label: React.ReactNode;
  subtitle?: React.ReactNode;
  value: React.ReactNode;
  /** Force the value's color (overrides any value-element color). Used to
   *  highlight positive/negative deltas. */
  tone?: MetricRowTone;
  variant?: 'default' | 'first' | 'flat';
  /** Accessible description for the whole row (read after label). */
  ariaLabel?: string;
  /** Optional click handler — turns the row into a button-shaped affordance. */
  onClick?: () => void;
  className?: string;
  labelClassName?: string;
  valueClassName?: string;
}

const TONE_COLOR: Record<MetricRowTone, string | undefined> = {
  neutral: undefined,
  accent: 'var(--accent)',
  warn: 'var(--warn-earth-ink)',
};

export function MetricRow({
  label,
  subtitle,
  value,
  tone = 'neutral',
  variant = 'default',
  ariaLabel,
  onClick,
  className,
  labelClassName,
  valueClassName,
}: MetricRowProps) {
  const isInteractive = typeof onClick === 'function';
  const content = (
    <div
      className={cn(
        'grid grid-cols-[1fr_auto] items-baseline gap-md py-md',
        variant === 'first' ? 'rule-hair-strong' : variant === 'flat' ? '' : 'rule-hair',
        isInteractive && 'cursor-pointer hover:[&_.ed-mr-label]:text-text transition-colors',
        className,
      )}
    >
      <div className={cn('min-w-0', labelClassName)}>
        <dt className={cn('text-body text-text ed-mr-label')}>
          {label}
        </dt>
        {subtitle ? (
          <dd className="text-small text-text-muted mt-xs">{subtitle}</dd>
        ) : null}
      </div>
      <dd
        className={cn(
          'editorial-numeral--micro nums-tabular text-right shrink-0',
          valueClassName,
        )}
        style={TONE_COLOR[tone] ? { color: TONE_COLOR[tone] } : undefined}
        aria-label={ariaLabel}
      >
        {value}
      </dd>
    </div>
  );

  if (isInteractive) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="block w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg rounded-sm"
      >
        {content}
      </button>
    );
  }

  return content;
}

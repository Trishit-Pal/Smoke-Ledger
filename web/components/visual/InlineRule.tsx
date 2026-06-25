/*
 * InlineRule — a hairline `<hr>`-style divider with optional rule-draw animation.
 *
 * Two visual modes:
 *   - 'hair': full-width faint (uses --rule)
 *   - 'strong': full-width more visible (uses --rule-strong)
 *
 * Two animation modes:
 *   - 'none' (default): no entrance animation. Used when stacking inside an
 *     editorial-stage, where the parent animation already provides the entrance.
 *   - 'draw': the left-to-right fill animation, with stagger from --ed-index.
 */

import * as React from 'react';
import { cn } from '@web/components/ui/cn';

export interface InlineRuleProps {
  variant?: 'hair' | 'strong';
  animate?: 'none' | 'draw';
  /** Override the inline index used by rule-draw. Defaults to inheriting
   *  --ed-index from the parent .editorial-stage so the rule staggers with
   *  the section it belongs to. */
  index?: number;
  className?: string;
}

export function InlineRule({ variant = 'hair', animate = 'none', index, className }: InlineRuleProps) {
  const style = index !== undefined ? ({ ['--ed-index' as string]: index } as React.CSSProperties) : undefined;

  return (
    <div
      aria-hidden
      className={cn(
        variant === 'strong' ? 'rule-hair-strong' : 'rule-hair',
        animate === 'draw' && 'rule-draw',
        className,
      )}
      style={style}
    />
  );
}

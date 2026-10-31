'use client';

import * as React from 'react';
import type { CigaretteLog } from '@/types';
import { moodTriggerMatrix } from '@/domain/correlations';
import { EmptyState } from '@web/components/ui/EmptyState';
import { cn } from '@web/components/ui/cn';

export interface MoodTriggerMatrixProps {
  logs: CigaretteLog[];
  /** Formats an amount in the ledger's currency. */
  money: (amount: number) => string;
}

export function MoodTriggerMatrix({ logs, money }: MoodTriggerMatrixProps) {
  const matrix = React.useMemo(() => moodTriggerMatrix(logs, 3), [logs]);

  if (matrix.total === 0 || matrix.moods.length === 0 || matrix.triggers.length === 0) {
    return (
      <EmptyState
        title="Not enough mood and trigger data yet"
        description="Tag a few logs with a mood and trigger to surface patterns here."
      />
    );
  }

  const lookup = new Map<string, number>();
  let max = 0;
  for (const cell of matrix.cells) {
    lookup.set(`${cell.mood}|${cell.trigger}`, cell.count);
    if (cell.count > max) max = cell.count;
  }

  return (
    <div className="flex flex-col gap-md">
      <div className="flex flex-col gap-xs">
        <span className="text-caption uppercase text-text-muted">Strongest pairs</span>
        <ul className="flex flex-col gap-xs">
          {matrix.topPairs.map((pair) => (
            <li
              key={`${pair.mood}-${pair.trigger}`}
              className="flex items-center justify-between text-small"
            >
              <span className="text-text">
                <span className="font-semibold">{pair.mood}</span>
                <span className="text-text-faint mx-1">×</span>
                <span className="font-semibold">{pair.trigger}</span>
              </span>
              <span className="text-text-muted">
                {pair.count}× · avg {pair.avgUnitPriceInr == null ? '—' : money(pair.avgUnitPriceInr)}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="overflow-x-auto">
        <div
          className="grid gap-1 min-w-fit"
          style={{
            gridTemplateColumns: `auto repeat(${matrix.triggers.length}, minmax(56px, 1fr))`,
          }}
        >
          <span />
          {matrix.triggers.map((t) => (
            <span
              key={`th-${t}`}
              className="text-caption uppercase text-text-muted text-center px-1 py-1 truncate"
              title={t}
            >
              {t}
            </span>
          ))}

          {matrix.moods.map((mood) => (
            <React.Fragment key={`row-${mood}`}>
              <span
                className="text-caption uppercase text-text-muted px-1 py-1 self-center"
                title={mood}
              >
                {mood}
              </span>
              {matrix.triggers.map((trigger) => {
                const count = lookup.get(`${mood}|${trigger}`) ?? 0;
                const intensity = max > 0 ? count / max : 0;
                const opacity = count > 0 ? 0.18 + 0.8 * intensity : 0;
                return (
                  <div
                    key={`cell-${mood}-${trigger}`}
                    className={cn(
                      'rounded-sm border border-border h-9 flex items-center justify-center',
                      count === 0 && 'bg-bg-elevated',
                    )}
                    style={
                      count > 0
                        ? { background: `rgba(47,163,155,${opacity})` }
                        : undefined
                    }
                    title={`${mood} × ${trigger}: ${count}`}
                  >
                    <span className="text-caption font-medium text-text">
                      {count > 0 ? count : ''}
                    </span>
                  </div>
                );
              })}
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}

export default MoodTriggerMatrix;

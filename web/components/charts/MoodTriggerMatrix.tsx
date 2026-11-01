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
              className="flex items-center justify-between gap-sm text-small"
            >
              <span className="text-text min-w-0 break-words">
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
        <table className="min-w-fit border-separate border-spacing-1">
          <caption className="sr-only">How often each mood and trigger were logged together</caption>
          <thead>
            <tr>
              <td />
              {matrix.triggers.map((t) => (
                <th
                  key={`th-${t}`}
                  scope="col"
                  className="min-w-[56px] px-1 py-1 text-center text-caption font-normal uppercase text-text-muted"
                >
                  {t}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matrix.moods.map((mood) => (
              <tr key={`row-${mood}`}>
                <th
                  scope="row"
                  className="px-1 py-1 text-left text-caption font-normal uppercase text-text-muted"
                >
                  {mood}
                </th>
                {matrix.triggers.map((trigger) => {
                  const count = lookup.get(`${mood}|${trigger}`) ?? 0;
                  const intensity = max > 0 ? count / max : 0;
                  const opacity = count > 0 ? 0.18 + 0.8 * intensity : 0;
                  return (
                    <td
                      key={`cell-${mood}-${trigger}`}
                      className={cn(
                        'h-9 rounded-sm border border-border text-center text-caption font-medium text-text',
                        count === 0 && 'bg-bg-elevated',
                      )}
                      style={count > 0 ? { background: `rgba(47,163,155,${opacity})` } : undefined}
                    >
                      {count > 0 ? count : <span className="sr-only">0</span>}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default MoodTriggerMatrix;

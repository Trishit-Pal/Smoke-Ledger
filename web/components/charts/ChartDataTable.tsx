import * as React from 'react';

export interface ChartDataTableProps {
  caption: string;
  rows: readonly { label: string; value: number; cap?: number | null }[];
  /** Column header for the value column. */
  valueLabel?: string;
}

/** Screen-reader alternative for a visual chart: the same data as a real table,
 *  visually hidden. Pair with `aria-hidden` on the drawn chart so it isn't read twice. */
export function ChartDataTable({ caption, rows, valueLabel = 'Value' }: ChartDataTableProps) {
  if (rows.length === 0) return null;
  const hasCap = rows.some((r) => typeof r.cap === 'number');
  return (
    <table className="sr-only">
      <caption>{caption}</caption>
      <thead>
        <tr>
          <th scope="col">Label</th>
          <th scope="col">{valueLabel}</th>
          {hasCap ? <th scope="col">Cap</th> : null}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={`${r.label}-${i}`}>
            <th scope="row">{r.label}</th>
            <td>{r.value}</td>
            {hasCap ? <td>{r.cap ?? ''}</td> : null}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

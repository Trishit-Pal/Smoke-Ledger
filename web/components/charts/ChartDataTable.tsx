import * as React from 'react';

export interface ChartDataTableProps {
  caption: string;
  rows: readonly { label: string; value: number }[];
  /** Column header for the value column. */
  valueLabel?: string;
}

/** Screen-reader alternative for a visual chart: the same data as a real table,
 *  visually hidden. Pair with `aria-hidden` on the drawn chart so it isn't read twice. */
export function ChartDataTable({ caption, rows, valueLabel = 'Value' }: ChartDataTableProps) {
  if (rows.length === 0) return null;
  return (
    <table className="sr-only">
      <caption>{caption}</caption>
      <thead>
        <tr>
          <th scope="col">Label</th>
          <th scope="col">{valueLabel}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={`${r.label}-${i}`}>
            <th scope="row">{r.label}</th>
            <td>{r.value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

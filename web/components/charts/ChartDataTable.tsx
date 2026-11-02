import * as React from 'react';

export interface ChartDataTableProps {
  caption: string;
  rows: readonly { label: string; value: number; cap?: number | null }[];
  /** Column header for the value column. */
  valueLabel?: string;
  /** Formats value and cap cells (e.g. discreet masking). Default: String. */
  formatValue?: (v: number) => string;
  /** Formats the row header (e.g. brand aliasing). Default: identity. */
  formatLabel?: (label: string, index: number) => string;
}

/** Screen-reader alternative for a visual chart: the same data as a real table,
 *  visually hidden. Pair with `aria-hidden` on the drawn chart so it isn't read twice. */
export function ChartDataTable({
  caption,
  rows,
  valueLabel = 'Value',
  formatValue = String,
  formatLabel = (label) => label,
}: ChartDataTableProps) {
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
            <th scope="row">{formatLabel(r.label, i)}</th>
            <td>{formatValue(r.value)}</td>
            {hasCap ? <td>{typeof r.cap === 'number' ? formatValue(r.cap) : ''}</td> : null}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

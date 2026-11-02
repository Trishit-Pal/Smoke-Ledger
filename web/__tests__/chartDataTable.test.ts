import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ChartDataTable } from '../components/charts/ChartDataTable';

const rows = [
  { label: 'Mon', value: 1234, cap: 5678 },
  { label: 'Tue', value: 4321, cap: 8765 },
];

const render = (extra: object = {}) =>
  renderToStaticMarkup(React.createElement(ChartDataTable, { caption: 'Sticks', rows, ...extra }));

const cells = (html: string) => [...html.matchAll(/<td>(.*?)<\/td>/g)].map((m) => m[1]);

describe('ChartDataTable', () => {
  it('prints raw values and caps by default', () => {
    expect(cells(render())).toEqual(['1234', '5678', '4321', '8765']);
  });

  it('applies formatValue to value and cap cells', () => {
    const out = cells(render({ formatValue: () => '•••' }));
    expect(out).toEqual(['•••', '•••', '•••', '•••']);
    expect(out.join('')).not.toMatch(/\d/);
  });

  it('passes label and index through formatLabel', () => {
    const html = render({ formatLabel: (l: string, i: number) => `Brand ${i}:${l.length}` });
    expect(html).toContain('<th scope="row">Brand 0:3</th>');
    expect(html).toContain('<th scope="row">Brand 1:3</th>');
    expect(html).not.toContain('>Mon<');
  });
});

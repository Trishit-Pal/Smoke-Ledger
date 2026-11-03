import { describe, expect, it } from 'vitest';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { CigaretteLog } from '@/types';
import { LineChart } from '@web/components/charts/LineChart';
import { BarChart, isYAxisVisible } from '@web/components/charts/BarChart';
import { BarChart3D } from '@web/components/charts/BarChart3D';
import { Donut, donutPieData, donutTooltipFormatter } from '@web/components/charts/Donut';
import { Heatmap } from '@web/components/charts/Heatmap';

// Some chart files rely on the automatic JSX runtime; vitest uses the classic one.
(globalThis as { React?: typeof React }).React = React;

const MASK = '•••';
const mask = () => MASK;
const aliasLabel = (_label: string, i: number) => `Brand ${String.fromCharCode(65 + i)}`;
const render = (el: React.ReactElement) => renderToStaticMarkup(el);

const series = [
  { label: 'Mon', value: 37, cap: 4242 },
  { label: 'Tue', value: 4242, cap: 4242 },
];

describe('chart masking formatters', () => {
  it('LineChart forwards formatY to its data table', () => {
    const html = render(React.createElement(LineChart, { data: series, formatY: mask }));
    expect(html).not.toMatch(/37|4242/);
    expect(html).toContain(MASK);
  });
  it('LineChart shows raw values without a formatter', () => {
    expect(render(React.createElement(LineChart, { data: series }))).toContain('<td>37</td>');
  });

  it('BarChart forwards formatY to its data table', () => {
    const html = render(React.createElement(BarChart, { data: series, formatY: mask }));
    expect(html).not.toMatch(/37|4242/);
    expect(html).toContain(MASK);
  });
  it('BarChart y axis: formatY alone shows it, showYAxis=false hides it, table stays masked', () => {
    // recharts renders nothing in node, so assert the axis decision via the pure helper.
    expect(isYAxisVisible(undefined)).toBe(false);
    expect(isYAxisVisible(mask)).toBe(true);
    expect(isYAxisVisible(mask, false)).toBe(false);
    const html = render(React.createElement(BarChart, { data: series, formatY: mask, showYAxis: false }));
    expect(html).not.toMatch(/37|4242/);
    expect(html).toContain(MASK);
  });
  it('BarChart shows raw values without a formatter', () => {
    expect(render(React.createElement(BarChart, { data: series }))).toContain('<td>37</td>');
  });

  it('BarChart3D masks the visible value and aria-label', () => {
    const html = render(React.createElement(BarChart3D, { data: series, formatValue: mask }));
    expect(html).toContain(`aria-label="Mon ${MASK}, Tue ${MASK}"`);
    // Visible value paragraphs (inline style heights may contain digits).
    const values = [...html.matchAll(/nums-tabular">([^<]*)</g)].map((m) => m[1]);
    expect(values).toEqual([MASK, MASK]);
  });
  it('BarChart3D shows raw values without a formatter', () => {
    const html = render(React.createElement(BarChart3D, { data: series }));
    expect(html).toContain('Mon 37');
    expect(html).toContain('>37<');
  });

  const slices = [
    { label: 'Marlboro', value: 37 },
    { label: 'Gold Flake', value: 4242 },
  ];
  it('Donut masks table values and brand labels', () => {
    const html = render(
      React.createElement(Donut, { slices, formatValue: mask, formatLabel: aliasLabel }),
    );
    expect(html).not.toMatch(/37|4242|Marlboro|Gold Flake/);
    expect(html).toContain('Brand A');
    expect(html).toContain('Brand B');
  });
  it('Donut shows raw values and labels without formatters', () => {
    const html = render(React.createElement(Donut, { slices }));
    expect(html).toContain('<td>37</td>');
    expect(html).toContain('Marlboro');
  });

  // 37 logs in one weekday/hour cell (2025-01-06 is a Monday).
  const logs = Array.from({ length: 37 }, (_, i) => ({
    id: `l${i}`,
    tsUtc: '2025-01-06T09:30:00.000Z',
    localDate: '2025-01-06',
    localHour: 9,
  })) as unknown as CigaretteLog[];
  const heatmap = (extra: object, data = logs) =>
    render(
      React.createElement(Heatmap, {
        logs: data,
        startYmd: '2025-01-01',
        endYmd: '2025-01-31',
        initialWidth: 400,
        ...extra,
      }),
    );

  it('Heatmap masks cell titles and the aria-label', () => {
    const html = heatmap({ formatCount: mask });
    expect(html).toContain('<title>');
    // Coordinates contain digits, so look only at the readable text.
    expect(html).not.toMatch(/37 logs?/);
    expect(html).toContain(`${MASK} logs`);
    expect(html).toContain(`${MASK} logs — M 9:00`);
  });
  it('Heatmap shows raw counts without a formatter', () => {
    const html = heatmap({});
    expect(html).toContain('37 logs');
  });

  it('Heatmap singular reads "1 log" with String formatter, masked stays plural', () => {
    const one = [logs[0]!];
    expect(heatmap({ formatCount: String }, one)).toContain('1 log — M 9:00');
    expect(heatmap({ formatCount: mask }, one)).toContain(`${MASK} logs — M 9:00`);
    expect(heatmap({ formatCount: String })).toContain('37 logs — M 9:00');
  });

  it('Heatmap masked title does not reveal a count of 1 via singular/plural', () => {
    const one = [logs[0]!];
    const html = heatmap({ formatCount: mask }, one);
    expect(html).not.toMatch(/ log —/);
    expect(html).toContain(`${MASK} logs — M 9:00`);
    // Unmasked singular is unchanged.
    expect(heatmap({}, one)).toContain('1 log — M 9:00');
  });

  describe('donutTooltipFormatter', () => {
    const item = (sliceIndex?: number) => ({ payload: { sliceIndex } });
    it('masks the value and aliases the label by slice index', () => {
      const f = donutTooltipFormatter(mask, aliasLabel);
      expect(f(37, 'Marlboro', item(1))).toEqual([MASK, 'Brand B']);
    });
    it('gives duplicate labels distinct aliases', () => {
      const f = donutTooltipFormatter(mask, aliasLabel);
      expect(f(1, 'Same', item(0))[1]).toBe('Brand A');
      expect(f(2, 'Same', item(1))[1]).toBe('Brand B');
    });
    it('never returns the raw name when the index is unresolvable', () => {
      const f = donutTooltipFormatter(mask, aliasLabel);
      expect(f(37, 'Marlboro', undefined)[1]).not.toBe('Marlboro');
      expect(f(37, 'Marlboro', item(undefined))[1]).not.toBe('Marlboro');
    });
    it('passes raw value and name through with no formatters', () => {
      expect(donutTooltipFormatter()(37, 'Marlboro', item(0))).toEqual(['37', 'Marlboro']);
    });
  });
});

describe('donutPieData', () => {
  // Recharts copies each slice name onto its SVG <path name="…">, so the name it
  // receives must already be masked, or a discreet reader's brand sits in the DOM.
  it('hands Recharts the formatted name, never the raw label', () => {
    const data = donutPieData(
      [
        { label: 'Gold Flake', value: 40 },
        { label: 'Classic', value: 10 },
      ],
      (_l, i) => `Brand ${String.fromCharCode(65 + i)}`,
    );
    expect(data.map((d) => d.label)).toEqual(['Brand A', 'Brand B']);
    expect(JSON.stringify(data)).not.toContain('Gold Flake');
    expect(data.map((d) => d.sliceIndex)).toEqual([0, 1]);
  });

  it('keeps the label and drops empty slices when no formatter is given', () => {
    const data = donutPieData([
      { label: 'Gold Flake', value: 40 },
      { label: 'None', value: 0 },
    ]);
    expect(data).toEqual([{ label: 'Gold Flake', value: 40, sliceIndex: 0 }]);
  });
});

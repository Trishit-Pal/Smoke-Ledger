import { describe, expect, it, vi } from 'vitest';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { CigaretteLog } from '@/types';
import { LineChart } from '@web/components/charts/LineChart';
import { BarChart } from '@web/components/charts/BarChart';
import { BarChart3D } from '@web/components/charts/BarChart3D';
import { Donut } from '@web/components/charts/Donut';
import { Heatmap } from '@web/components/charts/Heatmap';

// Heatmap only draws once its container has a measured width, and effects don't
// run in a static render, so let a test seed the width state.
const seed = vi.hoisted(() => ({ width: null as number | null }));
vi.mock('react', async () => {
  const actual = await vi.importActual<typeof import('react')>('react');
  const useState = ((init: unknown) =>
    seed.width === null ? actual.useState(init as never) : [seed.width, () => {}]) as unknown as typeof actual.useState;
  return { ...actual, default: { ...actual, useState }, useState };
});

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
  it('BarChart shows raw values without a formatter', () => {
    expect(render(React.createElement(BarChart, { data: series }))).toContain('<td>37</td>');
  });

  it('BarChart3D masks the visible value and aria-label', () => {
    const html = render(React.createElement(BarChart3D, { data: series, formatValue: mask }));
    expect(html).not.toMatch(/37|4242/);
    expect(html).toContain(MASK);
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
  const withWidth = <T>(fn: () => T): T => {
    seed.width = 400;
    try {
      return fn();
    } finally {
      seed.width = null;
    }
  };
  const heatmap = (extra: object) =>
    withWidth(() =>
      render(React.createElement(Heatmap, { logs, startYmd: '2025-01-01', endYmd: '2025-01-31', ...extra })),
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
});

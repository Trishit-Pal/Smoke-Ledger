'use client';

import * as React from 'react';
import type { CigaretteLog } from '@/types';

export interface HeatmapProps {
  logs: CigaretteLog[];
  startYmd: string;
  endYmd: string;
  height?: number;
}

const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const HOUR_LABELS: { hour: number; label: string }[] = [
  { hour: 0, label: '0h' },
  { hour: 6, label: '6h' },
  { hour: 12, label: '12h' },
  { hour: 18, label: '18h' },
];

function buildGrid(logs: CigaretteLog[], startYmd: string, endYmd: string) {
  const grid: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
  let max = 0;
  for (const log of logs) {
    if (log.localDate < startYmd || log.localDate > endYmd) continue;
    const t = Date.parse(log.tsUtc);
    if (!Number.isFinite(t)) continue;
    const d = new Date(t);
    const dow = (d.getUTCDay() + 6) % 7; // Mon=0..Sun=6
    const hour = log.localHour ?? d.getUTCHours();
    if (hour < 0 || hour > 23) continue;
    const cell = grid[dow]![hour]! + 1;
    grid[dow]![hour] = cell;
    if (cell > max) max = cell;
  }
  return { grid, max };
}

export function Heatmap({ logs, startYmd, endYmd, height = 180 }: HeatmapProps) {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = React.useState(0);

  React.useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    setWidth(el.clientWidth);
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setWidth(entry.contentRect.width);
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const { grid, max } = React.useMemo(
    () => buildGrid(logs, startYmd, endYmd),
    [logs, startYmd, endYmd],
  );

  const labelWidth = 18;
  const bottomPad = 18;
  const innerWidth = Math.max(0, width - labelWidth);
  const innerHeight = Math.max(0, height - bottomPad);
  const cellW = innerWidth / 24;
  const cellH = innerHeight / 7;
  const gap = 1.5;

  return (
    <div ref={containerRef} className="w-full" style={{ height }}>
      {width > 0 ? (
        <svg width={width} height={height} role="img" aria-label="Smoking activity heatmap">
          {DAY_LABELS.map((label, row) => (
            <text
              key={`day-${row}`}
              x={0}
              y={row * cellH + cellH / 2 + 3}
              fontSize={10}
              fill="var(--chart-tick)"
            >
              {label}
            </text>
          ))}

          {grid.map((row, r) =>
            row.map((count, c) => {
              const intensity = max > 0 ? Math.max(0, Math.min(1, count / max)) : 0;
              const opacity = count > 0 ? 0.18 + 0.8 * intensity : 0;
              return (
                <rect
                  key={`c-${r}-${c}`}
                  x={labelWidth + c * cellW + gap / 2}
                  y={r * cellH + gap / 2}
                  width={Math.max(0, cellW - gap)}
                  height={Math.max(0, cellH - gap)}
                  rx={2}
                  fill={count > 0 ? 'var(--chart-series-1)' : 'var(--chart-grid)'}
                  fillOpacity={count > 0 ? opacity : 0.5}
                >
                  <title>{`${count} log${count === 1 ? '' : 's'} — ${DAY_LABELS[r]} ${c}:00`}</title>
                </rect>
              );
            }),
          )}

          {HOUR_LABELS.map(({ hour, label }) => (
            <text
              key={`h-${hour}`}
              x={labelWidth + hour * cellW}
              y={height - 4}
              fontSize={10}
              fill="var(--chart-tick)"
            >
              {label}
            </text>
          ))}
        </svg>
      ) : null}
    </div>
  );
}

export default Heatmap;

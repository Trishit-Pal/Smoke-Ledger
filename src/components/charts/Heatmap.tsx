import React from 'react';
import { View, LayoutChangeEvent } from 'react-native';
import Svg, { Rect, Text as SvgText } from 'react-native-svg';
import { useTheme } from '@/hooks/useTheme';
import type { CigaretteLog } from '@/types';

export interface HeatmapProps {
  logs: CigaretteLog[];
  startYmd: string;
  endYmd: string;
  height?: number;
}

const DOW_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

/**
 * 7×24 heatmap of smoking frequency. Rows = day of week, columns = hour of day.
 * Cell colour intensity = log count.
 */
export function Heatmap({ logs, startYmd, endYmd, height = 180 }: HeatmapProps) {
  const theme = useTheme();
  const [w, setW] = React.useState(0);
  const onLayout = (e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width);

  // grid[dow][hour] — Mon..Sun, 0..23
  const grid: number[][] = React.useMemo(() => {
    const g = Array.from({ length: 7 }, () => Array(24).fill(0) as number[]);
    let max = 0;
    for (const l of logs) {
      if (l.localDate < startYmd || l.localDate > endYmd) continue;
      // dayOfWeekShort returns short label; we need 0..6 (Mon..Sun) — derive from date
      const [y, m, d] = l.localDate.split('-').map(Number);
      if (!y || !m || !d) continue;
      const js = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0=Sun..6=Sat
      const dow = (js + 6) % 7; // shift so Mon=0
      const row = g[dow];
      if (row && l.localHour >= 0 && l.localHour < 24) {
        row[l.localHour] = (row[l.localHour] ?? 0) + l.quantity;
        if ((row[l.localHour] ?? 0) > max) max = row[l.localHour] ?? 0;
      }
    }
    return g;
  }, [logs, startYmd, endYmd]);

  const max = React.useMemo(
    () => Math.max(1, ...grid.flatMap((row) => row.reduce((a, b) => Math.max(a, b), 0) as any)),
    [grid],
  );

  const padL = 18;
  const padT = 16;
  const padR = 6;
  const padB = 16;
  const gridW = Math.max(0, w - padL - padR);
  const gridH = height - padT - padB;
  const cellW = gridW / 24;
  const cellH = gridH / 7;

  return (
    <View onLayout={onLayout} style={{ width: '100%', height }}>
      {w > 0 ? (
        <Svg width={w} height={height}>
          {grid.map((row, dow) =>
            row.map((v, h) => {
              const intensity = v / max;
              return (
                <Rect
                  key={`${dow}-${h}`}
                  x={padL + h * cellW}
                  y={padT + dow * cellH}
                  width={Math.max(1, cellW - 1)}
                  height={Math.max(1, cellH - 1)}
                  rx={2}
                  fill={theme.accent}
                  opacity={v === 0 ? 0.06 : 0.18 + 0.8 * intensity}
                />
              );
            }),
          )}
          {DOW_LABELS.map((l, i) => (
            <SvgText
              key={i}
              x={4}
              y={padT + i * cellH + cellH / 2 + 3}
              fill={theme.textMuted}
              fontSize={9}
            >
              {l}
            </SvgText>
          ))}
          {[0, 6, 12, 18].map((h) => (
            <SvgText
              key={h}
              x={padL + h * cellW}
              y={height - 4}
              fill={theme.textMuted}
              fontSize={9}
            >
              {`${h}h`}
            </SvgText>
          ))}
        </Svg>
      ) : (
        <View style={{ height }} />
      )}
    </View>
  );
}

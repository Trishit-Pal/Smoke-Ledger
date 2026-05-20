import React from 'react';
import { View, LayoutChangeEvent } from 'react-native';
import Svg, { Rect, Line, Text as SvgText } from 'react-native-svg';
import { useTheme } from '@/hooks/useTheme';

export interface BarDatum {
  label: string;
  value: number;
}

export interface BarChartProps {
  data: BarDatum[];
  height?: number;
  formatY?: (v: number) => string;
  showLabels?: boolean;
  emphasizeLast?: boolean;
}

export function BarChart({ data, height = 160, formatY, showLabels = true, emphasizeLast = true }: BarChartProps) {
  const theme = useTheme();
  const [w, setW] = React.useState(0);
  const onLayout = (e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width);

  const max = Math.max(1, ...data.map((d) => d.value));
  const padL = 28;
  const padR = 8;
  const padT = 8;
  const padB = showLabels ? 22 : 6;
  const chartW = Math.max(0, w - padL - padR);
  const chartH = height - padT - padB;
  const barGap = 4;
  const barW = data.length > 0 ? Math.max(2, chartW / data.length - barGap) : 0;

  return (
    <View onLayout={onLayout} style={{ width: '100%', height }}>
      {w > 0 ? (
        <Svg width={w} height={height}>
          {/* gridline */}
          <Line
            x1={padL}
            x2={w - padR}
            y1={padT + chartH}
            y2={padT + chartH}
            stroke={theme.border}
            strokeWidth={1}
          />
          <Line
            x1={padL}
            x2={w - padR}
            y1={padT + chartH / 2}
            y2={padT + chartH / 2}
            stroke={theme.border}
            strokeDasharray="2,3"
            strokeWidth={1}
          />
          <SvgText x={4} y={padT + 10} fill={theme.textMuted} fontSize={10}>
            {formatY ? formatY(max) : String(max)}
          </SvgText>
          {data.map((d, i) => {
            const h = (d.value / max) * chartH;
            const x = padL + i * (barW + barGap);
            const y = padT + chartH - h;
            const isLast = i === data.length - 1;
            const fill = theme.accent;
            const opacity = emphasizeLast && isLast ? 1 : 0.55;
            return (
              <React.Fragment key={`${d.label}-${i}`}>
                <Rect x={x} y={y} width={barW} height={Math.max(1, h)} rx={3} fill={fill} opacity={opacity} />
                {showLabels ? (
                  <SvgText
                    x={x + barW / 2}
                    y={height - 6}
                    fill={theme.textMuted}
                    fontSize={10}
                    textAnchor="middle"
                  >
                    {d.label}
                  </SvgText>
                ) : null}
              </React.Fragment>
            );
          })}
        </Svg>
      ) : (
        <View style={{ height }} />
      )}
    </View>
  );
}

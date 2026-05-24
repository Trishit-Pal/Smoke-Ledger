import React from 'react';
import { View, LayoutChangeEvent } from 'react-native';
import Svg, { Path, Line, Circle, Text as SvgText } from 'react-native-svg';
import { useTheme } from '@/hooks/useTheme';

export interface LineDatum {
  label: string;
  value: number;
}

export interface LineChartProps {
  data: LineDatum[];
  height?: number;
  formatY?: (v: number) => string;
  strokeColor?: string;
}

export function LineChart({ data, height = 160, formatY, strokeColor }: LineChartProps) {
  const theme = useTheme();
  const [w, setW] = React.useState(0);
  const onLayout = (e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width);

  if (!data.length) return <View style={{ height }} />;
  const max = Math.max(1, ...data.map((d) => d.value));
  const min = 0;
  const padL = 28;
  const padR = 8;
  const padT = 8;
  const padB = 18;
  const chartW = Math.max(0, w - padL - padR);
  const chartH = height - padT - padB;

  const points = data.map((d, i) => {
    const x = padL + (chartW * i) / Math.max(1, data.length - 1);
    const y = padT + chartH - ((d.value - min) / (max - min || 1)) * chartH;
    return { x, y, d };
  });
  const path = points
    .map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`))
    .join(' ');

  return (
    <View onLayout={onLayout} style={{ width: '100%', height }}>
      {w > 0 ? (
        <Svg width={w} height={height}>
          {/* gridlines — baseline uses ruleStrong, mid uses rule (dashed hairline) */}
          <Line x1={padL} x2={w - padR} y1={padT + chartH} y2={padT + chartH} stroke={theme.ruleStrong} strokeWidth={1} />
          <Line
            x1={padL}
            x2={w - padR}
            y1={padT + chartH / 2}
            y2={padT + chartH / 2}
            stroke={theme.rule}
            strokeDasharray="2,3"
            strokeWidth={1}
          />
          <SvgText x={4} y={padT + 10} fill={theme.text} fontSize={10}>
            {formatY ? formatY(max) : String(max)}
          </SvgText>
          <Path d={path} fill="none" stroke={strokeColor ?? theme.accent} strokeWidth={2} />
          {points.map((p, i) => (
            <Circle key={i} cx={p.x} cy={p.y} r={2.5} fill={strokeColor ?? theme.accent} />
          ))}
        </Svg>
      ) : (
        <View style={{ height }} />
      )}
    </View>
  );
}

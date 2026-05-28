// ConfettiBurst — one-shot paper-fleck burst (RN port of the web version).
//
// Renders a fixed number of thin rectangles in the editorial palette (ink,
// teal accent, terracotta warn-earth) that drift outward + downward and fade
// out. Distribution is memoised on `seed` so the burst is stable for its
// lifetime; pass a new `seed` to re-randomise. Decorative; pointerEvents none;
// aria-hidden.

import React from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '@/hooks/useTheme';

type FleckColor = 'accent' | 'ink' | 'warn';

interface Fleck {
  /** Horizontal anchor (percent of parent width). */
  x: number;
  dx: number;
  dy: number;
  delay: number;
  color: FleckColor;
  w: number;
  h: number;
}

function buildFlecks(count: number, _seed: number): Fleck[] {
  // `_seed` is just a memo key — Math.random() inside is fine, the distribution
  // only has to be stable for the burst's lifetime, not deterministic.
  const palette: FleckColor[] = ['accent', 'ink', 'warn'];
  return Array.from({ length: count }, (_, i) => ({
    x: 50 + (Math.random() - 0.5) * 30,
    dx: (Math.random() - 0.5) * 220,
    dy: 140 + Math.random() * 120,
    delay: Math.random() * 300,
    color: palette[i % palette.length] ?? 'accent',
    w: 2,
    h: 6 + Math.random() * 4,
  }));
}

export interface ConfettiBurstProps {
  active: boolean;
  /** Number of flecks. Default 14 (editorial restraint). */
  count?: number;
  /** Re-randomise distribution when this value changes. */
  seed?: number;
}

export function ConfettiBurst({ active, count = 14, seed = 0 }: ConfettiBurstProps) {
  const flecks = React.useMemo(() => buildFlecks(count, seed), [count, seed]);
  if (!active) return null;
  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no"
      style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'visible' }}
    >
      {flecks.map((f, i) => (
        <FleckMark key={`${seed}-${i}`} fleck={f} />
      ))}
    </View>
  );
}

function FleckMark({ fleck }: { fleck: Fleck }) {
  const theme = useTheme();
  const t = useSharedValue(0);

  React.useEffect(() => {
    t.value = withDelay(
      fleck.delay,
      withTiming(1, { duration: 1400, easing: Easing.bezier(0.2, 0.6, 0.3, 1) }),
    );
  }, [fleck.delay, t]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: fleck.dx * t.value },
      { translateY: fleck.dy * t.value },
    ],
    opacity: 1 - t.value,
  }));

  const color =
    fleck.color === 'accent' ? theme.accent
    : fleck.color === 'warn' ? theme.warnEarth
    : theme.text;

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          left: `${fleck.x}%`,
          top: 0,
          width: fleck.w,
          height: fleck.h,
          backgroundColor: color,
        },
        animStyle,
      ]}
    />
  );
}

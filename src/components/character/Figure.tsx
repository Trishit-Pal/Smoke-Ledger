// Figure — minimal geometric stick-figure with 8 mood variations.
//
// RN port of web/components/character/Figure.tsx. The mood determines which
// shapes render (mouth path, ribs, smoke ember, thumb, applaud flecks, raised
// arms for victory, raised-hand wave for bye); a subtle reanimated bob loops
// in the background. Reduce-motion freezes the bob; the static mood shapes
// still carry semantic meaning so the figure remains useful while motionless.
//
// Sizing: viewBox is 200x240 (aspect 5:6). Pass `size` (width); height auto.

import React from 'react';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, G, Line, Path, Rect } from 'react-native-svg';
import { useTheme } from '@/hooks/useTheme';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import type { Mood } from '@/lib/character/mood';

export interface FigureProps {
  mood?: Mood;
  /** Width in px. Height auto-scales to 1.2x width (5:6). */
  size?: number;
  /** Stroke width for the ink lines. Default 2.4. */
  stroke?: number;
}

export function Figure({ mood = 'greet', size = 96, stroke = 2.4 }: FigureProps) {
  const theme = useTheme();
  const reduce = useReduceMotion();
  const bob = useSharedValue(0);

  React.useEffect(() => {
    if (reduce) {
      bob.value = 0;
      return;
    }
    // Subtle 3.6s idle drift — the figure breathes without being distracting
    bob.value = withRepeat(
      withSequence(
        withTiming(-1.5, { duration: 1800, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: 1800, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
      false,
    );
  }, [reduce, bob]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: bob.value }],
  }));

  const ink = theme.text;
  const accent = theme.accent;
  const warn = theme.warnEarth;
  const stroke2 = Math.max(1, stroke - 0.4);
  const stroke3 = Math.max(1, stroke - 0.6);
  const stroke4 = Math.max(0.8, stroke - 0.8);

  const showSmoke = mood === 'regret';
  const showThumb = mood === 'thumb';
  const showRibs = mood === 'breathe';
  const showFlecks = mood === 'applaud';
  const armsUp = mood === 'victory';
  const armWave = mood === 'bye';

  const height = size * 1.2;

  return (
    <Animated.View style={[{ width: size, height }, animStyle]} accessibilityElementsHidden importantForAccessibility="no">
      <Svg width={size} height={height} viewBox="0 0 200 240">
        {/* Applaud flecks above the head */}
        {showFlecks ? (
          <G>
            <Rect x={40} y={20} width={2} height={8} fill={accent} />
            <Rect x={70} y={10} width={2} height={6} fill={ink} />
            <Rect x={105} y={22} width={2} height={8} fill={accent} />
            <Rect x={140} y={14} width={2} height={6} fill={ink} />
            <Rect x={160} y={26} width={2} height={8} fill={accent} />
            <Rect x={25} y={30} width={2} height={6} fill={ink} />
          </G>
        ) : null}

        {/* Head */}
        <Circle cx={100} cy={50} r={22} stroke={ink} strokeWidth={stroke} fill="none" />
        <Circle cx={92} cy={48} r={2} fill={ink} />
        <Circle cx={108} cy={48} r={2} fill={ink} />

        {/* Mouth per mood */}
        {mood === 'greet'   ? <Path d="M 92 58 Q 100 62 108 58" stroke={ink} strokeWidth={stroke2} fill="none" /> : null}
        {mood === 'regret'  ? <Path d="M 92 60 Q 100 56 108 60" stroke={ink} strokeWidth={stroke2} fill="none" /> : null}
        {mood === 'thumb'   ? <Path d="M 93 58 Q 100 63 107 58" stroke={ink} strokeWidth={stroke2} fill="none" /> : null}
        {mood === 'applaud' ? <Path d="M 90 57 Q 100 64 110 57" stroke={ink} strokeWidth={stroke2} fill="none" /> : null}
        {mood === 'victory' ? <Path d="M 90 56 Q 100 64 110 56" stroke={ink} strokeWidth={stroke2} fill="none" /> : null}
        {mood === 'breathe' ? <Circle cx={100} cy={59} r={2.5} stroke={ink} strokeWidth={stroke3} fill="none" /> : null}
        {mood === 'concern' ? <Path d="M 93 60 L 107 60" stroke={ink} strokeWidth={stroke2} fill="none" /> : null}
        {mood === 'bye'     ? <Path d="M 92 58 Q 100 62 108 58" stroke={ink} strokeWidth={stroke2} fill="none" /> : null}

        {/* Torso */}
        <Line x1={100} y1={72} x2={100} y2={150} stroke={ink} strokeWidth={stroke} />

        {/* Breathing ribs */}
        {showRibs ? (
          <G>
            <Path d="M 88 92 Q 100 96 112 92"  stroke={accent} strokeWidth={stroke4} fill="none" opacity={0.6} />
            <Path d="M 86 104 Q 100 108 114 104" stroke={accent} strokeWidth={stroke4} fill="none" opacity={0.5} />
            <Path d="M 88 116 Q 100 120 112 116" stroke={accent} strokeWidth={stroke4} fill="none" opacity={0.4} />
          </G>
        ) : null}

        {/* Arms — vary by mood */}
        {armsUp ? (
          <>
            <Line x1={100} y1={85} x2={70}  y2={48} stroke={ink} strokeWidth={stroke} />
            <Line x1={100} y1={85} x2={130} y2={48} stroke={ink} strokeWidth={stroke} />
          </>
        ) : armWave ? (
          <>
            {/* left arm down, right arm up in a wave */}
            <Line x1={100} y1={85} x2={70}  y2={130} stroke={ink} strokeWidth={stroke} />
            <Line x1={100} y1={85} x2={140} y2={50}  stroke={ink} strokeWidth={stroke} />
            <Circle cx={140} cy={50} r={3} fill={accent} />
          </>
        ) : (
          <>
            <Line x1={100} y1={85} x2={70}  y2={130} stroke={ink} strokeWidth={stroke} />
            <Line x1={100} y1={85} x2={130} y2={130} stroke={ink} strokeWidth={stroke} />
          </>
        )}

        {/* Smoke ember + puffs (regret) */}
        {showSmoke ? (
          <G>
            <Line x1={130} y1={130} x2={142} y2={128} stroke={ink} strokeWidth={stroke3} />
            <Circle cx={143} cy={128} r={2} fill={warn} />
            <Circle cx={143} cy={118} r={3} stroke={warn} strokeWidth={1} fill="none" opacity={0.45} />
            <Circle cx={146} cy={108} r={3} stroke={warn} strokeWidth={1} fill="none" opacity={0.25} />
          </G>
        ) : null}

        {/* Thumbs-up bauble */}
        {showThumb ? (
          <G>
            <Circle cx={130} cy={128} r={3.5} fill={accent} />
            <Rect x={128} y={118} width={4} height={8} rx={2} fill={accent} />
          </G>
        ) : null}

        {/* Legs */}
        <Line x1={100} y1={150} x2={80}  y2={220} stroke={ink} strokeWidth={stroke} />
        <Line x1={100} y1={150} x2={120} y2={220} stroke={ink} strokeWidth={stroke} />
      </Svg>
    </Animated.View>
  );
}

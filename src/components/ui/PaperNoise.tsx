/**
 * PaperNoise — subtle ink-on-paper atmosphere overlay.
 *
 * Mirrors the web's `.paper-noise` utility (globals.css) which uses an SVG
 * feTurbulence filter at 6–8 % opacity. We replicate that with react-native-svg
 * 15.x filter primitives (FeTurbulence + FeColorMatrix inside Filter + Defs).
 *
 * The overlay is purely decorative:
 *   - pointerEvents="none" so touches pass through
 *   - aria-hidden / importantForAccessibility="no" so screen readers skip it
 *
 * Default opacity: ~0.06 light, ~0.04 dark (mirrors web's 8 % / 5 % values).
 */

import React from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import Svg, { Defs, Filter, FeTurbulence, FeColorMatrix, Rect } from 'react-native-svg';
import { useTheme } from '@/hooks/useTheme';

export interface PaperNoiseProps {
  /** Width of the overlay area — defaults to '100%' string or a number in points. */
  width?: number | string;
  /** Height of the overlay area — defaults to '100%' string or a number in points. */
  height?: number | string;
  /** Override opacity (0–1). Defaults to theme-appropriate value (0.06 light / 0.04 dark). */
  opacity?: number;
  style?: StyleProp<ViewStyle>;
}

export function PaperNoise({ width = '100%', height = '100%', opacity, style }: PaperNoiseProps) {
  const theme = useTheme();
  // Editorial: 6 % light (ink on paper), 4 % dark (light grain on dark surface)
  const resolvedOpacity = opacity ?? (theme.mode === 'dark' ? 0.04 : 0.06);

  // FeColorMatrix values for dark-ink noise on light surface (light mode):
  //   R=0 G=0 B=0 A=0.08 → near-black transparent noise (mirrors web's 0 0 0 0 0 ... 0.08 0)
  // For dark mode we use a near-white grain (mirrors web's 1 1 1 ... 0.05 0)
  const colorMatrixValues =
    theme.mode === 'dark'
      ? '0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.9 0'
      : '0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.9 0';

  return (
    <Svg
      width={width as string | number}
      height={height as string | number}
      // Decorative — no information carried
      accessibilityElementsHidden
      importantForAccessibility="no"
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          top: 0,
          left: 0,
          opacity: resolvedOpacity,
        },
        style,
      ]}
    >
      <Defs>
        <Filter id="paper-noise-filter" x="0%" y="0%" width="100%" height="100%">
          <FeTurbulence
            type="fractalNoise"
            baseFrequency={0.85}
            numOctaves={2}
            stitchTiles="stitch"
          />
          <FeColorMatrix
            type="matrix"
            values={colorMatrixValues}
          />
        </Filter>
      </Defs>
      {/* Full-area rect with the noise filter applied */}
      <Rect
        x={0}
        y={0}
        width="100%"
        height="100%"
        filter="url(#paper-noise-filter)"
      />
    </Svg>
  );
}

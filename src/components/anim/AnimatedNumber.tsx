import React, { useEffect, useState } from 'react';
import {
  useSharedValue,
  withTiming,
  Easing,
  useAnimatedReaction,
  runOnJS,
} from 'react-native-reanimated';
import { Text as RNText, TextProps, StyleProp, TextStyle } from 'react-native';
import { useReduceMotion } from '@/hooks/useReduceMotion';

export interface AnimatedNumberProps extends Omit<TextProps, 'children'> {
  value: number;
  format?: (n: number) => string;
  duration?: number;
  style?: StyleProp<TextStyle>;
}

/**
 * Smoothly animates a numeric text value from its previous render to the new
 * `value` over `duration` ms. Honours OS reduce-motion preference.
 *
 * Implementation: a shared value drives a JS-side `setState` via
 * `useAnimatedReaction` — reliable across iOS / Android without depending on
 * the experimental "text" prop bridge.
 */
export function AnimatedNumber({ value, format, duration = 600, style, ...rest }: AnimatedNumberProps) {
  const reduce = useReduceMotion();
  const sv = useSharedValue(value);
  const [display, setDisplay] = useState(value);

  useEffect(() => {
    if (reduce) {
      sv.value = value;
      setDisplay(value);
    } else {
      sv.value = withTiming(value, { duration, easing: Easing.out(Easing.cubic) });
    }
  }, [value, reduce, duration]); // sv is a stable shared value — exclude from deps to avoid animation loop

  useAnimatedReaction(
    () => sv.value,
    (v) => {
      runOnJS(setDisplay)(v);
    },
    [],
  );

  return <RNText {...rest} style={style}>{format ? format(display) : Math.round(display).toString()}</RNText>;
}

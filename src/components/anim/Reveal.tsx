import React, { useEffect } from 'react';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { ViewProps, StyleProp, ViewStyle } from 'react-native';
import { useReduceMotion } from '@/hooks/useReduceMotion';

/**
 * Fades + scales-up content on mount and on `dependencyKey` change. Used to
 * make charts feel responsive when window or data changes.
 */
export function Reveal({
  dependencyKey,
  duration = 520,
  style,
  children,
  ...rest
}: ViewProps & { dependencyKey?: string | number; duration?: number; style?: StyleProp<ViewStyle> }) {
  const reduce = useReduceMotion();
  const opacity = useSharedValue(reduce ? 1 : 0);
  const scale = useSharedValue(reduce ? 1 : 0.96);

  useEffect(() => {
    if (reduce) {
      opacity.value = 1;
      scale.value = 1;
      return;
    }
    opacity.value = 0;
    scale.value = 0.96;
    opacity.value = withTiming(1, { duration, easing: Easing.out(Easing.cubic) });
    scale.value = withTiming(1, { duration, easing: Easing.out(Easing.cubic) });
  }, [dependencyKey, duration, reduce, opacity, scale]);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={[style, animStyle]} {...rest}>
      {children}
    </Animated.View>
  );
}

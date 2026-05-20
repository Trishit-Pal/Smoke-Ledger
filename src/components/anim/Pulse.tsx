import React, { useEffect } from 'react';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
  cancelAnimation,
} from 'react-native-reanimated';
import { ViewProps, StyleProp, ViewStyle } from 'react-native';
import { useReduceMotion } from '@/hooks/useReduceMotion';

/**
 * Subtle 1.0 → 1.04 → 1.0 loop. Use sparingly — only on a single CTA at a time.
 */
export function Pulse({
  active = true,
  style,
  children,
  ...rest
}: ViewProps & { active?: boolean; style?: StyleProp<ViewStyle> }) {
  const reduce = useReduceMotion();
  const scale = useSharedValue(1);

  useEffect(() => {
    if (!active || reduce) {
      cancelAnimation(scale);
      scale.value = 1;
      return;
    }
    scale.value = withRepeat(
      withTiming(1.04, { duration: 1100, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
    return () => {
      cancelAnimation(scale);
      scale.value = 1;
    };
  }, [active, reduce, scale]);

  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Animated.View style={[style, animStyle]} {...rest}>
      {children}
    </Animated.View>
  );
}

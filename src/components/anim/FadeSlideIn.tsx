import React from 'react';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { ViewProps, StyleProp, ViewStyle } from 'react-native';
import { useReduceMotion } from '@/hooks/useReduceMotion';

export interface FadeSlideInProps extends ViewProps {
  index?: number;
  delay?: number;
  step?: number;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
}

/**
 * Wraps a view so it fades + slides up on mount. Use `index` for staggered
 * children — each subsequent child waits `step` ms longer than the previous.
 */
export function FadeSlideIn({
  index = 0,
  delay = 60,
  step = 60,
  disabled,
  style,
  children,
  ...rest
}: FadeSlideInProps) {
  const reduce = useReduceMotion();
  if (reduce || disabled) {
    return (
      <Animated.View style={style} {...rest}>
        {children}
      </Animated.View>
    );
  }
  const total = delay + index * step;
  return (
    <Animated.View
      entering={FadeInDown.delay(total).duration(420).springify().damping(18)}
      style={style}
      {...rest}
    >
      {children}
    </Animated.View>
  );
}

export function FadeInWrap({ children, style, disabled, ...rest }: ViewProps & { disabled?: boolean }) {
  const reduce = useReduceMotion();
  if (reduce || disabled) return <Animated.View style={style} {...rest}>{children}</Animated.View>;
  return (
    <Animated.View entering={FadeIn.duration(300)} style={style} {...rest}>
      {children}
    </Animated.View>
  );
}

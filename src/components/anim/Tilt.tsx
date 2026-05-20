import React, { useMemo } from 'react';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { ViewProps, StyleProp, ViewStyle, LayoutChangeEvent, Platform } from 'react-native';
import { useReduceMotion } from '@/hooks/useReduceMotion';

export interface TiltProps extends ViewProps {
  maxDeg?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * Touch-driven 3D tilt — gives "depth" on hero cards. The card pitches up to
 * ±maxDeg on rotateX/rotateY based on touch position relative to its center.
 */
export function Tilt({ maxDeg = 6, style, children, ...rest }: TiltProps) {
  const reduce = useReduceMotion();
  const rx = useSharedValue(0);
  const ry = useSharedValue(0);
  const scale = useSharedValue(1);
  const w = useSharedValue(1);
  const h = useSharedValue(1);

  const onLayout = (e: LayoutChangeEvent) => {
    w.value = e.nativeEvent.layout.width || 1;
    h.value = e.nativeEvent.layout.height || 1;
  };

  const pan = useMemo(() => Gesture.Pan()
    .onUpdate((e) => {
      const dx = (e.x - w.value / 2) / (w.value / 2);
      const dy = (e.y - h.value / 2) / (h.value / 2);
      ry.value = Math.max(-1, Math.min(1, dx)) * maxDeg;
      rx.value = -Math.max(-1, Math.min(1, dy)) * maxDeg;
      scale.value = withTiming(1.02, { duration: 120 });
    })
    .onFinalize(() => {
      rx.value = withSpring(0, { damping: 12, stiffness: 120 });
      ry.value = withSpring(0, { damping: 12, stiffness: 120 });
      scale.value = withTiming(1, { duration: 200 });
    }), [maxDeg]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [
      { perspective: 800 },
      { rotateX: `${rx.value}deg` },
      { rotateY: `${ry.value}deg` },
      { scale: scale.value },
    ],
  }));

  if (reduce || Platform.OS === 'web') {
    return (
      <Animated.View style={style} onLayout={onLayout} {...rest}>
        {children}
      </Animated.View>
    );
  }

  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={[style, animStyle]} onLayout={onLayout} {...rest}>
        {children}
      </Animated.View>
    </GestureDetector>
  );
}

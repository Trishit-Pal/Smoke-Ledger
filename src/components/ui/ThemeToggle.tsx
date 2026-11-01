import React, { useEffect } from 'react';
import { View, Pressable } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { SETTLE } from '@/constants/motion';
import { Text } from './Text';
import { useTheme } from '@/hooks/useTheme';
import { useThemeStore, type ThemePreference } from '@/store/theme';
import { radius } from '@/constants/theme';
import { tap } from '@/lib/haptics';
import { useReduceMotion } from '@/hooks/useReduceMotion';

const OPTIONS: Array<{ value: ThemePreference; symbol: string; label: string }> = [
  { value: 'light',  symbol: '○', label: 'Light' },
  { value: 'system', symbol: '◐', label: 'Auto'  },
  { value: 'dark',   symbol: '●', label: 'Dark'  },
];

const PILL_W = 96;
const PILL_H = 36;
const SEGMENT_W = PILL_W / OPTIONS.length;

export function ThemeToggle() {
  const theme = useTheme();
  const reduce = useReduceMotion();
  const { preference, setPreference } = useThemeStore();
  const activeIdx = OPTIONS.findIndex((o) => o.value === preference);
  const slideX = useSharedValue(0);

  useEffect(() => {
    const target = activeIdx * SEGMENT_W;
    slideX.value = reduce ? target : withTiming(target, SETTLE);
  }, [activeIdx, reduce, slideX]);

  const thumbStyle = useAnimatedStyle(() => ({ transform: [{ translateX: slideX.value }] }));

  return (
    <View
      style={{
        width: PILL_W,
        height: PILL_H,
        borderRadius: radius.pill,
        backgroundColor: theme.bgElevated,
        borderWidth: 1,
        borderColor: theme.border,
        flexDirection: 'row',
        overflow: 'hidden',
      }}
      accessibilityRole="radiogroup"
      accessibilityLabel="Appearance mode"
    >
      <Animated.View
        style={[
          {
            position: 'absolute',
            width: SEGMENT_W,
            height: PILL_H - 2,
            top: 0,
            left: 0,
            borderRadius: radius.pill,
            backgroundColor: theme.accentSoft,
            borderWidth: 1,
            borderColor: theme.accent + '50',
          },
          thumbStyle,
        ]}
      />

      {OPTIONS.map((opt, i) => (
        <Pressable
          key={opt.value}
          onPress={() => { tap(); setPreference(opt.value); }}
          accessibilityRole="radio"
          accessibilityLabel={opt.label}
          accessibilityState={{ checked: activeIdx === i }}
          style={{ width: SEGMENT_W, height: PILL_H, alignItems: 'center', justifyContent: 'center', zIndex: 1 }}
        >
          <Text variant="caption" color={activeIdx === i ? theme.accent : theme.textFaint} style={{ letterSpacing: 0 }}>
            {opt.symbol}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

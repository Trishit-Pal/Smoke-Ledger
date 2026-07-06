/* eslint-disable react-hooks/immutability -- Reanimated SharedValue is a mutable box; writing `.value` in press handlers is its documented API */
import React, { memo, useEffect } from 'react';
import { View, Pressable, ActivityIndicator } from 'react-native';
import { Tabs, Redirect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { Text } from '@/components/ui/Text';
import { useTheme } from '@/hooks/useTheme';
import { spacing, radius } from '@/constants/theme';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import { useAuth } from '@/store/auth';
import { useSession } from '@/store/session';
import { hasRequiredConsents, isOnboarded } from '@/lib/compliance';

// Derive the tab-bar prop type from expo-router's own Tabs so it always matches
// expo-router's vendored react-navigation types (avoids cross-package type drift).
type TabBarProps = Parameters<NonNullable<React.ComponentProps<typeof Tabs>['tabBar']>>[0];

const TABS = [
  { name: 'index',    glyph: '◇', label: 'Home',     a11y: 'Home tab' },
  { name: 'log',      glyph: '+', label: 'Log',      a11y: 'Log a cigarette tab' },
  { name: 'trends',   glyph: '~', label: 'Trends',   a11y: 'Trends and patterns tab' },
  { name: 'history',  glyph: '≡', label: 'History',  a11y: 'History of logs tab' },
  { name: 'goals',    glyph: '◎', label: 'Goals',    a11y: 'Goals tab' },
  { name: 'settings', glyph: '⚙', label: 'Settings', a11y: 'Settings tab' },
];

const INDICATOR_W = 36;
const N = TABS.length;

function CustomTabBar({ state, navigation }: TabBarProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const reduce = useReduceMotion();
  const BAR_H = 56;
  const BOTTOM_PAD = Math.max(insets.bottom, 8);

  // Pixel-based indicator position — avoids % strings in worklets (JS-thread trap)
  const containerW = useSharedValue(0);
  const indicatorPos = useSharedValue(state.index);

  useEffect(() => {
    indicatorPos.value = reduce
      ? state.index
      : withSpring(state.index, { damping: 22, stiffness: 300 });
  }, [state.index, reduce, indicatorPos]);

  const indicatorStyle = useAnimatedStyle(() => {
    const tabW = containerW.value / N;
    return { left: indicatorPos.value * tabW + tabW / 2 - INDICATOR_W / 2 };
  });

  return (
    <View
      style={{
        backgroundColor: theme.bgElevated,
        borderTopWidth: 1,
        borderTopColor: theme.border,
        paddingBottom: BOTTOM_PAD,
        paddingTop: 6,
        height: BAR_H + BOTTOM_PAD,
        shadowColor: theme.mode === 'dark' ? theme.accent : '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: theme.mode === 'dark' ? 0.06 : 0.04,
        shadowRadius: 16,
        elevation: 12,
      }}
    >
      {/* Glowing indicator line above active tab */}
      <Animated.View
        style={[
          {
            position: 'absolute',
            top: 4,
            width: INDICATOR_W,
            height: 2,
            borderRadius: radius.pill,
            backgroundColor: theme.accent,
            shadowColor: theme.accent,
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 0.9,
            shadowRadius: 6,
          },
          indicatorStyle,
        ]}
      />

      <View
        style={{ flexDirection: 'row', flex: 1 }}
        onLayout={(e) => { containerW.value = e.nativeEvent.layout.width; }}
      >
        {TABS.map((tab, i) => {
          const route = state.routes[i];
          return (
            <TabItem
              key={tab.name}
              glyph={tab.glyph}
              label={tab.label}
              a11yLabel={tab.a11y}
              active={state.index === i}
              reduce={reduce}
              onPress={() => { if (state.index !== i && route) navigation.navigate(route.name); }}
            />
          );
        })}
      </View>
    </View>
  );
}

interface TabItemProps {
  glyph: string;
  label: string;
  a11yLabel: string;
  active: boolean;
  reduce: boolean;
  onPress: () => void;
}

const TabItem = memo(function TabItem({ glyph, label, a11yLabel, active, reduce, onPress }: TabItemProps) {
  const theme = useTheme();
  const pressScale = useSharedValue(1);
  const glyphScale = useSharedValue(1);

  useEffect(() => {
    glyphScale.value = reduce ? (active ? 1.15 : 1) : withSpring(active ? 1.15 : 1, { damping: 18 });
  }, [active, reduce, glyphScale]);

  const pressStyle = useAnimatedStyle(() => ({ transform: [{ scale: pressScale.value }] }));
  const glyphStyle = useAnimatedStyle(() => ({ transform: [{ scale: glyphScale.value }] }));

  return (
    <Pressable
      onPressIn={() => { if (!reduce) pressScale.value = withTiming(0.88, { duration: 80, easing: Easing.out(Easing.quad) }); }}
      onPressOut={() => { if (!reduce) pressScale.value = withSpring(1, { damping: 18 }); }}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={a11yLabel}
      accessibilityState={{ selected: active }}
      style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2 }}
    >
      <Animated.View style={[{ alignItems: 'center', gap: 2 }, pressStyle]}>
        <Animated.Text
          style={[
            { fontSize: 14, fontWeight: active ? '700' : '500', color: active ? theme.accent : theme.textFaint },
            glyphStyle,
          ]}
        >
          {glyph}
        </Animated.Text>
        <Text variant="caption" color={active ? theme.accent : theme.textFaint} style={{ fontSize: 10, letterSpacing: 0.3 }}>
          {label}
        </Text>
      </Animated.View>
    </Pressable>
  );
});

export default function TabsLayout() {
  const session = useAuth((s) => s.session);
  const initialized = useAuth((s) => s.initialized);
  const profile = useSession((s) => s.profile);
  const booted = useSession((s) => s.booted);
  const theme = useTheme();

  if (!initialized || !booted) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.bg, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color={theme.accent} />
      </View>
    );
  }

  if (!session) return <Redirect href="/login" />;
  if (!hasRequiredConsents(profile)) return <Redirect href="/onboarding/privacy" />;
  if (!isOnboarded(profile)) return <Redirect href="/onboarding/welcome" />;

  return (
    <Tabs tabBar={(props) => <CustomTabBar {...props} />} screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index"    options={{ title: 'Home' }} />
      <Tabs.Screen name="log"      options={{ title: 'Log' }} />
      <Tabs.Screen name="trends"   options={{ title: 'Trends' }} />
      <Tabs.Screen name="history"  options={{ title: 'History' }} />
      <Tabs.Screen name="goals"    options={{ title: 'Goals' }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings' }} />
    </Tabs>
  );
}

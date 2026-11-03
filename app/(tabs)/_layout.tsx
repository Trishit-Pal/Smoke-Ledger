/* eslint-disable react-hooks/immutability -- Reanimated SharedValue is a mutable box; writing `.value` in press handlers is its documented API */
import React, { memo, useEffect } from 'react';
import { View, Pressable, ActivityIndicator } from 'react-native';
import { Tabs, Redirect, usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
import { PRESS, PRESS_IN, SETTLE } from '@/constants/motion';
import { Text } from '@/components/ui/Text';
import { useTheme } from '@/hooks/useTheme';
import { spacing, radius } from '@/constants/theme';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import { useLayout } from '@/hooks/useLayout';
import { useAuth } from '@/store/auth';
import { useSession } from '@/store/session';
import { isOnboarded } from '@/lib/compliance';
import { consentGateRedirect, resumeOnboardingRoute } from '@/lib/onboardingSteps';

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
  // Landscape phone: labels drop out (glyph + a11y label remain) so the bar is
  // shorter, but each tab keeps a 44pt touch target (50 - 6 paddingTop).
  const { isShort } = useLayout();
  const BAR_H = isShort ? 50 : 56;
  // Absolute children ignore the bar's paddingLeft, so the indicator adds the
  // inset itself to stay centred over the active tab on a rotated notched phone.
  const insetLeft = insets.left;
  const BOTTOM_PAD = Math.max(insets.bottom, isShort ? spacing.xs : spacing.sm);

  // Pixel-based indicator position — avoids % strings in worklets (JS-thread trap)
  const containerW = useSharedValue(0);
  const indicatorPos = useSharedValue(state.index);

  useEffect(() => {
    indicatorPos.value = reduce
      ? state.index
      : withTiming(state.index, SETTLE);
  }, [state.index, reduce, indicatorPos]);

  const indicatorStyle = useAnimatedStyle(() => {
    const tabW = containerW.value / N;
    return { left: insetLeft + indicatorPos.value * tabW + tabW / 2 - INDICATOR_W / 2 };
  });

  return (
    <View
      style={{
        backgroundColor: theme.bgElevated,
        borderTopWidth: 1,
        borderTopColor: theme.border,
        paddingBottom: BOTTOM_PAD,
        // Rotated notched phones put the notch/home bar at the sides.
        paddingLeft: insets.left,
        paddingRight: insets.right,
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
              compact={isShort}
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
  compact: boolean;
  onPress: () => void;
}

const TabItem = memo(function TabItem({ glyph, label, a11yLabel, active, reduce, compact, onPress }: TabItemProps) {
  const theme = useTheme();
  const pressScale = useSharedValue(1);
  const glyphScale = useSharedValue(1);

  useEffect(() => {
    glyphScale.value = reduce ? (active ? 1.15 : 1) : withTiming(active ? 1.15 : 1, SETTLE);
  }, [active, reduce, glyphScale]);

  const pressStyle = useAnimatedStyle(() => ({ transform: [{ scale: pressScale.value }] }));
  const glyphStyle = useAnimatedStyle(() => ({ transform: [{ scale: glyphScale.value }] }));

  return (
    <Pressable
      onPressIn={() => { if (!reduce) pressScale.value = withTiming(0.88, PRESS_IN); }}
      onPressOut={() => { if (!reduce) pressScale.value = withTiming(1, PRESS); }}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={a11yLabel}
      accessibilityState={{ selected: active }}
      style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2 }}
    >
      {/* Landscape has width, not height: compact lays glyph + label in a row
          instead of dropping the label (the glyphs are plain text marks). */}
      <Animated.View
        style={[
          compact
            ? { flexDirection: 'row', alignItems: 'center', gap: spacing.sm }
            : { alignItems: 'center', gap: 2 },
          pressStyle,
        ]}
      >
        <Animated.Text
          maxFontSizeMultiplier={1.4}
          style={[
            { fontSize: 14, fontWeight: active ? '700' : '500', color: active ? theme.accent : theme.textFaint },
            glyphStyle,
          ]}
        >
          {glyph}
        </Animated.Text>
        {/* Fixed-height bar: cap scaling so large text can't clip the label. */}
        <Text
          variant="caption"
          maxFontSizeMultiplier={1.3}
          color={active ? theme.accent : theme.textFaint}
          style={{ fontSize: 10, letterSpacing: 0.3 }}
        >
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
  const pathname = usePathname();
  const theme = useTheme();

  if (!initialized || !booted) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.bg, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color={theme.accent} />
      </View>
    );
  }

  if (!session) return <Redirect href="/login" />;
  // Mid-wizard sign-in resumes at the saved step (privacy until consented).
  if (!isOnboarded(profile)) return <Redirect href={resumeOnboardingRoute(profile)} />;
  // Re-consent gate. Settings stays reachable (export / withdraw live there) so
  // "Not now" cannot loop; /consent itself is outside the tabs.
  const consentRedirect = consentGateRedirect(pathname, profile, true);
  if (consentRedirect) return <Redirect href={consentRedirect} />;

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

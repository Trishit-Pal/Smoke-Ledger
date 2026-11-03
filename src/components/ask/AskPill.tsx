import React from 'react';
import { Pressable } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '@/components/ui/Text';
import { AnalyticsEvents } from '@/constants/events';
import { fonts, radius, spacing } from '@/constants/theme';
import { useLayout } from '@/hooks/useLayout';
import { useTheme } from '@/hooks/useTheme';
import { isAskPillVisible, tabBarHeight } from '@/lib/askPill';
import { track } from '@/services/analytics';

const MIN_TARGET = 44;

/** "home" for the index tab, else the route name ("trends", "goals"…); never question text. */
function pageOf(pathname: string): string {
  const first = pathname.split('/')[1];
  return !first || first === 'index' ? 'home' : first;
}

/**
 * A small floating "Ask" pill on the reading tabs (not Log). It sits just above
 * the tab bar and the home-bar inset, at the trailing edge, so it never covers a
 * tab target. No animation, so nothing to fall back from under reduce-motion.
 * Rendered only when EXPO_PUBLIC_LEDGER_CHAT_ENABLED is "true".
 */
export function AskPill() {
  const theme = useTheme();
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { isShort } = useLayout();

  if (!isAskPillVisible(pathname)) return null;

  return (
    <Pressable
      onPress={() => {
        void track(AnalyticsEvents.LEDGER_CHAT_OPENED, { surface: 'pill', page: pageOf(pathname) });
        router.push('/ask');
      }}
      accessibilityRole="button"
      accessibilityLabel="Ask the ledger"
      accessibilityHint="Opens a page to ask questions about your own ledger"
      style={{
        position: 'absolute',
        right: spacing.lg + insets.right,
        bottom: tabBarHeight(insets.bottom, isShort) + spacing.sm,
        minHeight: MIN_TARGET,
        minWidth: MIN_TARGET,
        paddingHorizontal: spacing.lg,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: radius.pill,
        borderWidth: 1,
        borderColor: theme.ruleStrong,
        backgroundColor: theme.bgElevated,
      }}
    >
      <Text variant="small" style={{ fontFamily: fonts.displaySoft, fontStyle: 'italic', letterSpacing: 0.2 }}>
        Ask
      </Text>
    </Pressable>
  );
}

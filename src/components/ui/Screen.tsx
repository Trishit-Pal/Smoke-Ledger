import React from 'react';
import { View, ScrollView, StatusBar, StyleProp, ViewStyle, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/hooks/useTheme';
import { spacing } from '@/constants/theme';
import { CONTENT_MAX_WIDTH } from '@/hooks/useLayout';

export interface ScreenProps {
  children: React.ReactNode;
  scroll?: boolean;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  refreshing?: boolean;
  onRefresh?: () => void;
  noPadding?: boolean;
  /** Optional masthead area rendered above the scroll content (e.g. with PaperNoise overlay) */
  masthead?: React.ReactNode;
  /**
   * Pad the bottom safe area too. Tab screens leave it to the tab bar; modals
   * and stack screens (no tab bar) set this so content clears the home bar.
   */
  bottomInset?: boolean;
}

export function Screen({
  children,
  scroll = true,
  style,
  contentStyle,
  refreshing,
  onRefresh,
  noPadding,
  masthead,
  bottomInset = false,
}: ScreenProps) {
  const theme = useTheme();
  const pad = noPadding ? 0 : spacing.lg;
  const inner = (
    // Centred reading measure: on a tablet, unfolded foldable or landscape the
    // column stops at CONTENT_MAX_WIDTH instead of stretching edge to edge.
    // Screens that want two columns compose rows themselves via useLayout().
    <View
      style={[
        { flex: 1, padding: pad, gap: spacing.lg, width: '100%', maxWidth: CONTENT_MAX_WIDTH, alignSelf: 'center' },
        contentStyle,
      ]}
    >
      {children}
    </View>
  );
  return (
    <SafeAreaView
      style={[{ flex: 1, backgroundColor: theme.bg }, style]}
      edges={bottomInset ? ['top', 'left', 'right', 'bottom'] : ['top', 'left', 'right']}
    >
      <StatusBar
        barStyle={theme.mode === 'dark' ? 'light-content' : 'dark-content'}
        backgroundColor={theme.bg}
      />
      {/* Optional masthead slot — hosts PaperNoise or page headers */}
      {masthead ?? null}
      {scroll ? (
        <ScrollView
          contentContainerStyle={{ paddingBottom: spacing.xxxl }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          refreshControl={
            onRefresh
              ? <RefreshControl
                  refreshing={!!refreshing}
                  onRefresh={onRefresh}
                  tintColor={theme.accent}
                  colors={[theme.accent]}
                />
              : undefined
          }
        >
          {inner}
        </ScrollView>
      ) : (
        inner
      )}
    </SafeAreaView>
  );
}

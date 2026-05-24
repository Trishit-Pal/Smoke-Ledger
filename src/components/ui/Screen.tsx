import React from 'react';
import { View, ScrollView, StatusBar, StyleProp, ViewStyle, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/hooks/useTheme';
import { spacing } from '@/constants/theme';

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
}: ScreenProps) {
  const theme = useTheme();
  const pad = noPadding ? 0 : spacing.lg;
  const inner = (
    <View style={[{ flex: 1, padding: pad, gap: spacing.lg }, contentStyle]}>
      {children}
    </View>
  );
  return (
    <SafeAreaView
      style={[{ flex: 1, backgroundColor: theme.bg }, style]}
      edges={['top', 'left', 'right']}
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

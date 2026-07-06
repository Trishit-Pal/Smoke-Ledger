import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  FlatList,
  Dimensions,
  Pressable,
  ListRenderItemInfo,
  Linking,
  ViewToken,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  interpolate,
  Extrapolation,
  type SharedValue,
} from 'react-native-reanimated';
import { Card } from '@/components/ui/Card';
import { Text } from '@/components/ui/Text';
import { spacing, radius } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { fetchRandomFacts, markFactSeen } from '@/db/repositories/facts';
import type { SmokingFact } from '@/constants/facts';
import { useReduceMotion } from '@/hooks/useReduceMotion';

const SPACING = 12;

export interface FactsCarouselProps {
  count?: number;
}

export function FactsCarousel({ count = 5 }: FactsCarouselProps) {
  const theme = useTheme();
  const reduce = useReduceMotion();
  const [facts, setFacts] = useState<SmokingFact[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const scrollX = useSharedValue(0);
  const listRef = useRef<FlatList<SmokingFact>>(null);
  const screenW = Dimensions.get('window').width;
  const cardW = Math.min(screenW - spacing.lg * 2, 360);

  useEffect(() => {
    let mounted = true;
    fetchRandomFacts(count).then((list) => {
      if (mounted) setFacts(list);
    });
    return () => { mounted = false; };
  }, [count]);

  // Stable identity (FlatList forbids changing onViewableItemsChanged between
  // renders) without reading a ref during render.
  const onViewable = useCallback(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    const first = viewableItems[0];
    if (first?.index != null) {
      setActiveIdx(first.index);
      const f = first.item as SmokingFact;
      if (f?.id) markFactSeen(f.id).catch(() => {});
    }
  }, []);

  if (facts.length === 0) return null;

  const renderItem = ({ item, index }: ListRenderItemInfo<SmokingFact>) => (
    <FactCard
      fact={item}
      index={index}
      scrollX={scrollX}
      cardW={cardW}
      reduce={reduce}
    />
  );

  return (
    <View style={{ gap: spacing.sm }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text variant="h3">Did you know</Text>
        <Text variant="caption" muted>
          {`${activeIdx + 1} / ${facts.length}`}
        </Text>
      </View>
      <FlatList
        ref={listRef}
        data={facts}
        keyExtractor={(f) => f.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        snapToInterval={cardW + SPACING}
        decelerationRate="fast"
        contentContainerStyle={{ paddingRight: spacing.lg }}
        ItemSeparatorComponent={() => <View style={{ width: SPACING }} />}
        onScroll={(e) => { scrollX.value = e.nativeEvent.contentOffset.x; }}
        scrollEventThrottle={16}
        renderItem={renderItem}
        viewabilityConfig={{ itemVisiblePercentThreshold: 60 }}
        onViewableItemsChanged={onViewable}
      />
      <View style={{ flexDirection: 'row', gap: 4, justifyContent: 'center', marginTop: 4 }}>
        {facts.map((_, i) => (
          <View
            key={i}
            style={{
              height: 4,
              width: i === activeIdx ? 18 : 4,
              borderRadius: radius.pill,
              backgroundColor: i === activeIdx ? theme.accent : theme.border,
            }}
          />
        ))}
      </View>
    </View>
  );
}

function FactCard({
  fact,
  index,
  scrollX,
  cardW,
  reduce,
}: {
  fact: SmokingFact;
  index: number;
  scrollX: SharedValue<number>;
  cardW: number;
  reduce: boolean;
}) {
  const theme = useTheme();
  const itemW = cardW + SPACING;

  const animStyle = useAnimatedStyle(() => {
    if (reduce) return { transform: [{ scale: 1 }], opacity: 1 };
    const input = [(index - 1) * itemW, index * itemW, (index + 1) * itemW];
    const scale = interpolate(scrollX.value, input, [0.94, 1, 0.94], Extrapolation.CLAMP);
    const opacity = interpolate(scrollX.value, input, [0.7, 1, 0.7], Extrapolation.CLAMP);
    return { transform: [{ scale }], opacity };
  });

  const titleStyle = useAnimatedStyle(() => {
    if (reduce) return { transform: [{ translateX: 0 }] };
    const input = [(index - 1) * itemW, index * itemW, (index + 1) * itemW];
    const tx = interpolate(scrollX.value, input, [40, 0, -40], Extrapolation.CLAMP);
    return { transform: [{ translateX: tx }] };
  });

  const onSource = () => {
    if (fact.sourceUrl) Linking.openURL(fact.sourceUrl).catch(() => {});
  };

  return (
    <Animated.View style={[{ width: cardW }, animStyle]}>
      <Card style={{ height: 200, justifyContent: 'space-between' }}>
        <View style={{ gap: spacing.xs }}>
          <Text variant="caption" muted>
            {fact.category.toUpperCase()}
          </Text>
          <Animated.View style={titleStyle}>
            <Text variant="h2">{fact.headline}</Text>
          </Animated.View>
        </View>
        <Text variant="small" muted numberOfLines={4}>
          {fact.body}
        </Text>
        <Pressable onPress={onSource} accessibilityRole="link" accessibilityLabel={`Source: ${fact.source}`}>
          <Text variant="caption" color={theme.accent}>
            SOURCE — {fact.source}
            {fact.sourceUrl ? '  ↗' : ''}
          </Text>
        </Pressable>
      </Card>
    </Animated.View>
  );
}

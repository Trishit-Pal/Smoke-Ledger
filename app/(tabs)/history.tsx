import React, { useMemo, useState } from 'react';
import { View, Pressable, Alert } from 'react-native';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { Divider } from '@/components/ui/Divider';
import { EmptyState } from '@/components/ui/EmptyState';
import { FadeSlideIn } from '@/components/anim/FadeSlideIn';
import { Reveal } from '@/components/anim/Reveal';
import { spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { useSession } from '@/store/session';
import { formatInr } from '@/lib/format';
import { formatIndianDate, formatTime } from '@/lib/date';
import { triggerLabel } from '@/constants/triggers';
import { contextLabel } from '@/constants/contexts';
import { moodLabel } from '@/constants/moods';
import type { CigaretteLog } from '@/types';

function CravingDots({ craving }: { craving: number | null }) {
  if (craving == null) return null;
  const dots = Math.max(1, Math.min(5, Math.round((craving / 10) * 5) || 1));
  return (
    <Text variant="caption" style={{ letterSpacing: 2 }}>
      {Array.from({ length: 5 }, (_, i) => (i < dots ? '●' : '○')).join('')}
    </Text>
  );
}

export default function History() {
  const theme = useTheme();
  const logs = useSession((s) => s.logs);
  const removeLog = useSession((s) => s.removeLog);
  const [filter, setFilter] = useState<'all' | 'priced' | 'tagged'>('all');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const filtered = useMemo(() => {
    if (filter === 'priced') return logs.filter((l) => l.totalPriceInr != null);
    if (filter === 'tagged') return logs.filter((l) => l.triggerTag || l.contextTag);
    return logs;
  }, [logs, filter]);

  const grouped = useMemo(() => {
    const map = new Map<string, CigaretteLog[]>();
    for (const l of filtered) {
      const arr = map.get(l.localDate) ?? [];
      arr.push(l);
      map.set(l.localDate, arr);
    }
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [filtered]);

  const confirmDelete = (log: CigaretteLog) => {
    Alert.alert('Delete log?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => removeLog(log.id) },
    ]);
  };

  return (
    <Screen>
      <View style={{ gap: spacing.xs }}>
        <Text variant="caption" muted>
          HISTORY
        </Text>
        <Text variant="display">What you logged</Text>
      </View>

      <FadeSlideIn index={0}>
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <Chip label="All" selected={filter === 'all'} onPress={() => setFilter('all')} />
          <Chip label="With price" selected={filter === 'priced'} onPress={() => setFilter('priced')} />
          <Chip label="Tagged" selected={filter === 'tagged'} onPress={() => setFilter('tagged')} />
        </View>
      </FadeSlideIn>

      {grouped.length === 0 ? (
        <EmptyState
          title="No logs match"
          description={
            filter === 'all'
              ? 'Your logs will appear here once you start recording.'
              : 'Try a different filter.'
          }
        />
      ) : (
        grouped.map(([date, items], groupIndex) => {
          const daySticks = items.reduce((a, b) => a + b.quantity, 0);
          const daySpend = items.reduce((a, b) => a + (b.totalPriceInr ?? 0), 0);
          return (
            <FadeSlideIn key={date} index={groupIndex} delay={0} step={80}>
              <View style={{ gap: spacing.sm }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text variant="h3">{formatIndianDate(date)}</Text>
                  <Text variant="small" muted>
                    {daySticks} sticks · {formatInr(daySpend)}
                  </Text>
                </View>
                <Card padded={false}>
                  {items.map((l, i) => {
                    const isExpanded = expandedIds.has(l.id);
                    const hasMood = l.moodBefore != null || l.moodAfter != null;
                    const hasNotes = l.notes != null && l.notes.trim().length > 0;
                    const hasExpandable = hasMood || l.craving != null || hasNotes || !!l.contextTag;
                    return (
                      <View key={l.id}>
                        <Pressable
                          onPress={hasExpandable ? () => toggleExpand(l.id) : undefined}
                          onLongPress={() => confirmDelete(l)}
                          accessibilityLabel={`${l.brandNameSnap ?? 'Unlogged brand'}, ${formatTime(l.tsUtc)}${hasExpandable ? ', tap to expand' : ''}`}
                        >
                          <View style={{ padding: spacing.md, gap: 4 }}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                              <Text variant="bodyStrong">{l.brandNameSnap ?? 'Unlogged brand'}</Text>
                              <Text variant="small" muted>
                                {formatTime(l.tsUtc)}
                              </Text>
                            </View>
                            <Text variant="small" muted>
                              {l.variantSnap ? `${l.variantSnap} · ` : ''}
                              {l.quantity} × {l.purchaseMode} · {formatInr(l.totalPriceInr)}
                            </Text>
                            {l.triggerTag || l.contextTag ? (
                              <Text variant="caption" color={theme.accent}>
                                {[triggerLabel(l.triggerTag), contextLabel(l.contextTag)]
                                  .filter((s) => s && s !== '—')
                                  .join(' · ')}
                              </Text>
                            ) : null}
                            {hasExpandable ? (
                              <Text variant="caption" color={theme.textFaint}>
                                {isExpanded ? '▲ less' : '▼ mood · notes'}
                              </Text>
                            ) : null}
                          </View>
                        </Pressable>

                        {isExpanded ? (
                          <Reveal dependencyKey="open" duration={300}>
                            <View
                              style={{
                                paddingHorizontal: spacing.md,
                                paddingBottom: spacing.md,
                                gap: spacing.xs,
                                borderTopWidth: 1,
                                borderTopColor: theme.border,
                              }}
                            >
                              {hasMood ? (
                                <View style={{ flexDirection: 'row', gap: spacing.sm, paddingTop: spacing.xs }}>
                                  <Text variant="caption" muted>Mood</Text>
                                  <Text variant="caption">
                                    {moodLabel(l.moodBefore)}
                                    {l.moodBefore && l.moodAfter ? ' → ' : ''}
                                    {l.moodAfter ? moodLabel(l.moodAfter) : ''}
                                  </Text>
                                </View>
                              ) : null}
                              {l.craving != null ? (
                                <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'center' }}>
                                  <Text variant="caption" muted>Craving</Text>
                                  <CravingDots craving={l.craving} />
                                  <Text variant="caption" muted>{l.craving}/10</Text>
                                </View>
                              ) : null}
                              {l.contextTag ? (
                                <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                                  <Text variant="caption" muted>Context</Text>
                                  <Text variant="caption">{contextLabel(l.contextTag)}</Text>
                                </View>
                              ) : null}
                              {hasNotes ? (
                                <View style={{ gap: 2, paddingTop: spacing.xs }}>
                                  <Text variant="caption" muted>Notes</Text>
                                  <Text variant="small">{l.notes}</Text>
                                </View>
                              ) : null}
                            </View>
                          </Reveal>
                        ) : null}

                        {i < items.length - 1 ? <Divider inset={spacing.md} /> : null}
                      </View>
                    );
                  })}
                </Card>
              </View>
            </FadeSlideIn>
          );
        })
      )}

      <Text variant="caption" muted style={{ textAlign: 'center' }}>
        Tap a row to reveal mood & notes · long-press to delete
      </Text>
    </Screen>
  );
}

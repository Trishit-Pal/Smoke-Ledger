/**
 * History — editorial ledger, web-parity.
 *
 * Design: "the printed ledger" — hairline rules, no Card chrome, Fraunces
 * tabular numerals for day totals, date-group headers with Today/Yesterday
 * relative labels, load-older cursor pagination via listLogsPage.
 *
 * Data: initial window from useSession (≤90 days); if that slice is empty,
 * first paint loads listLogsPage with no fromDate. Deeper pages on demand.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Pressable,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { Chip } from '@/components/ui/Chip';
import { Divider } from '@/components/ui/Divider';
import { EmptyState } from '@/components/ui/EmptyState';
import { FadeSlideIn } from '@/components/anim/FadeSlideIn';
import { Reveal } from '@/components/anim/Reveal';
import { fonts, spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { useSession, ledgerTimeZone, ledgerToday, ledgerDaysAgo } from '@/store/session';
import { isDiscreetMode, maskBrandName, maskInr } from '@/lib/discreet';
import { ledgerMoney } from '@/lib/ledgerMoney';
import { formatIndianDate, formatTime } from '@/lib/date';
import { triggerLabel } from '@/constants/triggers';
import { contextLabel } from '@/constants/contexts';
import { moodLabel } from '@/constants/moods';
import { listLogsPage } from '@/db/repositories/logs';
import type { LogCursor } from '@/db/repositories/logs';
import type { CigaretteLog, PurchaseMode } from '@/types';

// ─── helpers ────────────────────────────────────────────────────────────────

function purchaseModeLabel(mode: PurchaseMode): string {
  switch (mode) {
    case 'single': return 'single';
    case 'pack': return 'pack';
    case 'carton': return 'carton';
    case 'custom': return 'custom';
  }
}

type FilterKind = 'all' | 'priced' | 'tagged';

interface DayGroup {
  date: string;
  rows: CigaretteLog[];
  totalSticks: number;
  totalSpend: number;
}

function buildGroups(logs: CigaretteLog[]): DayGroup[] {
  const map = new Map<string, DayGroup>();
  for (const log of logs) {
    const g = map.get(log.localDate) ?? {
      date: log.localDate,
      rows: [],
      totalSticks: 0,
      totalSpend: 0,
    };
    g.rows.push(log);
    g.totalSticks += log.quantity;
    g.totalSpend += log.totalPriceInr ?? 0;
    map.set(log.localDate, g);
  }
  // Sort each group's rows newest-first, then sort groups newest-first.
  for (const g of map.values()) {
    g.rows.sort((a, b) => b.tsUtc.localeCompare(a.tsUtc));
  }
  return Array.from(map.values()).sort((a, b) => b.date.localeCompare(a.date));
}

function relativeDayLabel(ymd: string, today: string, yesterday: string): string | null {
  if (ymd === today) return 'Today';
  if (ymd === yesterday) return 'Yesterday';
  return null;
}

// Dedupe two log arrays by id; preserves order of `primary`, appends new from `extra`.
function mergeUniq(primary: CigaretteLog[], extra: CigaretteLog[]): CigaretteLog[] {
  const seen = new Set(primary.map((l) => l.id));
  const toAdd = extra.filter((l) => !seen.has(l.id));
  return toAdd.length === 0 ? primary : [...primary, ...toAdd];
}

// ─── sub-components ─────────────────────────────────────────────────────────

interface CravingDotsProps {
  craving: number;
}

function CravingDots({ craving }: CravingDotsProps) {
  const dots = Math.max(1, Math.min(5, Math.round((craving / 10) * 5) || 1));
  return (
    <Text variant="caption" style={{ letterSpacing: 2 }}>
      {Array.from({ length: 5 }, (_, i) => (i < dots ? '●' : '○')).join('')}
    </Text>
  );
}

interface ExpandedDetailProps {
  log: CigaretteLog;
  borderColor: string;
}

function ExpandedDetail({ log, borderColor }: ExpandedDetailProps) {
  const hasMood = log.moodBefore != null || log.moodAfter != null;
  const hasNotes = log.notes != null && log.notes.trim().length > 0;
  return (
    <Reveal dependencyKey="open" duration={300}>
      <View
        style={{
          paddingHorizontal: spacing.md,
          paddingBottom: spacing.md,
          paddingTop: spacing.sm,
          gap: spacing.xs,
          borderTopWidth: 1,
          borderTopColor: borderColor,
        }}
      >
        {hasMood ? (
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <Text variant="caption" muted>Mood</Text>
            <Text variant="caption">
              {moodLabel(log.moodBefore)}
              {log.moodBefore && log.moodAfter ? ' → ' : ''}
              {log.moodAfter ? moodLabel(log.moodAfter) : ''}
            </Text>
          </View>
        ) : null}
        {log.craving != null ? (
          <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'center' }}>
            <Text variant="caption" muted>Craving</Text>
            <CravingDots craving={log.craving} />
            <Text variant="caption" muted>{log.craving}/10</Text>
          </View>
        ) : null}
        {log.contextTag ? (
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <Text variant="caption" muted>Context</Text>
            <Text variant="caption">{contextLabel(log.contextTag)}</Text>
          </View>
        ) : null}
        {hasNotes ? (
          <View style={{ gap: 2, paddingTop: spacing.xs }}>
            <Text variant="caption" muted>Notes</Text>
            <Text variant="small">{log.notes}</Text>
          </View>
        ) : null}
      </View>
    </Reveal>
  );
}

// ─── main screen ────────────────────────────────────────────────────────────

export default function History() {
  const theme = useTheme();
  const storeLogs = useSession((s) => s.logs);
  const profile = useSession((s) => s.profile);
  const removeLog = useSession((s) => s.removeLog);
  const discreet = isDiscreetMode(profile);

  // Accumulated logs = store window + any cursor-fetched pages (including the
  // empty-store first page, which is unbounded).
  const [extraLogs, setExtraLogs] = useState<CigaretteLog[]>([]);
  // undefined = probe in flight. Do not seed null on empty store — logs older
  // than the 90-day boot window still exist and must be fetched.
  const [cursor, setCursor] = useState<LogCursor | null | undefined>(undefined);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const mountedRef = useRef(true);

  const probedRef = useRef(false);

  const [filter, setFilter] = useState<FilterKind>('all');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const today = ledgerToday();
  const yesterday = ledgerDaysAgo(1);

  // Cleanup on unmount — guards against setState after unmount in async fetch.
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Probe once: empty store → first unbounded page; otherwise check for rows
  // older than the 90-day boot window.
  useEffect(() => {
    if (probedRef.current) return;
    probedRef.current = true;

    const snapshot = useSession.getState().logs;
    const oldest = [...snapshot].sort((a, b) => a.tsUtc.localeCompare(b.tsUtc))[0];
    let cancelled = false;

    if (!oldest) {
      listLogsPage({ limit: 50 })
        .then((page) => {
          if (cancelled || !mountedRef.current) return;
          setExtraLogs((prev) => mergeUniq(prev, page.logs));
          setCursor(page.nextCursor);
        })
        .catch(() => {
          if (cancelled || !mountedRef.current) return;
          setCursor(null);
        });
      return () => {
        cancelled = true;
      };
    }

    const probeCursor: LogCursor = { ts: oldest.tsUtc, id: oldest.id };
    listLogsPage({ cursor: probeCursor, limit: 1 })
      .then((page) => {
        if (cancelled || !mountedRef.current) return;
        setCursor(page.nextCursor !== null ? probeCursor : null);
      })
      .catch(() => {
        if (cancelled || !mountedRef.current) return;
        setCursor(null);
      });
    return () => {
      cancelled = true;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLoadMore = useCallback(() => {
    if (!cursor || isLoadingMore) return;
    const requestedCursor = cursor;
    setLoadError(null);
    setIsLoadingMore(true);
    listLogsPage({ cursor: requestedCursor, limit: 50 })
      .then((page) => {
        if (!mountedRef.current) return;
        setExtraLogs((prev) => mergeUniq(prev, page.logs));
        setCursor(page.nextCursor);
      })
      .catch((err: unknown) => {
        if (!mountedRef.current) return;
        setLoadError(err instanceof Error ? err.message : 'Failed to load older entries.');
      })
      .finally(() => {
        if (mountedRef.current) setIsLoadingMore(false);
      });
  }, [cursor, isLoadingMore]);

  const toggleExpand = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const confirmDelete = useCallback(
    (log: CigaretteLog) => {
      Alert.alert('Delete log?', 'This cannot be undone.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => void removeLog(log.id) },
      ]);
    },
    [removeLog],
  );

  // Merge store + extra, then apply filter.
  const allLogs = useMemo(() => mergeUniq(storeLogs, extraLogs), [storeLogs, extraLogs]);

  const filtered = useMemo(() => {
    if (filter === 'priced') return allLogs.filter((l) => l.totalPriceInr != null);
    if (filter === 'tagged') return allLogs.filter((l) => l.triggerTag || l.contextTag);
    return allLogs;
  }, [allLogs, filter]);

  const groups = useMemo(() => buildGroups(filtered), [filtered]);

  // Whether to show the trailing affordance row.
  const showTrailing = groups.length > 0;
  // cursor undefined = probing, null = exhausted, LogCursor = more available.
  const hasMore = cursor != null && cursor !== undefined;

  return (
    <Screen>
      {/* ─── Masthead ─── */}
      <FadeSlideIn index={0}>
        <View
          style={{
            borderBottomWidth: 1,
            borderBottomColor: theme.ruleStrong,
            paddingBottom: spacing.md,
            gap: spacing.xs,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <View style={{ flex: 1, height: 1, backgroundColor: theme.ruleStrong }} />
            <Text
              variant="caption"
              muted
              style={{ letterSpacing: 1.4, textTransform: 'uppercase' }}
            >
              History
            </Text>
            <View style={{ flex: 1, height: 1, backgroundColor: theme.ruleStrong }} />
          </View>
          <Text
            variant="small"
            faint
            style={{ textAlign: 'center', fontStyle: 'italic' }}
          >
            The printed ledger
          </Text>
        </View>
      </FadeSlideIn>

      {/* ─── Filter chips ─── */}
      <FadeSlideIn index={1}>
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <Chip label="All" selected={filter === 'all'} onPress={() => setFilter('all')} />
          <Chip
            label="With price"
            selected={filter === 'priced'}
            onPress={() => setFilter('priced')}
          />
          <Chip
            label="Tagged"
            selected={filter === 'tagged'}
            onPress={() => setFilter('tagged')}
          />
        </View>
      </FadeSlideIn>

      {/* ─── Content ─── */}
      {groups.length === 0 ? (
        cursor === undefined ? null : (
        <FadeSlideIn index={2}>
          <EmptyState
            title="No logs match"
            description={
              filter === 'all'
                ? 'Your logs will appear here once you start recording.'
                : 'Try a different filter.'
            }
          />
        </FadeSlideIn>
        )
      ) : (
        <>
          {groups.map((group, gi) => {
            const relLabel = relativeDayLabel(group.date, today, yesterday);
            return (
              <FadeSlideIn key={group.date} index={gi + 2} step={60}>
                <View>
                  {/* ─── Day header ─── */}
                  <View
                    style={{
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'flex-end',
                      paddingBottom: spacing.sm,
                      borderBottomWidth: 1,
                      borderBottomColor: theme.ruleStrong,
                    }}
                  >
                    {/* Left: relative label + date + spend */}
                    <View style={{ gap: 2 }}>
                      {relLabel ? (
                        <Text
                          variant="small"
                          style={{
                            fontFamily: fonts.serif,
                            fontStyle: 'italic',
                            color: theme.text,
                            lineHeight: 18,
                          }}
                        >
                          {relLabel}
                        </Text>
                      ) : null}
                      <Text
                        variant="caption"
                        style={{ letterSpacing: 0.5, textTransform: 'uppercase' }}
                        muted
                      >
                        {formatIndianDate(group.date)}
                      </Text>
                      <Text variant="caption" faint>
                        {maskInr(group.totalSpend, discreet, (n) => ledgerMoney(n))}
                        {' '}spent
                      </Text>
                    </View>

                    {/* Right: stick count editorial numeral */}
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text
                        variant="h1"
                        style={{
                          fontFamily: fonts.display,
                          color: theme.text,
                          fontVariant: ['tabular-nums'],
                          lineHeight: 28,
                        }}
                        accessibilityLabel={
                          discreet
                            ? 'Day total hidden'
                            : `${group.totalSticks} ${group.totalSticks === 1 ? 'cigarette' : 'cigarettes'} on this day`
                        }
                      >
                        {discreet ? '••' : group.totalSticks}
                      </Text>
                      <Text variant="caption" faint>
                        {group.totalSticks === 1 ? 'stick' : 'sticks'}
                      </Text>
                    </View>
                  </View>

                  {/* ─── Log rows — hairline ledger ─── */}
                  <View>
                    {group.rows.map((log, rowIdx) => {
                      const isExpanded = expandedIds.has(log.id);
                      const hasMood = log.moodBefore != null || log.moodAfter != null;
                      const hasNotes = log.notes != null && log.notes.trim().length > 0;
                      const hasExpandable =
                        hasMood || log.craving != null || hasNotes || !!log.contextTag;

                      return (
                        <View key={log.id}>
                          <Pressable
                            onPress={hasExpandable ? () => toggleExpand(log.id) : undefined}
                            onLongPress={() => confirmDelete(log)}
                            accessibilityLabel={`${log.brandNameSnap ?? 'Unlogged brand'}, ${formatTime(log.tsUtc, ledgerTimeZone())}${hasExpandable ? ', tap to expand' : ''}`}
                          >
                            {/* Main ledger row — brand left, price right */}
                            <View
                              style={{
                                flexDirection: 'row',
                                justifyContent: 'space-between',
                                alignItems: 'baseline',
                                paddingVertical: spacing.md,
                                gap: spacing.md,
                              }}
                            >
                              {/* Left: brand, variant + time, tags */}
                              <View style={{ flex: 1, gap: 2 }}>
                                <Text variant="bodyStrong" numberOfLines={1}>
                                  {maskBrandName(log.brandNameSnap ?? 'Unlogged brand', discreet)}
                                  {log.variantSnap && !discreet ? (
                                    <Text variant="body" muted>
                                      {' · '}
                                      {log.variantSnap}
                                    </Text>
                                  ) : null}
                                </Text>
                                <Text variant="small" muted>
                                  <Text
                                    variant="small"
                                    muted
                                    style={{ fontVariant: ['tabular-nums'] }}
                                  >
                                    {formatTime(log.tsUtc, ledgerTimeZone())}
                                  </Text>
                                  {' · '}
                                  {discreet
                                    ? '•••'
                                    : `${log.quantity} × ${purchaseModeLabel(log.purchaseMode)}`}
                                </Text>
                                {log.triggerTag || log.contextTag ? (
                                  <Text variant="caption" color={theme.accent}>
                                    {[triggerLabel(log.triggerTag), contextLabel(log.contextTag)]
                                      .filter((s) => s && s !== '—')
                                      .join(' · ')}
                                  </Text>
                                ) : null}
                                {hasExpandable ? (
                                  <Text variant="caption" faint>
                                    {isExpanded ? '▲ less' : '▼ mood · notes'}
                                  </Text>
                                ) : null}
                              </View>

                              {/* Right: price in tabular Fraunces */}
                              <Text
                                variant="body"
                                style={{ fontVariant: ['tabular-nums'] }}
                              >
                                {maskInr(log.totalPriceInr, discreet, (n) => ledgerMoney(n))}
                              </Text>
                            </View>
                          </Pressable>

                          {isExpanded ? (
                            <ExpandedDetail log={log} borderColor={theme.rule} />
                          ) : null}

                          {rowIdx < group.rows.length - 1 ? (
                            <Divider />
                          ) : null}
                        </View>
                      );
                    })}
                  </View>

                  {/* Hairline gap between groups */}
                  <View style={{ height: spacing.lg }} />
                </View>
              </FadeSlideIn>
            );
          })}

          {/* ─── Trailing affordance — load older or end mark ─── */}
          {showTrailing ? (
            <FadeSlideIn index={groups.length + 2} step={60}>
              <View
                style={{
                  borderTopWidth: 1,
                  borderTopColor: theme.rule,
                  paddingTop: spacing.md,
                  alignItems: 'center',
                  gap: spacing.sm,
                }}
              >
                {loadError ? (
                  <Text
                    variant="small"
                    style={{ textAlign: 'center', color: theme.warnEarth }}
                    accessibilityRole="alert"
                  >
                    {loadError}
                  </Text>
                ) : null}

                {cursor === undefined ? (
                  // Still probing — show nothing (no flash).
                  null
                ) : hasMore ? (
                  <Pressable
                    onPress={handleLoadMore}
                    disabled={isLoadingMore}
                    accessibilityRole="button"
                    accessibilityLabel="Load older entries"
                    accessibilityState={{ busy: isLoadingMore, disabled: isLoadingMore }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                      {isLoadingMore ? (
                        <ActivityIndicator size="small" color={theme.textMuted} />
                      ) : null}
                      <Text
                        variant="small"
                        muted
                        style={{
                          opacity: isLoadingMore ? 0.6 : 1,
                          textDecorationLine: isLoadingMore ? 'none' : 'underline',
                          textDecorationColor: theme.ruleStrong,
                          textDecorationStyle: 'solid',
                        }}
                      >
                        {isLoadingMore ? 'Loading older entries…' : 'Load older entries →'}
                      </Text>
                    </View>
                  </Pressable>
                ) : (
                  <Text variant="caption" faint style={{ fontStyle: 'italic' }}>
                    End of the ledger.
                  </Text>
                )}
              </View>
            </FadeSlideIn>
          ) : null}
        </>
      )}

      {/* ─── Hint caption ─── */}
      <Text variant="caption" faint style={{ textAlign: 'center' }}>
        Tap a row to reveal mood & notes · long-press to delete
      </Text>
    </Screen>
  );
}

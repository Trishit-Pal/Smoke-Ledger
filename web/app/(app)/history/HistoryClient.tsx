'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { formatInr } from '@/lib/format';
import { formatIndianDate, formatTime } from '@/lib/date';
import type { CigaretteLog, UserProfile } from '@/types';
import type { LogCursor } from '@web/lib/server/data';
import { isDiscreetMode, maskBrandName, maskInr } from '@/lib/discreet';
import { Button } from '@web/components/ui/Button';
import { Card } from '@web/components/ui/Card';
import { Text } from '@web/components/ui/Text';
import { EmptyState } from '@web/components/ui/EmptyState';
import { Header } from '@web/components/layout/Header';
import { fetchMoreHistoryLogs } from './actions';

type Group = {
  date: string;
  rows: CigaretteLog[];
  totalSpend: number;
  totalSticks: number;
};

function groupLogs(logs: CigaretteLog[]): Group[] {
  const map = new Map<string, Group>();
  for (const log of logs) {
    const group = map.get(log.localDate) ?? {
      date: log.localDate,
      rows: [],
      totalSpend: 0,
      totalSticks: 0,
    };
    group.rows.push(log);
    group.totalSpend += log.totalPriceInr ?? 0;
    group.totalSticks += log.quantity;
    map.set(log.localDate, group);
  }
  return Array.from(map.values()).sort((a, b) => b.date.localeCompare(a.date));
}

export interface HistoryClientProps {
  profile: UserProfile;
  logs: CigaretteLog[];
  /**
   * Initial pagination cursor from the SSR fetch. Non-null means there are
   * older logs beyond the initial 200-row / 60-day window. The "Load older"
   * button uses this to drive the `fetchMoreHistoryLogs` server action; once
   * the action returns `null` for `nextCursor`, the button hides itself.
   */
  nextCursor?: LogCursor | null;
}

export function HistoryClient({
  profile,
  logs: initialLogs,
  nextCursor: initialCursor,
}: HistoryClientProps) {
  const router = useRouter();
  const discreet = isDiscreetMode(profile);

  // F1b: keep accumulated logs + cursor in state so the "Load older" button
  // can append additional pages without a full route navigation. Initial
  // values come from the SSR-provided props so the first paint is unchanged.
  const [logs, setLogs] = React.useState<CigaretteLog[]>(initialLogs);
  const [cursor, setCursor] = React.useState<LogCursor | null>(initialCursor ?? null);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [isPending, startTransition] = React.useTransition();

  const groups = React.useMemo(() => groupLogs(logs), [logs]);

  const handleLoadMore = React.useCallback(() => {
    if (!cursor || isPending) return;
    const requestedCursor = cursor;
    setLoadError(null);
    startTransition(async () => {
      try {
        const result = await fetchMoreHistoryLogs(requestedCursor);
        setLogs((prev) => [...prev, ...result.logs]);
        setCursor(result.nextCursor);
      } catch (err) {
        setLoadError(err instanceof Error ? err.message : 'Failed to load older entries.');
      }
    });
  }, [cursor, isPending]);

  return (
    <div className="max-w-3xl mx-auto p-lg flex flex-col gap-lg pb-32">
      <Header title="History" subtitle="Every log entry" />

      {groups.length === 0 ? (
        <EmptyState
          title="No history yet"
          description="Start logging to build your timeline."
          actionLabel="Add first log"
          onAction={() => router.push('/log/new')}
        />
      ) : (
        <div className="flex flex-col gap-md">
          {groups.map((group) => (
            <Card key={group.date} padded={false}>
              <div className="px-lg py-md border-b border-border flex items-center justify-between gap-md">
                <div className="flex flex-col">
                  <Text variant="bodyStrong">{formatIndianDate(group.date)}</Text>
                  <Text variant="caption" muted>
                    {discreet ? '••• sticks' : `${group.totalSticks} sticks`}
                  </Text>
                </div>
                <Text variant="bodyStrong">
                  {maskInr(group.totalSpend, discreet, (n) => formatInr(n))}
                </Text>
              </div>

              <ul className="divide-y divide-border">
                {group.rows
                  .sort((a, b) => b.tsUtc.localeCompare(a.tsUtc))
                  .map((log) => (
                    <li key={log.id} className="px-lg py-md flex items-center justify-between gap-md">
                      <div className="min-w-0 flex flex-col">
                        <Text variant="small" className="truncate">
                          {maskBrandName(log.brandNameSnap ?? 'Unbranded', discreet)}
                          {log.variantSnap && !discreet ? (
                            <span className="text-text-muted"> · {log.variantSnap}</span>
                          ) : null}
                        </Text>
                        <Text variant="caption" muted>
                          {formatTime(log.tsUtc)} ·{' '}
                          {discreet ? '•••' : `${log.quantity} stick${log.quantity > 1 ? 's' : ''}`}
                        </Text>
                      </div>
                      <Text variant="small">
                        {maskInr(log.totalPriceInr, discreet, (n) => formatInr(n))}
                      </Text>
                    </li>
                  ))}
              </ul>
            </Card>
          ))}

          {cursor !== null ? (
            <div className="flex flex-col items-center gap-xs pt-md">
              {loadError ? (
                <Text variant="caption" color="var(--danger, #C85A54)" role="alert">
                  {loadError}
                </Text>
              ) : null}
              <Button
                title={isPending ? 'Loading…' : 'Load older entries'}
                onPress={handleLoadMore}
                variant="ghost"
                size="md"
                disabled={isPending}
                loading={isPending}
              />
            </div>
          ) : groups.length > 0 ? (
            <div className="pt-md text-center">
              <Text variant="caption" muted>
                You&apos;ve reached the end of your history.
              </Text>
            </div>
          ) : null}
        </div>
      )}

      <div className="fixed right-lg bottom-20 md:bottom-lg">
        <Link
          href="/log/new"
          className="h-12 px-lg rounded-pill bg-accent text-white font-semibold inline-flex items-center shadow-lg"
        >
          New log
        </Link>
      </div>
    </div>
  );
}

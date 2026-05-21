'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { formatInr } from '@/lib/format';
import { formatIndianDate, formatTime } from '@/lib/date';
import type { CigaretteLog, UserProfile } from '@/types';
import { isDiscreetMode, maskBrandName, maskInr } from '@/lib/discreet';
import { Card } from '@web/components/ui/Card';
import { Text } from '@web/components/ui/Text';
import { EmptyState } from '@web/components/ui/EmptyState';
import { Header } from '@web/components/layout/Header';

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
}

export function HistoryClient({ profile, logs }: HistoryClientProps) {
  const router = useRouter();
  const discreet = isDiscreetMode(profile);

  const groups = React.useMemo(() => groupLogs(logs), [logs]);

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

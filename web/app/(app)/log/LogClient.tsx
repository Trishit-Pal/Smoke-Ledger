'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { todayIst, formatTime } from '@/lib/date';
import { formatInr } from '@/lib/format';
import { triggerLabel } from '@/constants/triggers';
import type { CigaretteLog, UserProfile } from '@/types';
import { isDiscreetMode, maskBrandName, maskInr } from '@/lib/discreet';

import { Card } from '@web/components/ui/Card';
import { Button } from '@web/components/ui/Button';
import { Text } from '@web/components/ui/Text';
import { EmptyState } from '@web/components/ui/EmptyState';
import { FadeSlideIn } from '@web/components/anim/dynamic';
import { Header } from '@web/components/layout/Header';

export interface LogClientProps {
  profile: UserProfile;
  logs: CigaretteLog[];
}

export function LogClient({ profile, logs }: LogClientProps) {
  const router = useRouter();
  const today = todayIst();
  const discreet = isDiscreetMode(profile);

  const todaysLogs = React.useMemo(
    () =>
      [...logs]
        .filter((l) => l.localDate === today)
        .sort((a, b) => b.tsUtc.localeCompare(a.tsUtc)),
    [logs, today],
  );

  const recentLogs = React.useMemo(
    () => [...logs].sort((a, b) => b.tsUtc.localeCompare(a.tsUtc)).slice(0, 30),
    [logs],
  );

  return (
    <div className="max-w-2xl mx-auto p-lg flex flex-col gap-xl">
      <FadeSlideIn index={0}>
        <Header
          title="History"
          subtitle="Today's timeline and recent entries"
          rightSlot={
            <Button
              title="Add details"
              variant="ghost"
              size="sm"
              onPress={() => router.push('/log/new')}
            />
          }
        />
      </FadeSlideIn>

      {todaysLogs.length === 0 ? (
        <FadeSlideIn index={1}>
          <EmptyState
            title="Nothing logged today"
            description="Use the Home tab to quick-log, or add a detailed entry."
            actionLabel="Detailed log"
            onAction={() => router.push('/log/new')}
          />
        </FadeSlideIn>
      ) : (
        <FadeSlideIn index={1}>
          <Card>
            <Text variant="caption" muted className="mb-md">
              Today
            </Text>
            <ul className="flex flex-col gap-md">
              {todaysLogs.map((log) => (
                <li key={log.id} className="flex justify-between gap-md border-b border-border pb-md last:border-0 last:pb-0">
                  <div>
                    <Text variant="bodyStrong">
                      {maskBrandName(log.brandNameSnap ?? 'Unknown', discreet)} · {log.quantity}
                    </Text>
                    <Text variant="small" muted>
                      {formatTime(log.tsUtc)}
                      {log.triggerTag ? ` · ${triggerLabel(log.triggerTag)}` : ''}
                    </Text>
                  </div>
                  <Text variant="small" muted>
                    {log.totalPriceInr != null
                      ? maskInr(log.totalPriceInr, discreet, (n) =>
                          formatInr(n, { compact: true }),
                        )
                      : '—'}
                  </Text>
                </li>
              ))}
            </ul>
          </Card>
        </FadeSlideIn>
      )}

      <FadeSlideIn index={2}>
        <Card>
          <Text variant="caption" muted className="mb-md">
            Recent
          </Text>
          {recentLogs.length === 0 ? (
            <Text variant="small" muted>
              No entries yet.
            </Text>
          ) : (
            <ul className="flex flex-col gap-sm">
              {recentLogs.map((log) => (
                <li key={log.id} className="flex justify-between gap-md text-small">
                  <span>
                    {formatIndianDateShort(log.localDate)} ·{' '}
                    {maskBrandName(log.brandNameSnap ?? '—', discreet)} ×{log.quantity}
                  </span>
                  <span className="text-text-muted">
                    {log.totalPriceInr != null
                      ? maskInr(log.totalPriceInr, discreet, (n) =>
                          formatInr(n, { compact: true }),
                        )
                      : '—'}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </FadeSlideIn>

      <Button title="Open full history" variant="secondary" fullWidth onPress={() => router.push('/history')} />
    </div>
  );
}

function formatIndianDateShort(ymd: string): string {
  const [, month, day] = ymd.split('-');
  return `${day}/${month}`;
}

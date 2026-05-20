'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from '@/store/session';
import { createLog } from '@/db/repositories/logs';
import { todayIst, formatTime } from '@/lib/date';
import { formatInr } from '@/lib/format';
import { AnalyticsEvents } from '@/constants/events';
import { triggerLabel } from '@/constants/triggers';
import { track } from '@/services/analytics';
import type { CigaretteLog } from '@/types';

import { Card } from '@web/components/ui/Card';
import { Button } from '@web/components/ui/Button';
import { Text } from '@web/components/ui/Text';
import { Divider } from '@web/components/ui/Divider';
import { EmptyState } from '@web/components/ui/EmptyState';
import { FadeSlideIn } from '@web/components/anim/FadeSlideIn';
import { Header } from '@web/components/layout/Header';

export default function LogPage() {
  const router = useRouter();
  const { booted, boot, logs, refreshLogs } = useSession();

  const [busyKey, setBusyKey] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!booted) boot().catch(() => {});
  }, [booted, boot]);

  const today = todayIst();
  const todaysLogs = React.useMemo(
    () =>
      [...logs]
        .filter((l) => l.localDate === today)
        .sort((a, b) => b.tsUtc.localeCompare(a.tsUtc)),
    [logs, today],
  );

  const last = logs[0] ?? null;

  const quickAdd = React.useCallback(
    async (qty: 1 | 2 | 3) => {
      const key = `qty-${qty}`;
      try {
        setBusyKey(key);
        setError(null);
        const unit = last?.unitPriceInr ?? null;
        const total = unit != null ? unit * qty : null;
        await createLog({
          tsUtc: new Date().toISOString(),
          brandId: last?.brandId ?? null,
          brandNameSnap: last?.brandNameSnap ?? null,
          variantSnap: last?.variantSnap ?? null,
          quantity: qty,
          purchaseMode: 'single',
          packSize: null,
          totalPriceInr: total,
          unitPriceInr: unit,
          priceSource: unit != null ? 'inferred' : 'unknown',
          triggerTag: null,
          moodBefore: null,
          moodAfter: null,
          craving: null,
          contextTag: null,
          notes: null,
        });
        await track(AnalyticsEvents.QUICK_ADD_USED, {});
        await refreshLogs();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not save. Try again.');
      } finally {
        setBusyKey(null);
      }
    },
    [last, refreshLogs],
  );

  const repeatLast = React.useCallback(async () => {
    if (!last) return;
    try {
      setBusyKey('repeat');
      setError(null);
      await createLog({
        tsUtc: new Date().toISOString(),
        brandId: last.brandId,
        brandNameSnap: last.brandNameSnap,
        variantSnap: last.variantSnap,
        quantity: last.quantity,
        purchaseMode: last.purchaseMode,
        packSize: last.packSize,
        totalPriceInr: last.totalPriceInr,
        unitPriceInr: last.unitPriceInr,
        priceSource: last.unitPriceInr != null ? 'inferred' : 'unknown',
        triggerTag: last.triggerTag,
        moodBefore: last.moodBefore,
        moodAfter: last.moodAfter,
        craving: last.craving,
        contextTag: last.contextTag,
        notes: null,
      });
      await track(AnalyticsEvents.REPEAT_LAST_USED, {});
      await refreshLogs();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save. Try again.');
    } finally {
      setBusyKey(null);
    }
  }, [last, refreshLogs]);

  return (
    <div className="max-w-2xl mx-auto p-lg flex flex-col gap-xl">
      <FadeSlideIn index={0}>
        <Header
          title="Quick log"
          subtitle="Tap to record"
          rightSlot={
            <Button
              title="Full details"
              variant="ghost"
              size="sm"
              onPress={() => router.push('/log/new')}
            />
          }
        />
      </FadeSlideIn>

      <FadeSlideIn index={1}>
        <Card>
          <div className="grid grid-cols-3 gap-md">
            {[1, 2, 3].map((q) => (
              <Button
                key={q}
                title={`+${q} stick${q > 1 ? 's' : ''}`}
                variant={q === 1 ? 'primary' : 'secondary'}
                fullWidth
                loading={busyKey === `qty-${q}`}
                onPress={() => quickAdd(q as 1 | 2 | 3)}
              />
            ))}
          </div>
          <div className="mt-md">
            <Button
              title={
                last
                  ? `Repeat last (${last.brandNameSnap ?? 'log'} × ${last.quantity})`
                  : 'No previous log'
              }
              variant="ghost"
              fullWidth
              disabled={!last}
              loading={busyKey === 'repeat'}
              onPress={repeatLast}
            />
          </div>
          {error ? (
            <Text
              variant="small"
              color="var(--danger, #C85A54)"
              className="mt-md text-center"
            >
              {error}
            </Text>
          ) : null}
        </Card>
      </FadeSlideIn>

      <FadeSlideIn index={2}>
        <div className="flex items-center justify-between">
          <Text variant="caption" muted>
            Today’s logs
          </Text>
          <Text variant="caption" faint>
            {todaysLogs.length} entries
          </Text>
        </div>
      </FadeSlideIn>

      <FadeSlideIn index={3}>
        {todaysLogs.length === 0 ? (
          <EmptyState
            title="Nothing logged today yet"
            description="Use the quick add buttons above or open Full details for triggers, mood, and notes."
            actionLabel="Log details"
            onAction={() => router.push('/log/new')}
          />
        ) : (
          <Card padded={false}>
            <ul className="divide-y divide-border">
              {todaysLogs.map((l) => (
                <LogRow key={l.id} log={l} />
              ))}
            </ul>
          </Card>
        )}
      </FadeSlideIn>
    </div>
  );
}

function LogRow({ log }: { log: CigaretteLog }) {
  return (
    <li className="px-lg py-md flex items-center justify-between gap-md">
      <div className="min-w-0 flex flex-col">
        <Text variant="bodyStrong" className="truncate">
          {log.brandNameSnap ?? 'Unbranded'}
          {log.variantSnap ? (
            <span className="text-text-muted font-normal"> · {log.variantSnap}</span>
          ) : null}
        </Text>
        <Text variant="small" muted>
          {formatTime(log.tsUtc)} · {log.quantity} stick{log.quantity > 1 ? 's' : ''}
          {log.triggerTag ? ` · ${triggerLabel(log.triggerTag)}` : ''}
        </Text>
      </div>
      <Text variant="bodyStrong" className="shrink-0">
        {formatInr(log.totalPriceInr ?? 0, { compact: true })}
      </Text>
    </li>
  );
}

import React, { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { spacing } from '@/constants/theme';
import { useSession } from '@/store/session';
import { createLog } from '@/db/repositories/logs';
import { track } from '@/services/analytics';
import { AnalyticsEvents } from '@/constants/events';
import { success } from '@/lib/haptics';
import { formatInr } from '@/lib/format';
import { formatTime, todayIst } from '@/lib/date';
import { sticksOn, spendOn } from '@/domain/calc';
import { toSafeErrorMessage } from '@/lib/errors';
import { isDiscreetMode, maskBrandName, maskCount, maskInr } from '@/lib/discreet';

export default function LogTab() {
  const router = useRouter();
  const logs = useSession((s) => s.logs);
  const profile = useSession((s) => s.profile);
  const refreshLogs = useSession((s) => s.refreshLogs);
  const discreet = isDiscreetMode(profile);
  const [error, setError] = useState<string | null>(null);

  const today = todayIst();
  const todayLogs = logs.filter((l) => l.localDate === today).slice(0, 12);

  const quickAdd = async (quantity: number) => {
    try {
      setError(null);
      const last = logs[0];
    const now = new Date().toISOString();
    const unit = last?.unitPriceInr ?? null;
    await createLog({
      tsUtc: now,
      brandId: last?.brandId ?? null,
      brandNameSnap: last?.brandNameSnap ?? null,
      variantSnap: last?.variantSnap ?? null,
      quantity,
      purchaseMode: 'single',
      packSize: last?.packSize ?? null,
      totalPriceInr: unit != null ? unit * quantity : null,
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
    success();
    await refreshLogs();
    } catch (e) {
      setError(toSafeErrorMessage(e, 'dependency_failure'));
    }
  };

  const repeatLast = async () => {
    try {
      setError(null);
      const last = logs[0];
    if (!last) {
      router.push('/log/new');
      return;
    }
    const now = new Date().toISOString();
    await createLog({
      tsUtc: now,
      brandId: last.brandId,
      brandNameSnap: last.brandNameSnap,
      variantSnap: last.variantSnap,
      quantity: last.quantity,
      purchaseMode: last.purchaseMode,
      packSize: last.packSize,
      totalPriceInr: last.totalPriceInr,
      unitPriceInr: last.unitPriceInr,
      priceSource: last.priceSource === 'exact' ? 'inferred' : last.priceSource,
      triggerTag: last.triggerTag,
      moodBefore: last.moodBefore,
      moodAfter: last.moodAfter,
      craving: null,
      contextTag: last.contextTag,
      notes: null,
    });
    await track(AnalyticsEvents.REPEAT_LAST_USED, {});
    success();
    await refreshLogs();
    } catch (e) {
      setError(toSafeErrorMessage(e, 'dependency_failure'));
    }
  };

  return (
    <Screen>
      <View style={{ gap: spacing.xs }}>
        <Text variant="caption" muted>
          QUICK LOG
        </Text>
        <Text variant="display">Log a cigarette</Text>
      </View>

      <Card>
        <View style={{ gap: spacing.md }}>
          <View style={{ flexDirection: 'row', gap: spacing.md }}>
            <Button title="+1" onPress={() => quickAdd(1)} style={{ flex: 1 }} />
            <Button title="+2" variant="secondary" onPress={() => quickAdd(2)} style={{ flex: 1 }} />
            <Button title="+3" variant="secondary" onPress={() => quickAdd(3)} style={{ flex: 1 }} />
          </View>
          <Button title="Repeat last log" variant="ghost" fullWidth onPress={repeatLast} />
          <Button
            title="Log with full details"
            variant="secondary"
            fullWidth
            onPress={() => router.push('/log/new')}
          />
        </View>
      </Card>

      <View style={{ gap: spacing.sm }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text variant="h3">Today</Text>
          <Text variant="caption" muted>
            {maskCount(sticksOn(logs, today), discreet)} sticks ·{' '}
            {maskInr(spendOn(logs, today), discreet, (n) => formatInr(n))}
          </Text>
        </View>
        {error ? (
          <Text variant="small" color="var(--danger, #C85A54)">
            {error}
          </Text>
        ) : null}
        {todayLogs.length === 0 ? (
          <Card>
            <Text variant="small" muted>
              No cigarettes logged today yet.
            </Text>
          </Card>
        ) : (
          todayLogs.map((l) => (
            <Card key={l.id} padded>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text variant="bodyStrong">{maskBrandName(l.brandNameSnap ?? 'Unlogged brand', discreet)}</Text>
                  <Text variant="small" muted>
                    {l.variantSnap && !discreet ? `${l.variantSnap} · ` : ''}
                    {discreet ? '•••' : `${l.quantity} × ${l.purchaseMode}`}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text variant="bodyStrong">
                    {maskInr(l.totalPriceInr, discreet, (n) => formatInr(n))}
                  </Text>
                  <Text variant="small" muted>
                    {formatTime(l.tsUtc)}
                  </Text>
                </View>
              </View>
            </Card>
          ))
        )}
      </View>
    </Screen>
  );
}

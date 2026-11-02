import React, { useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { spacing, radius } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { useSession, ledgerToday } from '@/store/session';
import {
  GOAL_TYPE_META,
  emptyGoalForm,
  goalToFormState,
  buildGoalPayload,
  buildGoalPatch,
  blockingSameTypeGoal,
  goalTypeLabel,
  deriveReductionBaseline,
  type GoalFormState,
} from '@/domain/goalForm';
import type { Goal } from '@/types';

/** Clamp a typed hour string into the valid 0–23 range (mirrors the web min/max). */
function clampHour(v: string): number {
  const n = parseInt(v, 10);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(23, n));
}

export default function GoalNewScreen() {
  const router = useRouter();
  const theme = useTheme();
  const today = ledgerToday();
  const { goalId } = useLocalSearchParams<{ goalId?: string }>();

  const goals = useSession((s) => s.goals);
  const logs = useSession((s) => s.logs);
  const addGoal = useSession((s) => s.addGoal);
  const updateGoal = useSession((s) => s.updateGoal);

  const existingGoal: Goal | null = useMemo(
    () => (goalId ? (goals.find((g) => g.id === goalId) ?? null) : null),
    [goalId, goals],
  );

  const isEdit = existingGoal !== null;

  const [form, setForm] = useState<GoalFormState>(() =>
    existingGoal ? goalToFormState(existingGoal) : emptyGoalForm(),
  );

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function patch(updates: Partial<GoalFormState>) {
    setForm((prev) => ({ ...prev, ...updates }));
    setError(null);
  }

  const meta = GOAL_TYPE_META.find((m) => m.type === form.type)!;
  const derivedBaseline = deriveReductionBaseline(logs, today);
  const baselineHint = derivedBaseline > 0
    ? `Your 30-day avg is ${derivedBaseline} sticks/day — leave blank to use this.`
    : 'Enter a baseline manually — not enough recent logs to derive one.';

  async function handleSubmit() {
    setError(null);
    if (isEdit && existingGoal) {
      const result = buildGoalPatch(form, logs, today, existingGoal);
      if (!result.ok) { setError(result.error); return; }
      setBusy(true);
      try {
        await updateGoal(existingGoal.id, result.patch);
        router.back();
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Could not save goal.');
      } finally {
        setBusy(false);
      }
    } else {
      const blocker = blockingSameTypeGoal(form.type, goals);
      if (blocker) {
        setError(
          `You already have a ${goalTypeLabel(form.type).toLowerCase()} goal. Complete it before adding another.`,
        );
        return;
      }
      const result = buildGoalPayload(form, logs, today);
      if (!result.ok) { setError(result.error); return; }
      setBusy(true);
      try {
        await addGoal(result.payload);
        router.back();
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Could not create goal.');
      } finally {
        setBusy(false);
      }
    }
  }

  const pillStyle = (active: boolean) => ({
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: active ? theme.accent : theme.border,
    backgroundColor: active ? theme.accentSoft : 'transparent',
  });

  const pillTextStyle = (active: boolean) => ({
    color: active ? theme.accent : theme.textMuted,
  });

  return (
    // scroll={false}: the inner ScrollView owns scrolling (no nested scroll views),
    // same as log/new — keeps focused fields reachable above a landscape keyboard.
    <Screen scroll={false} noPadding bottomInset>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl + spacing.lg, gap: spacing.xl }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={{ gap: spacing.xs }}>
            <Text variant="h2">{isEdit ? 'Edit goal' : 'New goal'}</Text>
            {isEdit ? (
              <Text variant="small" muted>{meta.label} · {meta.blurb}</Text>
            ) : null}
          </View>

          {/* Type picker — only on create */}
          {!isEdit ? (
            <View style={{ gap: spacing.sm }}>
              <Text variant="caption" muted style={{ textTransform: 'uppercase', letterSpacing: 1 }}>
                Type
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                {GOAL_TYPE_META.map((m) => (
                  <Pressable
                    key={m.type}
                    onPress={() => patch({ type: m.type, target: '', baseline: '', quitDate: '' })}
                    style={pillStyle(form.type === m.type)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: form.type === m.type }}
                    accessibilityLabel={m.label}
                    disabled={busy}
                  >
                    <Text variant="small" style={pillTextStyle(form.type === m.type)}>
                      {m.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <Text variant="small" muted>{meta.blurb}</Text>
            </View>
          ) : null}

          {/* Numeric target */}
          {(form.type === 'daily_cap' || form.type === 'weekly_target' || form.type === 'spend_cap_daily') ? (
            <Input
              label={`Target (${meta.targetUnit})`}
              keyboardType="decimal-pad"
              value={form.target}
              onChangeText={(v) => patch({ target: v })}
              editable={!busy}
              placeholder="e.g. 5"
            />
          ) : null}

          {/* Reduction target */}
          {form.type === 'reduction_target' ? (
            <>
              <Input
                label={`Target (${meta.targetUnit})`}
                keyboardType="decimal-pad"
                value={form.target}
                onChangeText={(v) => patch({ target: v })}
                editable={!busy}
                placeholder="e.g. 5"
              />
              <Input
                label="Baseline (sticks/day)"
                keyboardType="decimal-pad"
                value={form.baseline}
                onChangeText={(v) => patch({ baseline: v })}
                editable={!busy}
                placeholder={derivedBaseline > 0 ? String(derivedBaseline) : 'Enter manually'}
                hint={baselineHint}
              />
            </>
          ) : null}

          {/* No-smoke window */}
          {form.type === 'no_smoke_window' ? (
            <View style={{ flexDirection: 'row', gap: spacing.md }}>
              <View style={{ flex: 1 }}>
                <Input
                  label="Start hour (0–23)"
                  keyboardType="number-pad"
                  maxLength={2}
                  value={String(form.startHour)}
                  onChangeText={(v) => patch({ startHour: clampHour(v) })}
                  editable={!busy}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Input
                  label="End hour (0–23)"
                  keyboardType="number-pad"
                  maxLength={2}
                  value={String(form.endHour)}
                  onChangeText={(v) => patch({ endHour: clampHour(v) })}
                  editable={!busy}
                />
              </View>
            </View>
          ) : null}

          {/* Quit date */}
          {form.type === 'quit_date' ? (
            <>
              <Input
                label="Quit date (YYYY-MM-DD)"
                keyboardType="default"
                value={form.quitDate}
                onChangeText={(v) => patch({ quitDate: v })}
                editable={!busy}
                placeholder={today}
                hint="Must be a future date."
              />
              <Input
                label="Baseline (sticks/day, optional)"
                keyboardType="decimal-pad"
                value={form.baseline}
                onChangeText={(v) => patch({ baseline: v })}
                editable={!busy}
                placeholder={derivedBaseline > 0 ? String(derivedBaseline) : 'Enter manually'}
                hint={baselineHint}
              />
            </>
          ) : null}

          {/* Error */}
          {error ? (
            <Text variant="small" style={{ color: theme.danger }}>{error}</Text>
          ) : null}

          {/* Actions */}
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <View style={{ flex: 1 }}>
              <Button
                title={isEdit ? 'Save' : 'Create goal'}
                onPress={handleSubmit}
                loading={busy}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Button
                title="Cancel"
                variant="ghost"
                onPress={() => router.back()}
                disabled={busy}
              />
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

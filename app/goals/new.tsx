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
  creatableGoalTypes,
  emptyGoalForm,
  goalToFormState,
  proposalToForm,
  buildGoalPayload,
  buildGoalPatch,
  blockingSameTypeGoal,
  goalTypeLabel,
  deriveReductionBaseline,
  type GoalFormState,
} from '@/domain/goalForm';
import { describeProposal, proposeStart } from '@/domain/goalProposals';
import type { SpendPeriod } from '@/domain/goalMeta';
import {
  isFromProposal,
  offersStartProposal,
  parseTypeParam,
  periodUnitLabel,
  proposalButtonLabel,
} from '@/domain/goalFormView';
import { formatMoney } from '@/lib/format';
import { formatIndianDate } from '@/lib/date';
import { isDiscreetMode } from '@/lib/discreet';
import { localeForCountry } from '@/lib/regions';
import type { Goal } from '@/types';

const PILL_MIN_HEIGHT = 44;
const PERIOD_OPTIONS: readonly { value: SpendPeriod; label: string }[] = [
  { value: 'day', label: 'Per day' },
  { value: 'week', label: 'Per week' },
  { value: 'month', label: 'Per month' },
];
const NO_PROPOSAL_LINE = 'Not enough days logged to suggest one yet — enter a number.';

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
  const { goalId, type: typeParam, target: targetParam } = useLocalSearchParams<{
    goalId?: string;
    type?: string;
    target?: string;
  }>();

  const goals = useSession((s) => s.goals);
  const logs = useSession((s) => s.logs);
  const profile = useSession((s) => s.profile);
  const addGoal = useSession((s) => s.addGoal);
  const updateGoal = useSession((s) => s.updateGoal);

  const existingGoal: Goal | null = useMemo(
    () => (goalId ? (goals.find((g) => g.id === goalId) ?? null) : null),
    [goalId, goals],
  );

  const isEdit = existingGoal !== null;

  const [form, setForm] = useState<GoalFormState>(() => {
    if (!existingGoal) return emptyGoalForm(parseTypeParam(typeParam ?? null) ?? undefined);
    const base = goalToFormState(existingGoal);
    // "Edit" on a card proposal arrives with the proposed target.
    return Number(targetParam) > 0 ? { ...base, target: targetParam! } : base;
  });
  // The form as seeded by "Use" (null until then) and whether the reader took "Choose my own".
  const [seeded, setSeeded] = useState<GoalFormState | null>(null);
  const [choseOwn, setChoseOwn] = useState(false);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function patch(updates: Partial<GoalFormState>) {
    setForm((prev) => ({ ...prev, ...updates }));
    // A new type or period means a new proposal: offer it afresh.
    if (updates.type !== undefined || updates.period !== undefined) {
      setSeeded(null);
      setChoseOwn(false);
    }
    setError(null);
  }

  function takeProposal(updates: Partial<GoalFormState>) {
    const next = { ...form, ...updates };
    setForm(next);
    setSeeded(next);
    setError(null);
  }

  const meta = GOAL_TYPE_META.find((m) => m.type === form.type)!;
  const currency = profile?.currency ?? 'INR';
  const isSpend = form.type === 'spend_cap_daily';
  const targetUnit = isSpend ? periodUnitLabel(currency, form.period) : meta.targetUnit;
  const hideMoney = isSpend && isDiscreetMode(profile);
  const proposal = useMemo(
    () =>
      isEdit || !offersStartProposal(form.type)
        ? null
        : proposeStart(form.type, logs, today, { currency, period: form.period }),
    [isEdit, form.type, form.period, logs, today, currency],
  );
  const copy = proposal
    ? describeProposal(proposal, {
        formatMoney: (n) => formatMoney(n, currency, { locale: localeForCountry(profile?.country) }),
        formatDate: formatIndianDate,
        hideMoney,
      })
    : null;
  const offered = !isEdit && seeded === null && !choseOwn && proposal && copy ? { proposal, copy } : null;
  const showInputs = isEdit || !offered;
  const showNoProposal = !isEdit && offersStartProposal(form.type) && proposal === null;
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
        await addGoal(result.payload, { fromProposal: isFromProposal(form, seeded) });
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
    minHeight: PILL_MIN_HEIGHT,
    justifyContent: 'center' as const,
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
                {creatableGoalTypes().map((m) => (
                  <Pressable
                    key={m.type}
                    onPress={() => {
                      if (m.type === form.type) return;
                      patch({ type: m.type, target: '', baseline: '', quitDate: '', finalTarget: '', period: 'day' });
                    }}
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

          {/* Spend period: chosen on create, fixed afterwards */}
          {isSpend && !isEdit ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
              {PERIOD_OPTIONS.map((o) => (
                <Pressable
                  key={o.value}
                  onPress={() => {
                    if (o.value !== form.period) patch({ period: o.value, target: '' });
                  }}
                  style={pillStyle(form.period === o.value)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: form.period === o.value }}
                  accessibilityLabel={o.label}
                  disabled={busy}
                >
                  <Text variant="small" style={pillTextStyle(form.period === o.value)}>{o.label}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}
          {isSpend && isEdit ? (
            <Text variant="small" muted>
              {PERIOD_OPTIONS.find((o) => o.value === form.period)?.label}, fixed when the goal was created.
            </Text>
          ) : null}

          {/* Ledger-derived starting value, offered before the inputs */}
          {offered ? (
            <View style={{ gap: spacing.sm }}>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
                <Text variant="caption" muted style={{ textTransform: 'uppercase', letterSpacing: 1 }}>
                  Your last 14 days
                </Text>
                <Text variant="bodyStrong">{offered.copy.valueLabel}</Text>
              </View>
              <Text variant="bodyStrong">{offered.copy.headline}</Text>
              <Text variant="small" muted>{offered.copy.basis}</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                <Pressable
                  onPress={() => takeProposal(proposalToForm(offered.proposal))}
                  style={pillStyle(true)}
                  accessibilityRole="button"
                  accessibilityLabel={proposalButtonLabel(offered.copy.valueLabel, hideMoney)}
                  disabled={busy}
                >
                  <Text variant="small" style={pillTextStyle(true)}>
                    {proposalButtonLabel(offered.copy.valueLabel, hideMoney)}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => setChoseOwn(true)}
                  style={pillStyle(false)}
                  accessibilityRole="button"
                  accessibilityLabel="Choose my own"
                  disabled={busy}
                >
                  <Text variant="small" style={pillTextStyle(false)}>Choose my own</Text>
                </Pressable>
              </View>
            </View>
          ) : null}
          {showNoProposal ? <Text variant="small" muted>{NO_PROPOSAL_LINE}</Text> : null}

          {/* Numeric target */}
          {showInputs && (form.type === 'daily_cap' || form.type === 'weekly_target' || form.type === 'spend_cap_daily') ? (
            <Input
              label={`Target (${targetUnit})`}
              keyboardType="decimal-pad"
              value={form.target}
              onChangeText={(v) => patch({ target: v })}
              editable={!busy}
              placeholder="e.g. 5"
            />
          ) : null}

          {/* Taper: starting cap and where it ends */}
          {showInputs && form.type === 'taper' ? (
            <>
              <Input
                label="Starting cap (sticks/day)"
                keyboardType="decimal-pad"
                value={form.target}
                onChangeText={(v) => patch({ target: v })}
                editable={!busy}
                placeholder="e.g. 8"
              />
              <Input
                label="Final target (sticks/day)"
                keyboardType="decimal-pad"
                value={form.finalTarget}
                onChangeText={(v) => patch({ finalTarget: v })}
                editable={!busy}
                placeholder="e.g. 2"
              />
              <Text variant="small" muted>Steps down every 14 days, each one offered first.</Text>
            </>
          ) : null}

          {/* Reduction target */}
          {showInputs && form.type === 'reduction_target' ? (
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
          {showInputs && form.type === 'no_smoke_window' ? (
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
          {showInputs && form.type === 'quit_date' ? (
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
            <Text variant="small" accessibilityRole="alert" style={{ color: theme.warnEarth }}>{error}</Text>
          ) : null}

          {/* Actions */}
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <View style={{ flex: 1 }}>
              <Button
                title={isEdit ? 'Save' : 'Create goal'}
                onPress={handleSubmit}
                loading={busy}
                disabled={offered !== null}
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

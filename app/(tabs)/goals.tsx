import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  View,
} from 'react-native';
import { useIsFocused, useRouter } from 'expo-router';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { EmptyState } from '@/components/ui/EmptyState';
import { Divider } from '@/components/ui/Divider';
import { spacing, fonts, radius } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { useSession, ledgerToday } from '@/store/session';
import { useRefreshOnFocus } from '@/hooks/useRefreshOnFocus';
import { evaluateGoal } from '@/domain/goals';
import { acceptProposalPatch, dismissProposalPatch, goalTypeLabel } from '@/domain/goalForm';
import { stateCaption, type GoalState } from '@/domain/goalAdherence';
import { goalCardModel } from '@/domain/goalCardModel';
import { doneLabel, proposalRowLabel } from '@/domain/goalFormView';
import { RECONCILE_FAILED_NOTICE } from '@/domain/goalReconcileView';
import type { DismissKind } from '@/domain/goalMeta';
import type { Proposal } from '@/domain/goalProposals';
import { completionMoment } from '@/services/goalReconcile';
import { track } from '@/services/analytics';
import { AnalyticsEvents } from '@/constants/events';
import { dispatchGoalCompletion, dispatchGoalDeletion } from '@/lib/character/mood';
import { isDiscreetMode } from '@/lib/discreet';
import { formatMoney } from '@/lib/format';
import { formatIndianDate } from '@/lib/date';
import { localeForCountry } from '@/lib/regions';
import type { Goal } from '@/types';

const PILL_MIN_HEIGHT = 44;

/** Teal only for a goal that is on track or met; terracotta for any concern. */
function stateColor(state: GoalState, theme: { accent: string; warnEarth: string }): string {
  return state === 'on_track' || state === 'met' ? theme.accent : theme.warnEarth;
}

/** A 44pt-high outlined pill; `tone` picks the border and label colour. */
function Pill({
  label,
  onPress,
  disabled,
  accessibilityLabel,
  color,
  borderColor,
}: {
  label: string;
  onPress: () => void;
  disabled: boolean;
  accessibilityLabel: string;
  color?: string;
  borderColor: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={{
        minHeight: PILL_MIN_HEIGHT,
        justifyContent: 'center',
        paddingHorizontal: spacing.md,
        borderRadius: radius.pill,
        borderWidth: 1,
        borderColor,
      }}
    >
      <Text variant="small" style={color ? { color } : undefined}>{label}</Text>
    </Pressable>
  );
}

export default function GoalsTab() {
  const router = useRouter();
  const theme = useTheme();
  const today = ledgerToday();

  const goals = useSession((s) => s.goals);
  const logs = useSession((s) => s.logs);
  const profile = useSession((s) => s.profile);
  const refreshGoals = useSession((s) => s.refreshGoals);
  const setGoalStatus = useSession((s) => s.setGoalStatus);
  const removeGoal = useSession((s) => s.removeGoal);
  const updateGoal = useSession((s) => s.updateGoal);
  const consumeGoalMoments = useSession((s) => s.consumeGoalMoments);
  const reconcileFailed = useSession((s) => s.goalsReconcileFailed);

  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useRefreshOnFocus(refreshGoals);

  // Announce goals the ledger completed on its own. Reacts to the queue, so moments queued
  // by the focus refresh above (or a realtime refresh) are announced while the tab is open.
  const isFocused = useIsFocused();
  const queuedMoments = useSession((s) => s.pendingGoalMoments.length);
  useEffect(() => {
    if (!isFocused || queuedMoments === 0) return;
    for (const t of consumeGoalMoments()) {
      const moment = completionMoment(t);
      if (!moment || t.kind !== 'auto_complete') continue;
      dispatchGoalCompletion(moment);
      void track(AnalyticsEvents.GOAL_AUTO_COMPLETED, {
        type: t.reason === 'quit_date' ? 'quit_date' : 'taper',
        reason: t.reason,
      });
    }
  }, [isFocused, queuedMoments, consumeGoalMoments]);

  const discreet = isDiscreetMode(profile);

  const active = goals.filter((g) => g.status === 'active');
  const paused = goals.filter((g) => g.status === 'paused');
  const done = goals.filter((g) => g.status === 'completed' || g.status === 'abandoned');

  const cardModels = useMemo(() => {
    const locale = localeForCountry(profile?.country);
    const currency = profile?.currency ?? 'INR';
    return new Map(
      goals.map((g) => [
        g.id,
        goalCardModel(g, logs, today, {
          currency,
          formatMoney: (n) => formatMoney(n, currency, { locale }),
          formatDate: formatIndianDate,
          hideMoney: discreet && g.type === 'spend_cap_daily',
        }),
      ]),
    );
  }, [goals, logs, today, profile?.country, profile?.currency, discreet]);

  const runAction = useCallback(async (goal: Goal, action: () => Promise<void>) => {
    setNotice(null);
    setBusy(goal.id);
    try {
      await action();
    } catch (e: unknown) {
      setNotice(e instanceof Error ? e.message : 'Something went wrong. Please try again.');
    } finally {
      setBusy(null);
    }
  }, []);

  const handleAccept = useCallback(
    (goal: Goal, p: Proposal) =>
      runAction(goal, async () => {
        await updateGoal(goal.id, acceptProposalPatch(goal, p, today));
        void track(AnalyticsEvents.GOAL_PROPOSAL_ACCEPTED, { type: goal.type, kind: p.kind });
      }),
    [runAction, updateGoal, today],
  );

  const handleDismiss = useCallback(
    (goal: Goal, kind: DismissKind) =>
      runAction(goal, async () => {
        await updateGoal(goal.id, dismissProposalPatch(goal, kind, today));
        void track(AnalyticsEvents.GOAL_PROPOSAL_DISMISSED, { type: goal.type, kind });
      }),
    [runAction, updateGoal, today],
  );

  const handleStatusChange = useCallback(async (goal: Goal, status: Goal['status']) => {
    await runAction(goal, async () => {
      await setGoalStatus(goal.id, status);
      if (status === 'completed') {
        dispatchGoalCompletion({
          title: 'Well kept.',
          body: `You stayed true to your ${goalTypeLabel(goal.type).toLowerCase()}. That counts.`,
        });
      }
    });
  }, [setGoalStatus, runAction]);

  const handleDelete = useCallback((goal: Goal) => {
    Alert.alert(
      'Delete goal?',
      'This cannot be undone. Your logged progress is not affected.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setBusy(goal.id);
            try {
              await removeGoal(goal.id);
              // Sentiment only when an unaccomplished goal is let go.
              if (goal.status === 'active' || goal.status === 'paused') {
                dispatchGoalDeletion({
                  title: 'No judgment.',
                  body: 'Every attempt teaches you something.',
                });
              }
            } finally {
              setBusy(null);
            }
          },
        },
      ],
    );
  }, [removeGoal]);

  function GoalRow({ goal }: { goal: Goal }) {
    const progress = evaluateGoal(goal, logs, today, {
      currency: profile?.currency ?? 'INR',
      locale: localeForCountry(profile?.country),
    });
    const model = cardModels.get(goal.id)!;
    const { state, proposal, copy } = model;
    const hideMoney = goal.type === 'spend_cap_daily' && discreet;
    const heading = hideMoney ? goalTypeLabel(goal.type) : progress.label;
    const explanation = hideMoney ? 'Spend hidden in discreet mode.' : progress.explanation;
    const pct = Math.round(Math.max(0, Math.min(100, progress.percent)));
    const isBusy = busy === goal.id;
    const isDone = goal.status === 'completed' || goal.status === 'abandoned';
    // Teal only when on track or met; terracotta for any concern. Never alarm-red.
    const stateTone = stateColor(state, theme);
    const dismissKind: DismissKind | null =
      proposal && copy && proposal.kind !== 'start' ? proposal.kind : null;

    return (
      <View
        style={{
          backgroundColor: theme.bgElevated,
          borderRadius: radius.xl,
          padding: spacing.lg,
          gap: spacing.sm,
          opacity: isBusy ? 0.6 : 1,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
          <Text variant="bodyStrong" style={{ flex: 1, marginRight: spacing.sm }}>{heading}</Text>
          {!isDone ? (
            <Text variant="small" style={{ fontFamily: fonts.bodySemibold, color: stateTone }}>
              {pct}%
            </Text>
          ) : null}
        </View>

        {goal.status === 'active' ? (
          <Text variant="small" style={{ color: stateTone }}>
            {stateCaption(state, model.overDays, model.heldDays)}
          </Text>
        ) : null}

        {!isDone ? (
          <>
            <ProgressBar value={pct} tone={state === 'on_track' || state === 'met' ? 'success' : 'warnEarth'} />
            <Text variant="small" muted>{explanation}</Text>
          </>
        ) : (
          <Text variant="small" muted>{doneLabel(goal.status, goal.completedAt, formatIndianDate)}</Text>
        )}

        {proposal && copy && dismissKind ? (
          <View style={{ gap: spacing.xs, marginTop: spacing.xs }}>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
              <Text variant="caption" muted style={{ textTransform: 'uppercase', letterSpacing: 1 }}>
                {proposalRowLabel(proposal.kind)}
              </Text>
              <Text variant="bodyStrong">{copy.valueLabel}</Text>
            </View>
            <Text variant="bodyStrong">{copy.headline}</Text>
            <Text variant="small" muted>{copy.basis}</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.xs }}>
              <Pill
                label="Accept"
                accessibilityLabel="Accept suggestion"
                onPress={() => handleAccept(goal, proposal)}
                disabled={isBusy}
                borderColor={theme.accent}
                color={theme.accent}
              />
              <Pill
                label="Edit"
                accessibilityLabel="Edit suggestion"
                onPress={() =>
                  router.push({ pathname: '/goals/new', params: { goalId: goal.id, target: String(proposal.value) } })
                }
                disabled={isBusy}
                borderColor={theme.border}
              />
              <Pill
                label="Not now"
                accessibilityLabel="Not now"
                onPress={() => handleDismiss(goal, dismissKind)}
                disabled={isBusy}
                borderColor={theme.border}
              />
            </View>
          </View>
        ) : null}

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.xs }}>
          {!isDone && !dismissKind ? (
            <Pill
              label="Edit"
              accessibilityLabel="Edit goal"
              onPress={() => router.push({ pathname: '/goals/new', params: { goalId: goal.id } })}
              disabled={isBusy}
              borderColor={theme.border}
            />
          ) : null}

          {goal.status === 'active' ? (
            <Pill
              label="Pause"
              accessibilityLabel="Pause goal"
              onPress={() => handleStatusChange(goal, 'paused')}
              disabled={isBusy}
              borderColor={theme.border}
            />
          ) : goal.status === 'paused' ? (
            <Pill
              label="Resume"
              accessibilityLabel="Resume goal"
              onPress={() => handleStatusChange(goal, 'active')}
              disabled={isBusy}
              borderColor={theme.border}
            />
          ) : null}

          {!isDone ? (
            <Pill
              label="Complete"
              accessibilityLabel="Mark goal complete"
              onPress={() => handleStatusChange(goal, 'completed')}
              disabled={isBusy}
              borderColor={theme.border}
            />
          ) : null}

          <Pill
            label="Delete"
            accessibilityLabel="Delete goal"
            onPress={() => handleDelete(goal)}
            disabled={isBusy}
            borderColor={theme.danger}
            color={theme.danger}
          />
        </View>
      </View>
    );
  }

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl + spacing.lg, gap: spacing.xl }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text variant="h2">Goals</Text>
          <Button
            title="New"
            size="sm"
            variant="secondary"
            onPress={() => router.push('/goals/new')}
          />
        </View>

        {reconcileFailed || notice ? (
          <Text variant="small" accessibilityRole="alert" style={{ color: theme.warnEarth }}>
            {[notice, reconcileFailed ? RECONCILE_FAILED_NOTICE : null].filter(Boolean).join(' ')}
          </Text>
        ) : null}

        {/* Empty state */}
        {goals.length === 0 ? (
          <EmptyState
            title="No goals yet"
            description="Set a daily cap, a spend limit, or a quit date to start tracking progress."
            actionLabel="Set your first goal"
            onAction={() => router.push('/goals/new')}
          />
        ) : null}

        {/* Active */}
        {active.length > 0 ? (
          <View style={{ gap: spacing.sm }}>
            <Text variant="caption" style={{ textTransform: 'uppercase', color: theme.textMuted, letterSpacing: 1 }}>
              Active
            </Text>
            {active.map((g) => <GoalRow key={g.id} goal={g} />)}
          </View>
        ) : null}

        {/* Paused */}
        {paused.length > 0 ? (
          <View style={{ gap: spacing.sm }}>
            <Divider />
            <Text variant="caption" style={{ textTransform: 'uppercase', color: theme.textMuted, letterSpacing: 1 }}>
              Paused
            </Text>
            {paused.map((g) => <GoalRow key={g.id} goal={g} />)}
          </View>
        ) : null}

        {/* Completed / abandoned */}
        {done.length > 0 ? (
          <View style={{ gap: spacing.sm }}>
            <Divider />
            <Text variant="caption" style={{ textTransform: 'uppercase', color: theme.textMuted, letterSpacing: 1 }}>
              Completed & abandoned
            </Text>
            {done.map((g) => <GoalRow key={g.id} goal={g} />)}
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

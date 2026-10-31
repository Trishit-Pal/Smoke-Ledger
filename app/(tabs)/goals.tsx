import React, { useCallback, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
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
import { goalTypeLabel } from '@/domain/goalForm';
import { dispatchGoalCompletion, dispatchGoalDeletion } from '@/lib/character/mood';
import { isDiscreetMode } from '@/lib/discreet';
import { localeForCountry } from '@/lib/regions';
import type { Goal } from '@/types';

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

  const [busy, setBusy] = useState<string | null>(null);

  useRefreshOnFocus(refreshGoals);

  const discreet = isDiscreetMode(profile);

  const active = goals.filter((g) => g.status === 'active');
  const paused = goals.filter((g) => g.status === 'paused');
  const done = goals.filter((g) => g.status === 'completed' || g.status === 'abandoned');

  const handleStatusChange = useCallback(async (goal: Goal, status: Goal['status']) => {
    setBusy(goal.id);
    try {
      await setGoalStatus(goal.id, status);
      if (status === 'completed') {
        dispatchGoalCompletion({
          title: 'Well kept.',
          body: `You stayed true to your ${goalTypeLabel(goal.type).toLowerCase()}. That counts.`,
        });
      }
    } finally {
      setBusy(null);
    }
  }, [setGoalStatus]);

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
    const hideMoney = goal.type === 'spend_cap_daily' && discreet;
    const heading = hideMoney ? goalTypeLabel(goal.type) : progress.label;
    const explanation = hideMoney ? 'Spend hidden in discreet mode.' : progress.explanation;
    const pct = Math.round(Math.max(0, Math.min(100, progress.percent)));
    const tone = progress.atRisk ? 'warn' : progress.isOnTrack ? 'success' : 'default';
    const isBusy = busy === goal.id;

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
          <Text
            variant="small"
            style={{
              fontFamily: fonts.bodySemibold,
              color: progress.atRisk ? theme.warn : progress.isOnTrack ? theme.accent : theme.textMuted,
            }}
          >
            {pct}%
          </Text>
        </View>

        <ProgressBar value={pct} tone={tone} />

        <Text variant="small" muted>{explanation}</Text>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.xs }}>
          <Pressable
            onPress={() => router.push({ pathname: '/goals/new', params: { goalId: goal.id } })}
            disabled={isBusy}
            style={{
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.xs,
              borderRadius: radius.pill,
              borderWidth: 1,
              borderColor: theme.border,
            }}
            accessibilityLabel="Edit goal"
          >
            <Text variant="small">Edit</Text>
          </Pressable>

          {goal.status === 'active' ? (
            <Pressable
              onPress={() => handleStatusChange(goal, 'paused')}
              disabled={isBusy}
              style={{
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.xs,
                borderRadius: radius.pill,
                borderWidth: 1,
                borderColor: theme.border,
              }}
              accessibilityLabel="Pause goal"
            >
              <Text variant="small">Pause</Text>
            </Pressable>
          ) : goal.status === 'paused' ? (
            <Pressable
              onPress={() => handleStatusChange(goal, 'active')}
              disabled={isBusy}
              style={{
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.xs,
                borderRadius: radius.pill,
                borderWidth: 1,
                borderColor: theme.border,
              }}
              accessibilityLabel="Resume goal"
            >
              <Text variant="small">Resume</Text>
            </Pressable>
          ) : null}

          {goal.status !== 'completed' ? (
            <Pressable
              onPress={() => handleStatusChange(goal, 'completed')}
              disabled={isBusy}
              style={{
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.xs,
                borderRadius: radius.pill,
                borderWidth: 1,
                borderColor: theme.border,
              }}
              accessibilityLabel="Mark goal complete"
            >
              <Text variant="small">Complete</Text>
            </Pressable>
          ) : null}

          <Pressable
            onPress={() => handleDelete(goal)}
            disabled={isBusy}
            style={{
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.xs,
              borderRadius: radius.pill,
              borderWidth: 1,
              borderColor: theme.danger,
            }}
            accessibilityLabel="Delete goal"
          >
            <Text variant="small" style={{ color: theme.danger }}>Delete</Text>
          </Pressable>
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

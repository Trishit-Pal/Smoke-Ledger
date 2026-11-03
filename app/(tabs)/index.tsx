import React, { useMemo, useRef, useEffect, useState } from 'react';
import { View, Pressable, TextStyle } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen } from '@/components/ui/Screen';
import { Card } from '@/components/ui/Card';
import { Text } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Divider } from '@/components/ui/Divider';
import { HealthMilestones } from '@/components/ui/HealthMilestones';
import { FactsCarousel } from '@/components/ui/FactsCarousel';
import { PaperNoise } from '@/components/ui/PaperNoise';
import { FadeSlideIn } from '@/components/anim/FadeSlideIn';
import { AnimatedNumber } from '@/components/anim/AnimatedNumber';
import { spacing, typography, fonts, radius } from '@/constants/theme';
import { useSession, ledgerTimeZone, ledgerToday, ledgerDaysAgo } from '@/store/session';
import { useTheme } from '@/hooks/useTheme';
import { useRefreshOnFocus } from '@/hooks/useRefreshOnFocus';
import {
  dailyStats,
  forecastMonthlySpend,
  lastLog,
  rollingAvgSticks,
  spendOn,
  sticksOn,
  trendVsBaseline,
} from '@/domain/calc';
import {
  savedAllTime,
  streakFromRows,
  weightedAvgUnitPrice,
} from '@/domain/periodSummary';
import { isBirthdayToday } from '@/domain/age';
import { evaluateGoal } from '@/domain/goals';
import { goalTypeLabel } from '@/domain/goalForm';
import { goalCardModel } from '@/domain/goalCardModel';
import { homeGoalLine } from '@/domain/goalAdherence';
import { loggedDays, proposeStart } from '@/domain/goalProposals';
import { PROPOSAL_DATA_WINDOW_DAYS } from '@/domain/goalMeta';
import { firstSuggestionSentence, shouldShowFirstSuggestion } from '@/domain/firstSuggestion';
import { sessionUserId } from '@/lib/goals/sessionUserId';
import { dismissFirstSuggestion, isFirstSuggestionDismissed } from '@/lib/goals/firstSuggestionStore';
import { getSupabase } from '@/lib/supabase';
import { generateInsights } from '@/domain/insights';
import { formatDelta, formatMoney } from '@/lib/format';
import { localeForCountry } from '@/lib/regions';
import { ledgerMoney } from '@/lib/ledgerMoney';
import { isHomeTotalsHidden, isDiscreetMode, lastEntryLabel, maskBrandName, maskCount, maskInr } from '@/lib/discreet';
import { dayOfWeekShort, formatIndianDate } from '@/lib/date';
import { createLog } from '@/db/repositories/logs';
import { track } from '@/services/analytics';
import { AnalyticsEvents } from '@/constants/events';
import { success, warn } from '@/lib/haptics';
import { CharacterCompanion } from '@/components/character/CharacterCompanion';
import { dispatchMilestone, dispatchMood, milestoneForStreak } from '@/lib/character/mood';
import type { Brand, BrandVariant, CigaretteLog, UserProfile } from '@/types';

// ─── helpers ────────────────────────────────────────────────────────────────

function headlineDeck(opts: {
  todaySticks: number;
  baseline: number | null | undefined;
  streak: number;
  hidden: boolean;
}): string {
  if (opts.hidden) return 'Today — totals hidden.';
  const { todaySticks, baseline, streak } = opts;
  if (todaySticks === 0) {
    if (streak >= 7) return `Smoke-free for ${streak} days. Quiet day.`;
    if (streak >= 1) return `${streak === 1 ? 'A day' : `${streak} days`} smoke-free so far.`;
    return 'Nothing logged yet today.';
  }
  if (todaySticks === 1) return 'One cigarette today.';
  if (baseline && baseline > 0) {
    if (todaySticks < baseline) return `${todaySticks} today — below your usual.`;
    if (todaySticks === baseline) return `${todaySticks} today — at your usual.`;
    return `${todaySticks} today — above your usual.`;
  }
  return `${todaySticks} today.`;
}

function trendTone(deltaPct: number): 'up' | 'down' | 'flat' {
  if (!Number.isFinite(deltaPct)) return 'flat';
  if (deltaPct > 2) return 'up';
  if (deltaPct < -2) return 'down';
  return 'flat';
}

// ─── WeekInkPanel — inverted bar chart section ──────────────────────────────

interface WeekBar { label: string; value: number; }

interface WeekInkPanelProps {
  data: WeekBar[];
  hidden: boolean;
}

function WeekInkPanel({ data, hidden }: WeekInkPanelProps) {
  const theme = useTheme();
  const max = Math.max(1, ...data.map((d) => d.value));
  const last = data.length - 1;

  return (
    <View
      style={{
        backgroundColor: theme.inkSurface,
        borderRadius: radius.xl,
        padding: spacing.xl,
        gap: spacing.lg,
      }}
    >
      {/* Section header */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <Text
          variant="caption"
          style={{
            textTransform: 'uppercase',
            letterSpacing: 1.6,
            color: theme.inkSurfaceMuted,
          }}
        >
          The week
        </Text>
        <Text
          variant="caption"
          style={{ color: theme.inkSurfaceMuted }}
        >
          Mon — Sun
        </Text>
      </View>

      {/* Bar columns */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'flex-end',
          height: 96,
          gap: spacing.sm,
        }}
        accessible
        accessibilityLabel={
          hidden
            ? 'Last seven days — counts hidden'
            : `Last seven days: ${data.map((d) => `${d.label} ${d.value}`).join(', ')}`
        }
      >
        {data.map((d, i) => {
          const isToday = i === last;
          const pct = hidden ? 0.3 : Math.max(0.06, d.value / max);
          return (
            <View key={i} style={{ flex: 1, height: '100%', alignItems: 'center', justifyContent: 'flex-end' }}>
              {/* Track */}
              <View
                aria-hidden
                style={{
                  position: 'absolute',
                  bottom: 0,
                  width: 8,
                  height: '100%',
                  backgroundColor: theme.inkSurfaceRule,
                  borderRadius: radius.pill,
                  opacity: 0.35,
                }}
              />
              {/* Fill */}
              <View
                aria-hidden
                style={{
                  width: 8,
                  height: `${pct * 100}%`,
                  backgroundColor: isToday ? theme.accent : theme.inkSurfaceMuted,
                  borderRadius: radius.pill,
                }}
              />
            </View>
          );
        })}
      </View>

      {/* Day labels + values */}
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        {data.map((d, i) => {
          const isToday = i === last;
          return (
            <View key={`lbl-${i}`} style={{ flex: 1, alignItems: 'center', gap: 2 }}>
              <Text
                variant="caption"
                style={{
                  textTransform: 'uppercase',
                  color: theme.inkSurfaceMuted,
                  opacity: isToday ? 1 : 0.7,
                  fontVariant: ['tabular-nums'],
                }}
              >
                {d.label}
              </Text>
              <Text
                variant="caption"
                style={{
                  color: isToday ? theme.accent : theme.inkSurfaceMuted,
                  fontVariant: ['tabular-nums'],
                }}
              >
                {hidden ? '••' : d.value}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

// ─── QuickLogRow — inline quick-log strip adapted from web QuickLogStrip ────

interface QuickLogRowProps {
  profile: UserProfile | null;
  brands: (Brand & { variants: BrandVariant[] })[];
  lastEntry: CigaretteLog | null;
  pending: boolean;
  error: string | null;
  toast: string | null;
  onLogLast: (qty: number) => void;
  onLogBrand: (brand: Brand & { variants: BrandVariant[] }) => void;
  onAdvanced: () => void;
}

function QuickLogRow({
  profile,
  brands,
  lastEntry,
  pending,
  error,
  toast,
  onLogLast,
  onLogBrand,
  onAdvanced,
}: QuickLogRowProps) {
  const theme = useTheme();
  const discreet = profile?.discreetMode ?? false;

  const favorites = useMemo(
    () =>
      [...brands]
        .filter((b) => b.isFavorite)
        .sort((a, b) => a.name.localeCompare(b.name))
        .slice(0, 4),
    [brands],
  );

  const noBrands = brands.length === 0;
  const canRepeatLast = Boolean(lastEntry?.brandId);

  const lastBrandLabel = lastEntry
    ? lastEntryLabel(lastEntry.brandNameSnap, lastEntry.variantSnap, discreet)
    : null;

  const lastPrice =
    lastEntry?.unitPriceInr != null
      ? maskInr(lastEntry.unitPriceInr, discreet, (n) => ledgerMoney(n, { compact: true }))
      : null;

  return (
    <View style={{ gap: spacing.sm }}>
      {/* Deck line — last entry */}
      <Text variant="small">
        {lastBrandLabel ? (
          <>
            <Text variant="small" faint>Last: </Text>
            <Text variant="small">{lastBrandLabel}</Text>
            {lastPrice ? <Text variant="small" faint> · {lastPrice}</Text> : null}
          </>
        ) : (
          <Text variant="small" style={{ fontStyle: 'italic' }} muted>
            No cigarettes logged yet.
          </Text>
        )}
      </Text>

      {noBrands ? (
        <Button
          title="Add a brand to start logging →"
          variant="primary"
          onPress={onAdvanced}
        />
      ) : (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm }}>
          {/* Primary action: log last brand */}
          <Button
            title={pending ? 'Logging…' : 'Log one'}
            variant="primary"
            size="md"
            disabled={pending || !canRepeatLast}
            loading={pending}
            onPress={() => onLogLast(1)}
            accessibilityLabel={canRepeatLast ? 'Log one cigarette (repeat last)' : 'Log a full entry first to enable quick log'}
          />
          {/* +2 */}
          <Button
            title="+2"
            variant="secondary"
            size="md"
            disabled={pending || !canRepeatLast}
            onPress={() => onLogLast(2)}
          />

          {/* Favorite brand chips */}
          {favorites.length > 0 ? (
            <>
              <Text variant="caption" faint>·</Text>
              {favorites.map((brand) => {
                const isLast = lastEntry?.brandId === brand.id;
                return (
                  <Pressable
                    key={brand.id}
                    onPress={() => onLogBrand(brand)}
                    disabled={pending}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isLast }}
                    accessibilityLabel={`Log one ${maskBrandName(brand.name, discreet)}`}
                    style={({ pressed }) => ({ opacity: pressed || pending ? 0.55 : 1 })}
                  >
                    <Text
                      variant="small"
                      color={isLast ? theme.accent : theme.textMuted}
                      style={{ textDecorationLine: 'underline', textDecorationColor: theme.ruleStrong }}
                    >
                      {maskBrandName(brand.name, discreet)}
                    </Text>
                  </Pressable>
                );
              })}
            </>
          ) : null}
        </View>
      )}

      {/* Nudge when no last brand and no favorites */}
      {!noBrands && !canRepeatLast && favorites.length === 0 ? (
        <Text variant="caption" faint style={{ fontStyle: 'italic' }}>
          Pick a brand on the full entry to log your first stick.
        </Text>
      ) : null}

      {/* Toast / error feedback */}
      {toast ? (
        <Text variant="small" color={theme.accent}>{toast}</Text>
      ) : null}
      {error ? (
        <Text variant="small" color={theme.warnEarth}>{error}</Text>
      ) : null}

      {/* Add-details link */}
      <Pressable
        onPress={onAdvanced}
        accessibilityRole="link"
        style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, alignSelf: 'flex-start' })}
      >
        <Text
          variant="small"
          muted
          style={{ textDecorationLine: 'underline', textDecorationColor: theme.ruleStrong }}
        >
          Add details →
        </Text>
      </Pressable>
    </View>
  );
}

// ─── Home ────────────────────────────────────────────────────────────────────

export default function Home() {
  const router = useRouter();
  const theme = useTheme();
  const logs = useSession((s) => s.logs);
  const profile = useSession((s) => s.profile);
  const goals = useSession((s) => s.goals);
  const brands = useSession((s) => s.brands);
  const summary = useSession((s) => s.summary);
  const summarySinceYmd = useSession((s) => s.summarySinceYmd);
  const refreshLogs = useSession((s) => s.refreshLogs);
  // Fallback for when realtime is unavailable: re-pull the high-churn logs on
  // focus. Goals/profile arrive via realtime and brands change rarely, so we
  // deliberately don't refetch them on every tab switch (free-tier egress).
  useRefreshOnFocus(refreshLogs);

  const [refreshing, setRefreshing] = useState(false);
  const [quickLogPending, setQuickLogPending] = useState(false);
  const [quickLogError, setQuickLogError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current !== null) {
        clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  const today = ledgerToday();
  const last7Start = ledgerDaysAgo(6);

  // ── computed ──
  const todaySticks = useMemo(() => sticksOn(logs, today), [logs, today]);
  const todaySpend = useMemo(() => spendOn(logs, today), [logs, today]);
  const avgPerDay = useMemo(() => rollingAvgSticks(logs, today, 7), [logs, today]);
  const trend = useMemo(() => trendVsBaseline(logs, today, 7, 30), [logs, today]);
  const weekBars = useMemo(() => {
    const stats = dailyStats(logs, last7Start, today);
    return stats.map((s) => ({
      label: dayOfWeekShort(s.date).slice(0, 1).toUpperCase(),
      value: s.sticks,
    }));
  }, [logs, last7Start, today]);

  const forecast = useMemo(() => forecastMonthlySpend(logs, today), [logs, today]);
  const currency = profile?.currency ?? 'INR';
  const locale = localeForCountry(profile?.country);
  const insights = useMemo(
    () => generateInsights(logs, today, (amount) => formatMoney(amount, currency, { locale })),
    [logs, today, currency, locale],
  );
  const last = useMemo(() => lastLog(logs), [logs]);
  // Streak + savings derive from the canonical daily summary (quantity-correct,
  // up to 365 days), so the streak no longer truncates at the 90-day log window
  // and savings is bounded at onboarding (no pre-onboarding inflation).
  const streak = useMemo(() => streakFromRows(summary, today), [summary, today]);

  const savings = useMemo(() => {
    const baseline = profile?.baselinePerDay ?? 0;
    if (!baseline) return null;
    const unit = weightedAvgUnitPrice(summary) ?? 0;
    const r = savedAllTime(summary, baseline, unit, summarySinceYmd, today);
    // Caption factors: rounded sticks × the EFFECTIVE rate (total ÷ sticks), so
    // the arithmetic the caption invites reproduces the displayed total exactly
    // — savedOverRange prices each day at that day's rate, so quoting the
    // fallback unit price would not multiply out.
    const sticks = Math.round(r.sticksAvoided);
    const ratePerStick = sticks > 0 ? r.totalInr / sticks : null;
    return { totalInr: r.totalInr, sticksAvoided: sticks, ratePerStick };
  }, [summary, profile, summarySinceYmd, today]);

  const activeGoal = goals.find((g) => g.status === 'active') ?? null;
  const goalProgress = useMemo(
    () => (activeGoal ? evaluateGoal(activeGoal, logs, today, { currency, locale }) : null),
    [activeGoal, logs, today, currency, locale],
  );
  // Spend caps embed ₹ in evaluateGoal().label/explanation — hide under discreet mode.
  const goalHideMoney = activeGoal?.type === 'spend_cap_daily' && isDiscreetMode(profile);
  const goalHeading = goalProgress
    ? (goalHideMoney ? goalTypeLabel(activeGoal!.type) : goalProgress.label)
    : null;
  const goalExplanation = goalProgress
    ? (goalHideMoney ? 'Spend hidden in discreet mode.' : goalProgress.explanation)
    : null;

  const hidden = isHomeTotalsHidden(profile);
  const goalCard = useMemo(
    () =>
      activeGoal
        ? goalCardModel(activeGoal, logs, today, {
            currency,
            formatMoney: (n) => formatMoney(n, currency, { locale }),
            formatDate: formatIndianDate,
            hideMoney: goalHideMoney,
          })
        : null,
    [activeGoal, logs, today, currency, locale, goalHideMoney],
  );
  // Teal only for on track / met; terracotta for any concern (never red).
  const goalPositive = goalCard?.state === 'on_track' || goalCard?.state === 'met';
  // Every figure in the line is a count of days; hidden Home totals show no line at all.
  const goalLine =
    goalCard && !hidden
      ? homeGoalLine(goalCard.state, goalCard.overDays, goalCard.heldDays, goalCard.proposal !== null)
      : null;

  // First-goal suggestion: only with no active goal and enough history. "Not now" is per user, on
  // this device; the id comes from the local session. On any failure it stays hidden.
  const [suggestionUser, setSuggestionUser] = useState<{ id: string; dismissed: boolean } | null>(null);
  useEffect(() => {
    let cancelled = false;
    void sessionUserId(() => getSupabase().auth.getSession())
      .then(async (id) => {
        if (cancelled || !id) return;
        const dismissed = await isFirstSuggestionDismissed(id, today);
        if (!cancelled) setSuggestionUser({ id, dismissed });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [today]);
  const firstProposal = useMemo(
    () => (activeGoal ? null : proposeStart('daily_cap', logs, today, { currency })),
    [activeGoal, logs, today, currency],
  );
  const showFirstSuggestion = shouldShowFirstSuggestion({
    hasActiveGoal: activeGoal !== null,
    proposal: firstProposal,
    dismissed: suggestionUser?.dismissed ?? false,
    userKnown: suggestionUser !== null,
  });

  // ── Character: greet once on mount, fire milestone modal on streak ↑ to a tier ──
  useEffect(() => {
    // Soft greet after the dashboard's first paint settles.
    const t = setTimeout(() => dispatchMood('greet', { caption: 'Quiet day.' }), 600);
    return () => clearTimeout(t);
  }, []);

  // Birthday celebration — fired once per session.
  const birthdayFiredRef = useRef(false);
  useEffect(() => {
    if (birthdayFiredRef.current || !profile?.dateOfBirth) return;
    if (isBirthdayToday(profile.dateOfBirth)) {
      dispatchMilestone({
        type: 'birthday',
        days: 0,
        title: 'Happy Birthday!',
        body: 'A special day for a special journey. Here is to another year of breathing easier.',
      });
      birthdayFiredRef.current = true;
    }
  }, [profile]);

  // Track the previous streak value so we only fire a milestone when the streak
  // crosses UP to a tier (1/3/7/14/30) — not on first load or when it resets.
  const prevStreakRef = useRef<number | null>(null);
  useEffect(() => {
    const prev = prevStreakRef.current;
    if (prev === null) {
      prevStreakRef.current = streak;
      return;
    }
    if (streak > prev) {
      const milestone = milestoneForStreak(streak);
      if (milestone) dispatchMilestone(milestone);
    } else if (streak === 0 && prev >= 3) {
      // Streak broke after a meaningful run — a gentle, non-judgmental nudge
      // (no modal; that would frame a setback as a celebration). Soft warning
      // haptic + a forward-looking caption that never guilt-trips.
      warn();
      dispatchMood('concern', {
        caption: 'Streak reset — tomorrow is a fresh page.',
        durationMs: 3800,
      });
    }
    prevStreakRef.current = streak;
  }, [streak]);

  // ── trend colour ──
  const tTone = trendTone(trend.deltaPct);
  const trendColor =
    tTone === 'up' ? theme.warnEarth : tTone === 'down' ? theme.accent : theme.textMuted;
  const streakColor = streak >= 1 ? theme.accent : theme.text;

  // ── deck text ──
  const deck = headlineDeck({
    todaySticks,
    baseline: profile?.baselinePerDay,
    streak,
    hidden,
  });

  // ── quick log ──
  const runQuickLog = async (opts: {
    brandId: string | null;
    brandName: string | null;
    variantName: string | null;
    quantity: number;
  }) => {
    try {
      setQuickLogError(null);
      setQuickLogPending(true);
      const lastL = logs[0];
      const unit = lastL?.unitPriceInr ?? null;
      const total = unit != null ? unit * opts.quantity : null;
      await createLog({
        timeZone: ledgerTimeZone(),
        tsUtc: new Date().toISOString(),
        brandId: opts.brandId,
        brandNameSnap: opts.brandName,
        variantSnap: opts.variantName,
        quantity: opts.quantity,
        purchaseMode: 'single',
        packSize: lastL?.packSize ?? null,
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
      success();
      // Character reaction — terracotta concern if the post-log day total is
      // above the user's baseline, ink regret otherwise. Caption stays neutral
      // and judgment-free per the editorial voice.
      const postLogTotal = todaySticks + opts.quantity;
      const baselinePerDay = profile?.baselinePerDay ?? null;
      const isAbove = baselinePerDay != null && postLogTotal > baselinePerDay;
      dispatchMood(isAbove ? 'concern' : 'regret', {
        caption: isAbove ? 'Above your usual today.' : 'Noted. No judgment.',
      });
      const label = `Logged ${opts.quantity} · ${opts.brandName ?? 'entry'}${total != null ? ` · ${ledgerMoney(total, { compact: true })}` : ''}`;
      setToast(label);
      if (toastTimerRef.current !== null) {
        clearTimeout(toastTimerRef.current);
      }
      toastTimerRef.current = setTimeout(() => setToast(null), 2500);
      await refreshLogs();
    } catch (e) {
      setQuickLogError(e instanceof Error ? e.message : 'Could not save log. Pull to refresh and retry.');
    } finally {
      setQuickLogPending(false);
    }
  };

  const handleLogLast = (qty: number) => {
    const lastL = logs[0];
    if (!lastL?.brandId) return;
    void runQuickLog({
      brandId: lastL.brandId,
      brandName: lastL.brandNameSnap ?? null,
      variantName: lastL.variantSnap ?? null,
      quantity: qty,
    });
  };

  const handleLogBrand = (brand: Brand & { variants: BrandVariant[] }) => {
    const variant = brand.variants[0];
    void runQuickLog({
      brandId: brand.id,
      brandName: brand.name,
      variantName: variant?.name ?? null,
      quantity: 1,
    });
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshLogs();
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <Screen refreshing={refreshing} onRefresh={onRefresh}>

      {/* ── Masthead ── */}
      <FadeSlideIn index={0}>
        <View style={{ position: 'relative', gap: spacing.xs, overflow: 'hidden' }}>
          <PaperNoise />
          {/* Rule + date centred */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <View style={{ flex: 1, height: 1, backgroundColor: theme.ruleStrong }} />
            <Text
              variant="caption"
              style={{ textTransform: 'uppercase', letterSpacing: 1.4, color: theme.textMuted }}
            >
              {formatIndianDate(today)}
            </Text>
            <View style={{ flex: 1, height: 1, backgroundColor: theme.ruleStrong }} />
          </View>
          {/* Resident character companion — reacts to greet/regret/concern/applaud */}
          <View style={{ alignItems: 'center', marginTop: spacing.xs }}>
            <CharacterCompanion size={72} />
          </View>
          <Text
            variant="small"
            muted
            style={{ textAlign: 'center', fontStyle: 'italic', fontFamily: fonts.displaySoft }}
          >
            Your daily ledger
          </Text>
        </View>
      </FadeSlideIn>

      {/* ── Hero numeral — today sticks + spend ── */}
      <FadeSlideIn index={1}>
        <View style={{ gap: spacing.lg }}>
          {/* Big numeral row */}
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: spacing.lg }}>
            {/* Today sticks */}
            <View style={{ gap: 4 }}>
              <Text
                variant="caption"
                style={{ textTransform: 'uppercase', letterSpacing: 1.6, color: theme.textMuted }}
              >
                Today
              </Text>
              {hidden ? (
                <Text
                  style={[
                    typography.display as TextStyle,
                    { fontSize: 56, lineHeight: 60, letterSpacing: -1, fontFamily: fonts.display, color: theme.text, fontVariant: ['tabular-nums'] },
                  ]}
                >
                  ••
                </Text>
              ) : (
                <AnimatedNumber
                  value={todaySticks}
                  style={[
                    typography.display as TextStyle,
                    { fontSize: 56, lineHeight: 60, letterSpacing: -1, fontFamily: fonts.display, color: theme.text, fontVariant: ['tabular-nums'] },
                  ]}
                  accessibilityLabel={`Today's count: ${todaySticks} ${todaySticks === 1 ? 'cigarette' : 'cigarettes'}`}
                />
              )}
            </View>
            {/* Spend — right-aligned, smaller numeral */}
            <View style={{ gap: 4, alignItems: 'flex-end', paddingBottom: 6 }}>
              <Text
                variant="caption"
                style={{ textTransform: 'uppercase', letterSpacing: 1.6, color: theme.textMuted }}
              >
                Spend
              </Text>
              {hidden ? (
                <Text
                  style={[
                    typography.h1 as TextStyle,
                    { fontFamily: fonts.display, color: theme.text, fontVariant: ['tabular-nums'] },
                  ]}
                >
                  •••
                </Text>
              ) : (
                <AnimatedNumber
                  value={todaySpend}
                  format={(n) => ledgerMoney(n, { compact: true })}
                  style={[
                    typography.h1 as TextStyle,
                    { fontFamily: fonts.display, color: theme.text, fontVariant: ['tabular-nums'] },
                  ]}
                  accessibilityLabel={`Spent today: ${ledgerMoney(todaySpend)}`}
                />
              )}
            </View>
          </View>

          {/* Deck copy */}
          <Text variant="body" muted>{deck}</Text>

          {/* Rule + Quick log strip */}
          <Divider strong />
          <QuickLogRow
            profile={profile}
            brands={brands}
            lastEntry={last}
            pending={quickLogPending}
            error={quickLogError}
            toast={toast}
            onLogLast={handleLogLast}
            onLogBrand={handleLogBrand}
            onAdvanced={() => router.push('/log/new')}
          />
        </View>
      </FadeSlideIn>

      {/* ── Ledger — typographic rows ── */}
      <FadeSlideIn index={2}>
        <View style={{ gap: 0 }}>
          <Text
            variant="caption"
            style={{ textTransform: 'uppercase', letterSpacing: 1.6, color: theme.textMuted, marginBottom: spacing.md }}
          >
            The ledger
          </Text>

          {/* Row: 7-day average */}
          <View style={{ paddingVertical: spacing.md, gap: 2 }}>
            <Divider strong />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', paddingTop: spacing.md }}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text variant="body">Seven-day average</Text>
                <Text variant="small" muted>
                  Trend{' '}
                  <Text variant="small" color={trendColor}>
                    {formatDelta(trend.deltaPct)}
                  </Text>
                  {' '}vs your 30-day baseline
                </Text>
              </View>
              {hidden ? (
                <Text
                  style={[typography.h1 as TextStyle, { fontFamily: fonts.display, color: theme.text, fontVariant: ['tabular-nums'] }]}
                >
                  ••
                </Text>
              ) : (
                <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 2 }}>
                  <AnimatedNumber
                    value={avgPerDay}
                    format={(n) => n.toFixed(1)}
                    style={[typography.h1 as TextStyle, { fontFamily: fonts.display, color: theme.text, fontVariant: ['tabular-nums'] }]}
                    accessibilityLabel={`Seven-day average: ${avgPerDay.toFixed(1)} per day`}
                  />
                  <Text variant="small" faint>/d</Text>
                </View>
              )}
            </View>
          </View>

          {/* Row: Smoke-free streak */}
          <View style={{ paddingVertical: spacing.md, gap: 2 }}>
            <Divider />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', paddingTop: spacing.md }}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text variant="body">Smoke-free streak</Text>
                <Text variant="small" muted>
                  {last ? `Last logged ${formatIndianDate(last.localDate)}` : 'No logs yet'}
                </Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 2 }}>
                <Text
                  style={[typography.h1 as TextStyle, { fontFamily: fonts.display, color: streakColor, fontVariant: ['tabular-nums'] }]}
                  accessibilityLabel={`Smoke-free streak: ${streak} ${streak === 1 ? 'day' : 'days'}`}
                >
                  {streak}
                </Text>
                <Text variant="small" faint>d</Text>
              </View>
            </View>
          </View>
        </View>
      </FadeSlideIn>

      {/* ── Goal verse ── */}
      {goalProgress ? (
        <FadeSlideIn index={3}>
          <Pressable
            onPress={() => router.push('/goals')}
            accessibilityRole="button"
            accessibilityLabel="Your goal — open goals"
            style={{ gap: spacing.sm }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
              <Text
                variant="caption"
                style={{ textTransform: 'uppercase', letterSpacing: 1.6, color: theme.textMuted }}
              >
                Your goal
              </Text>
              {goals.length > 1 ? (
                <Text variant="small" style={{ color: theme.textMuted }}>View all →</Text>
              ) : null}
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', gap: spacing.xs }}>
              <Text
                variant="h2"
                style={{ fontFamily: fonts.display }}
              >
                {goalHeading}
              </Text>
              <Text variant="h2" faint> · </Text>
              <Text
                variant="h2"
                color={goalPositive ? theme.accent : theme.warnEarth}
                style={{ fontVariant: ['tabular-nums'] }}
              >
                {Math.round(Math.max(0, Math.min(100, goalProgress.percent)))}%
              </Text>
            </View>
            <ProgressBar
              value={goalProgress.percent}
              tone={goalPositive ? 'success' : 'warnEarth'}
              height={2}
            />
            {goalExplanation ? (
              <Text variant="small" muted>{goalExplanation}</Text>
            ) : null}
            {goalLine ? <Text variant="small" muted>{goalLine}</Text> : null}
          </Pressable>
        </FadeSlideIn>
      ) : null}

      {/* ── A first goal — a quiet suggestion, only when there is none ── */}
      {showFirstSuggestion && firstProposal && suggestionUser ? (
        <FadeSlideIn index={3}>
          <View style={{ gap: spacing.sm }}>
            <Text
              variant="caption"
              style={{ textTransform: 'uppercase', letterSpacing: 1.6, color: theme.textMuted }}
            >
              A first goal
            </Text>
            <Text muted>
              {firstSuggestionSentence(
                firstProposal,
                loggedDays(logs, ledgerDaysAgo(PROPOSAL_DATA_WINDOW_DAYS - 1), today),
                hidden,
              )}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
              <Pressable
                onPress={() => router.push('/goals/new?type=daily_cap')}
                accessibilityRole="link"
                accessibilityLabel="See the suggestion"
                style={{ minHeight: 44, justifyContent: 'center' }}
              >
                <Text variant="small" style={{ textDecorationLine: 'underline', fontWeight: '500' }}>
                  See the suggestion
                </Text>
              </Pressable>
              <Button
                title="Not now"
                variant="ghost"
                size="md"
                onPress={() => {
                  void dismissFirstSuggestion(suggestionUser.id, today);
                  setSuggestionUser({ ...suggestionUser, dismissed: true });
                }}
              />
            </View>
          </View>
        </FadeSlideIn>
      ) : null}

      {/* ── The week — inverted ink panel ── */}
      {logs.length > 0 ? (
        <FadeSlideIn index={4}>
          <WeekInkPanel data={weekBars} hidden={hidden} />
        </FadeSlideIn>
      ) : null}

      {/* ── Body recovery / health milestones ── */}
      <FadeSlideIn index={5}>
        <View style={{ gap: spacing.md }}>
          <Text
            variant="caption"
            style={{ textTransform: 'uppercase', letterSpacing: 1.6, color: theme.textMuted }}
          >
            Body recovery
          </Text>
          <HealthMilestones lastSmokeIso={last?.tsUtc ?? null} />
        </View>
      </FadeSlideIn>

      {/* ── Did you know — sourced facts ── */}
      <FadeSlideIn index={6}>
        <FactsCarousel count={4} />
      </FadeSlideIn>

      {/* ── Editor's note — single insight ── */}
      {insights.length > 0 ? (
        <FadeSlideIn index={6}>
          <View style={{ gap: spacing.md }}>
            <Text
              variant="caption"
              style={{ textTransform: 'uppercase', letterSpacing: 1.6, color: theme.textMuted }}
            >
              From your week
            </Text>
            {/* Blockquote: left border + Fraunces headline */}
            <View
              style={{
                borderLeftWidth: 2,
                borderLeftColor: theme.ruleStrong,
                paddingLeft: spacing.lg,
                gap: spacing.xs,
              }}
            >
              <Text
                style={[
                  typography.h2 as TextStyle,
                  { fontFamily: fonts.displaySoft, color: theme.text, lineHeight: 28 },
                ]}
              >
                {insights[0].title}
              </Text>
              {insights[0].explanation ? (
                <Text variant="body" muted>{insights[0].explanation}</Text>
              ) : null}
            </View>
          </View>
        </FadeSlideIn>
      ) : null}

      {/* ── Savings + Monthly forecast ── */}
      {savings && savings.totalInr > 0 ? (
        <FadeSlideIn index={7}>
          <Card>
            <View style={{ gap: spacing.md }}>
              {/* Savings */}
              <View style={{ gap: spacing.xs }}>
                <Text
                  variant="caption"
                  style={{ textTransform: 'uppercase', letterSpacing: 1.6, color: theme.textMuted }}
                >
                  Saved since you started
                </Text>
                {hidden ? (
                  <Text
                    style={[
                      typography.h1 as TextStyle,
                      { fontFamily: fonts.display, color: theme.accent, fontVariant: ['tabular-nums'] },
                    ]}
                  >
                    •••
                  </Text>
                ) : (
                  <AnimatedNumber
                    value={savings.totalInr}
                    format={(n) => ledgerMoney(n, { compact: true })}
                    style={[
                      typography.h1 as TextStyle,
                      { fontFamily: fonts.display, color: theme.accent, fontVariant: ['tabular-nums'] },
                    ]}
                  />
                )}
                {savings.ratePerStick != null ? (
                  <Text variant="small" muted>
                    {maskCount(savings.sticksAvoided, hidden)} sticks below baseline since you started × {maskInr(savings.ratePerStick, hidden, (n) => ledgerMoney(n))} per stick
                  </Text>
                ) : null}
              </View>

              <Divider />

              {/* Monthly forecast */}
              <View style={{ gap: spacing.xs }}>
                <Text
                  variant="caption"
                  style={{ textTransform: 'uppercase', letterSpacing: 1.6, color: theme.textMuted }}
                >
                  Month forecast
                </Text>
                {hidden ? (
                  <Text style={[typography.h1 as TextStyle, { fontFamily: fonts.display, color: theme.text }]}>
                    •••
                  </Text>
                ) : (
                  <AnimatedNumber
                    value={forecast.forecast}
                    format={(n) => ledgerMoney(n, { compact: true })}
                    style={[
                      typography.h1 as TextStyle,
                      { fontFamily: fonts.display, color: theme.text, fontVariant: ['tabular-nums'] },
                    ]}
                  />
                )}
                <Text variant="small" muted>
                  {forecast.daysElapsed}/{forecast.daysInMonth} days elapsed
                </Text>
              </View>
            </View>
          </Card>
        </FadeSlideIn>
      ) : null}

      {/* ── Empty state ── */}
      {logs.length === 0 ? (
        <FadeSlideIn index={8}>
          <View style={{ gap: spacing.sm, paddingTop: spacing.lg }}>
            <Divider />
            <Text
              style={[
                typography.h2 as TextStyle,
                { fontFamily: fonts.displaySoft, color: theme.text, lineHeight: 28, paddingTop: spacing.lg },
              ]}
            >
              No entries yet.
            </Text>
            <Text variant="body" muted style={{ maxWidth: 320 }}>
              Logging one cigarette is enough to start seeing your spend, your cadence, and the days you skipped.
            </Text>
            <Button
              title="Log your first"
              variant="primary"
              style={{ alignSelf: 'flex-start', marginTop: spacing.sm }}
              onPress={() => router.push('/log/new')}
            />
          </View>
        </FadeSlideIn>
      ) : null}

      {/* ── Footer ── */}
      <FadeSlideIn index={9}>
        <View style={{ paddingTop: spacing.md, gap: 0 }}>
          <Divider />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: spacing.md }}>
            <Pressable
              onPress={() => router.push('/log')}
              accessibilityRole="link"
              style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
            >
              <Text
                variant="small"
                muted
                style={{ textDecorationLine: 'underline', textDecorationColor: theme.ruleStrong }}
              >
                View full history →
              </Text>
            </Pressable>
            <Text variant="caption" faint style={{ fontStyle: 'italic' }}>
              Quiet, on purpose.
            </Text>
          </View>
        </View>
      </FadeSlideIn>

    </Screen>
  );
}

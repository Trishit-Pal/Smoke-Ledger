'use client';

/*
 * Dashboard — "Quiet editorial · your own report, across time"
 *
 * The dashboard is now a TIMEFRAME HUB: a Day / Week / Month / Year switch drives
 * four lead metrics — sticks + trend, spend, saved, and goal + streak — all derived
 * from the canonical per-day daily-summary (src/domain/periodSummary), the single
 * source of truth shared with Trends and mobile. Totals reconcile across windows
 * (weekly == sum of its 7 daily totals) and across devices.
 *
 * Character animations (greet, streak milestones, birthday, quick-log moods) are
 * preserved; the streak now comes from the uncapped summary so it no longer
 * truncates at the raw-log window.
 */

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { revalidateAppViews } from '../_actions/revalidate';
import { dailyStats, dayShift, lastLog } from '@/domain/calc';
import {
  type DailySummaryRow,
  periodWithTrend,
  savedAllTime,
  streakFromRows,
  totalsForWindow,
  weightedAvgUnitPrice,
} from '@/domain/periodSummary';
import { evaluateGoal } from '@/domain/goals';
import { goalTypeLabel } from '@/domain/goalForm';
import { generateInsights } from '@/domain/insights';
import { todayIst, daysAgoIst, dayOfWeekShort, formatIndianDate } from '@/lib/date';
import { isBirthdayToday } from '@/domain/age';
import { formatInr, formatDelta, formatPerStick } from '@/lib/format';
import { isHomeTotalsHidden, isDiscreetMode } from '@/lib/discreet';
import { createLog, inferUnitPriceForVariant } from '@/db/repositories/logs';
import { AnalyticsEvents } from '@/constants/events';
import { track } from '@/services/analytics';
import { toSafeErrorMessage } from '@/lib/errors';

import { HealthMilestones } from '@web/components/ui/HealthMilestones';
import { QuickLogStrip } from '@web/components/dashboard/QuickLogStrip';
import { WeekStrip } from '@web/components/dashboard/WeekStrip';
import { CharacterCompanion } from '@web/components/character/CharacterCompanion';
import { SectionLabel, MetricRow } from '@web/components/visual';
import {
  dispatchMood,
  dispatchMilestone,
  milestoneForStreak,
} from '@web/lib/character/mood';
import type { Brand, BrandVariant, CigaretteLog, Goal, UserProfile } from '@/types';

export interface DashboardClientProps {
  profile: UserProfile;
  logs: CigaretteLog[];
  goals: Goal[];
  brands: (Brand & { variants: BrandVariant[] })[];
  summary: DailySummaryRow[];
  summarySinceYmd: string;
}

type WindowDays = 1 | 7 | 30 | 365;

const WINDOWS: { days: WindowDays; label: string }[] = [
  { days: 1, label: 'Day' },
  { days: 7, label: 'Week' },
  { days: 30, label: 'Month' },
  { days: 365, label: 'Year' },
];

/** "today" / "this week" / "this month" / "this year". */
function periodNoun(days: WindowDays): string {
  switch (days) {
    case 1:
      return 'today';
    case 7:
      return 'this week';
    case 30:
      return 'this month';
    case 365:
      return 'this year';
  }
}

/** "day" / "week" / "month" / "year" — for the "vs previous ___" comparison. */
function periodUnit(days: WindowDays): string {
  switch (days) {
    case 1:
      return 'day';
    case 7:
      return 'week';
    case 30:
      return 'month';
    case 365:
      return 'year';
  }
}

function headlineDeck(opts: {
  sticks: number;
  windowDays: WindowDays;
  deltaPct: number;
  streak: number;
  hidden: boolean;
}): string {
  if (opts.hidden) return 'Totals — hidden.';
  const { sticks, windowDays, deltaPct, streak } = opts;
  const noun = periodNoun(windowDays);
  if (sticks === 0) {
    if (streak >= 7) return `Smoke-free for ${streak} days. Nothing logged ${noun}.`;
    if (streak >= 1) return `${streak === 1 ? 'A day' : `${streak} days`} smoke-free. Nothing ${noun}.`;
    return `Nothing logged ${noun}.`;
  }
  const word = sticks === 1 ? 'cigarette' : 'cigarettes';
  if (windowDays === 1) {
    return `${sticks} ${word} today, ${formatDelta(deltaPct)} vs yesterday.`;
  }
  return `${sticks} ${word} ${noun}, ${formatDelta(deltaPct)} vs the previous ${periodUnit(windowDays)}.`;
}

function trendTone(deltaPct: number): 'up' | 'down' | 'flat' {
  if (!Number.isFinite(deltaPct)) return 'flat';
  if (deltaPct > 2) return 'up';
  if (deltaPct < -2) return 'down';
  return 'flat';
}

export function DashboardClient({
  profile,
  logs,
  goals,
  brands,
  summary,
  summarySinceYmd,
}: DashboardClientProps) {
  const router = useRouter();
  const [quickLogError, setQuickLogError] = React.useState<string | null>(null);
  const [quickLogPending, setQuickLogPending] = React.useState(false);
  const [toast, setToast] = React.useState<string | null>(null);
  const [windowDays, setWindowDays] = React.useState<WindowDays>(1);

  const today = todayIst();
  const hidden = isHomeTotalsHidden(profile);

  // ── Canonical timeframe metrics (single source of truth = the daily summary) ──
  const period = React.useMemo(
    () => periodWithTrend(summary, windowDays, today),
    [summary, windowDays, today],
  );
  const sticks = period.current.sticks;
  const spend = period.current.spendInr;
  const avgPerDay = sticks / windowDays;

  const fallbackUnit = React.useMemo(() => weightedAvgUnitPrice(summary) ?? 0, [summary]);
  const baseline = profile.baselinePerDay ?? 0;
  const savedStart = React.useMemo(() => {
    const windowStart = dayShift(today, -(windowDays - 1));
    return windowStart > summarySinceYmd ? windowStart : summarySinceYmd;
  }, [today, windowDays, summarySinceYmd]);
  const periodSaved = React.useMemo(
    () => savedAllTime(summary, baseline, fallbackUnit, savedStart, today),
    [summary, baseline, fallbackUnit, savedStart, today],
  );
  const allTimeSaved = React.useMemo(
    () => savedAllTime(summary, baseline, fallbackUnit, summarySinceYmd, today),
    [summary, baseline, fallbackUnit, summarySinceYmd, today],
  );
  const streak = React.useMemo(() => streakFromRows(summary, today), [summary, today]);

  // Today's count (independent of the selected window) — used for the quick-log mood.
  const todaySticks = React.useMemo(() => totalsForWindow(summary, 1, today).sticks, [summary, today]);

  // Week strip stays a fixed 7-day view; raw logs (60-day) cover it and sum quantity
  // identically to the summary.
  const weekBars = React.useMemo(() => {
    const stats = dailyStats(logs, daysAgoIst(6), today);
    return stats.map((s) => ({
      label: dayOfWeekShort(s.date).slice(0, 1).toUpperCase(),
      value: s.sticks,
    }));
  }, [logs, today]);
  const last = React.useMemo(() => lastLog(logs), [logs]);
  const insights = React.useMemo(() => generateInsights(logs, today), [logs, today]);

  const activeGoal = goals.find((g) => g.status === 'active') ?? null;
  const goalProgress = React.useMemo(
    () => (activeGoal ? evaluateGoal(activeGoal, logs, today) : null),
    [activeGoal, logs, today],
  );
  // Spend caps embed ₹ in evaluateGoal().label — show a money-free label under discreet mode.
  const goalHeading =
    activeGoal?.type === 'spend_cap_daily' && isDiscreetMode(profile)
      ? goalTypeLabel(activeGoal.type)
      : goalProgress?.label ?? null;
  // `goals` here is the active-only set from getServerGoals; >1 means others aren't shown.
  const hasMoreGoals = goals.length > 1;

  // CHARACTER: soft greet on first render only.
  React.useEffect(() => {
    const t = window.setTimeout(() => dispatchMood('greet', { durationMs: 1800 }), 400);
    return () => window.clearTimeout(t);
  }, []);

  // CHARACTER: fire the milestone modal when the smoke-free streak crosses a tier.
  const prevStreakRef = React.useRef<number | null>(null);
  const toastTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  React.useEffect(() => {
    return () => { if (toastTimerRef.current) clearTimeout(toastTimerRef.current); };
  }, []);
  React.useEffect(() => {
    if (prevStreakRef.current === null) { prevStreakRef.current = streak; return; }
    const prev = prevStreakRef.current;
    if (streak > prev) {
      const m = milestoneForStreak(streak);
      if (m) dispatchMilestone(m);
    } else if (streak === 0 && prev >= 3) {
      dispatchMood('concern', {
        caption: 'Streak reset — tomorrow is a fresh page.',
        durationMs: 3800,
      });
    }
    prevStreakRef.current = streak;
  }, [streak]);

  // Birthday celebration — once per session.
  const birthdayFiredRef = React.useRef(false);
  React.useEffect(() => {
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

  const runQuickLog = React.useCallback(
    async (opts: {
      brandId: string | null;
      brandName: string | null;
      variantName: string | null;
      quantity: number;
    }) => {
      try {
        setQuickLogError(null);
        setQuickLogPending(true);
        const inferred = await inferUnitPriceForVariant(opts.variantName, opts.brandId);
        const unit = inferred;
        const total = unit != null ? unit * opts.quantity : null;
        await createLog({
          tsUtc: new Date().toISOString(),
          brandId: opts.brandId,
          brandNameSnap: opts.brandName,
          variantSnap: opts.variantName,
          quantity: opts.quantity,
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

        // CHARACTER: mood based on the post-log day total vs baseline.
        const newDayTotal = todaySticks + opts.quantity;
        if (baseline > 0 && newDayTotal > baseline) {
          dispatchMood('concern', {
            caption: 'Above your baseline — be kind to yourself.',
            durationMs: 3400,
          });
        } else {
          dispatchMood('regret', { caption: 'Noted. No judgment.', durationMs: 3200 });
        }

        setToast(
          `Logged ${opts.quantity} · ${opts.brandName ?? 'entry'}${
            total != null ? ` · ${formatInr(total, { compact: true })}` : ''
          }`,
        );
        if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
        toastTimerRef.current = setTimeout(() => setToast(null), 2500);
        await revalidateAppViews();
        router.refresh();
      } catch (e) {
        setQuickLogError(toSafeErrorMessage(e, 'dependency_failure'));
      } finally {
        setQuickLogPending(false);
      }
    },
    [router, todaySticks, baseline],
  );

  const deck = headlineDeck({ sticks, windowDays, deltaPct: period.stickDeltaPct, streak, hidden });
  const tTone = trendTone(period.stickDeltaPct);
  const trendColour =
    tTone === 'up' ? 'var(--warn-earth)' : tTone === 'down' ? 'var(--accent)' : 'var(--text-muted)';
  const periodCap = WINDOWS.find((w) => w.days === windowDays)?.label ?? 'Day';

  const idx = (n: number) => ({ ['--ed-index' as string]: n } as React.CSSProperties);

  return (
    <div className="relative mx-auto w-full max-w-[44rem] lg:max-w-[52rem] xl:max-w-[60rem] px-lg pt-xl pb-xxxl md:pt-xxl md:px-xxl">
      <div aria-hidden className="paper-noise absolute inset-0 -z-10" />

      <div className="editorial-stage flex flex-col section-gap">
        {/* ─────────────── Masthead ─────────────── */}
        <header style={idx(0)} className="flex flex-col group-tight relative">
          <div className="flex items-center gap-md">
            <span aria-hidden className="h-px flex-1 bg-[var(--rule-strong)] rule-draw" style={idx(0)} />
            <span className="editorial-caption nums-tabular">{formatIndianDate(today)}</span>
            <span aria-hidden className="h-px flex-1 bg-[var(--rule-strong)] rule-draw" style={idx(0)} />
          </div>
          <p className="text-small text-text-muted text-center italic">Your ledger</p>
          <div className="hidden md:block absolute -top-2 right-0 pointer-events-none">
            <CharacterCompanion size={88} />
          </div>
        </header>

        {/* ─────────────── Timeframe switch ─────────────── */}
        <div
          style={idx(1)}
          role="tablist"
          aria-label="Time frame"
          className="flex items-center gap-xs self-center rounded-full border border-[var(--rule)] p-xs"
        >
          {WINDOWS.map((w) => {
            const selected = windowDays === w.days;
            return (
              <button
                key={w.days}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => setWindowDays(w.days)}
                className="min-h-[40px] px-md rounded-full text-small transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
                style={{
                  background: selected ? 'var(--text)' : 'transparent',
                  color: selected ? 'var(--bg)' : 'var(--text-muted)',
                }}
              >
                {w.label}
              </button>
            );
          })}
        </div>

        {/* ─────────────── Headline · the period in one number ─────────────── */}
        <section style={idx(2)} aria-labelledby="period-heading" className="flex flex-col subsection-gap">
          <h2 id="period-heading" className="sr-only">{periodCap}</h2>

          <div className="flex items-end justify-between gap-lg flex-wrap">
            <div className="flex flex-col">
              <span className="editorial-caption mb-sm">{periodCap}</span>
              <div
                className="editorial-numeral editorial-headline-rise"
                aria-label={
                  hidden
                    ? 'Count hidden'
                    : `${sticks} ${sticks === 1 ? 'cigarette' : 'cigarettes'} ${periodNoun(windowDays)}`
                }
              >
                {hidden ? '••' : sticks}
              </div>
            </div>
            <div className="flex flex-col items-end text-right ml-auto pb-sm">
              <span className="editorial-caption mb-sm">Spend</span>
              <div
                className="editorial-numeral--small nums-tabular"
                aria-label={hidden ? 'Spend hidden' : `Spent ${formatInr(spend)}`}
              >
                {hidden ? '•••' : formatInr(spend, { compact: true })}
              </div>
              {!hidden && sticks > 0 && spend > 0 ? (
                <span className="text-caption text-text-faint nums-tabular mt-xs">
                  {formatPerStick(spend / sticks, { compact: true })}
                </span>
              ) : null}
            </div>
          </div>

          <p className="text-body text-text-muted max-w-[40ch]">{deck}</p>

          <div className="rule-hair pt-md">
            <QuickLogStrip
              profile={profile}
              brands={brands}
              lastLog={last}
              pending={quickLogPending}
              onLog={runQuickLog}
              onAdvanced={() => router.push('/log/new')}
            />
            {toast ? (
              <p role="status" aria-live="polite" className="text-small text-accent mt-md">{toast}</p>
            ) : null}
            {quickLogError ? (
              <p role="alert" className="text-small mt-md" style={{ color: 'var(--warn-earth)' }}>
                {quickLogError}
              </p>
            ) : null}
          </div>
        </section>

        {/* ─────────────── Ledger — period-aware rows ─────────────── */}
        <section style={idx(3)} aria-labelledby="ledger-heading" className="flex flex-col">
          <SectionLabel id="ledger-heading">The ledger</SectionLabel>

          <dl className="flex flex-col">
            {/* Average per day + trend vs previous period */}
            <MetricRow
              variant="first"
              label="Average per day"
              subtitle={
                <>
                  Trend{' '}
                  <span style={{ color: trendColour }} className="nums-tabular">
                    {formatDelta(period.stickDeltaPct)}
                  </span>{' '}
                  vs the previous {periodUnit(windowDays)}
                </>
              }
              value={
                <>
                  {hidden ? '••' : avgPerDay.toFixed(1)}
                  <span className="text-small text-text-faint font-sans ml-xs">/d</span>
                </>
              }
              ariaLabel={
                hidden ? 'Average per day hidden' : `Average per day: ${avgPerDay.toFixed(1)}`
              }
            />

            {/* Money saved this period + all-time */}
            <MetricRow
              label={`Saved ${periodNoun(windowDays)}`}
              subtitle={
                hidden
                  ? '•••'
                  : `${formatInr(allTimeSaved.totalInr, { compact: true })} since you started`
              }
              value={hidden ? '•••' : formatInr(periodSaved.totalInr, { compact: true })}
              tone={periodSaved.totalInr > 0 ? 'accent' : 'neutral'}
              ariaLabel={
                hidden
                  ? 'Saved hidden'
                  : `Saved ${periodNoun(windowDays)}: ${formatInr(periodSaved.totalInr)}`
              }
            />

            {/* Smoke-free streak */}
            <MetricRow
              label="Smoke-free streak"
              subtitle={last ? `Last logged ${formatIndianDate(last.localDate)}` : 'No logs yet'}
              value={
                <>
                  {streak}
                  <span className="text-small text-text-faint font-sans ml-xs">d</span>
                </>
              }
              tone={streak >= 1 ? 'accent' : 'neutral'}
              ariaLabel={`Smoke-free streak: ${streak} ${streak === 1 ? 'day' : 'days'}`}
            />
          </dl>
        </section>

        {/* ─────────────── Goal verse ─────────────── */}
        {goalProgress ? (
          <section style={idx(4)} aria-labelledby="goal-heading" className="flex flex-col subsection-gap">
            <div className="flex items-baseline justify-between gap-md">
              <Link href="/goals" id="goal-heading" className="editorial-caption hover:text-accent transition-colors">
                Your goal
              </Link>
              {hasMoreGoals ? (
                <Link href="/goals" className="text-small text-text-muted hover:text-accent transition-colors shrink-0">
                  View all goals →
                </Link>
              ) : null}
            </div>
            <p className="editorial-headline text-[clamp(1.25rem,2.4vw,1.6rem)] text-text">
              {goalHeading}
              <span className="text-text-faint"> · </span>
              <span
                className="editorial-numeral--micro"
                style={{
                  color: goalProgress.atRisk
                    ? 'var(--warn-earth)'
                    : goalProgress.isOnTrack
                    ? 'var(--accent)'
                    : 'var(--text-muted)',
                }}
              >
                {Math.round(Math.max(0, Math.min(100, goalProgress.percent)))}%
              </span>
            </p>
            <div
              className="relative h-px w-full bg-[var(--rule)] mt-sm overflow-hidden"
              role="progressbar"
              aria-valuenow={Math.round(Math.max(0, Math.min(100, goalProgress.percent)))}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Goal progress"
            >
              <div
                className="absolute inset-y-[-1px] left-0"
                style={{
                  width: `${Math.max(0, Math.min(100, goalProgress.percent))}%`,
                  height: 2,
                  background: goalProgress.atRisk
                    ? 'var(--warn-earth)'
                    : goalProgress.isOnTrack
                    ? 'var(--accent)'
                    : 'var(--text-muted)',
                  transition: 'width 600ms cubic-bezier(0.16,1,0.3,1)',
                }}
              />
            </div>
          </section>
        ) : null}

        {/* ─────────────── The last 7 days ─────────────── */}
        {summary.length > 0 ? (
          <section style={idx(5)} aria-labelledby="week-heading">
            <div className="ink-panel rounded-xl p-xl flex flex-col gap-lg">
              <div className="flex items-baseline justify-between">
                <SectionLabel id="week-heading" tone="inverse" spacing="none">
                  The last 7 days
                </SectionLabel>
                <span className="text-small ink-muted nums-tabular">{dayOfWeekShort(daysAgoIst(6))} — {dayOfWeekShort(today)}</span>
              </div>
              <WeekStrip data={weekBars} inverted hidden={hidden} />
            </div>
          </section>
        ) : null}

        {/* ─────────────── Body recovery ─────────────── */}
        <section style={idx(6)} aria-labelledby="recovery-heading">
          <SectionLabel id="recovery-heading">Body recovery</SectionLabel>
          <HealthMilestones lastSmokeIso={last?.tsUtc ?? null} />
        </section>

        {/* ─────────────── Editor's note ─────────────── */}
        {insights.length > 0 ? (
          <section style={idx(7)} aria-labelledby="insight-heading" className="flex flex-col subsection-gap">
            <SectionLabel id="insight-heading">From your week</SectionLabel>
            <blockquote className="relative pl-lg border-l-2 border-[var(--rule-strong)]">
              <p className="editorial-pullquote text-text">
                {insights[0]?.title}
              </p>
              {insights[0]?.explanation ? (
                <p className="text-body text-text-muted mt-sm">{insights[0].explanation}</p>
              ) : null}
            </blockquote>
          </section>
        ) : null}

        {/* ─────────────── Empty state ─────────────── */}
        {summary.length === 0 ? (
          <section style={idx(8)} className="rule-hair pt-lg flex flex-col gap-sm">
            <p className="editorial-headline text-[clamp(1.125rem,2vw,1.375rem)] text-text">No entries yet.</p>
            <p className="text-body text-text-muted max-w-[40ch]">
              Logging one cigarette is enough to start seeing your spend, your cadence, and the days you skipped.
            </p>
            <button
              type="button"
              onClick={() => router.push('/log/new')}
              className="self-start mt-sm inline-flex items-center min-h-[44px] px-lg rounded-md bg-text text-bg font-medium text-body hover:opacity-90 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
            >
              Log your first
            </button>
          </section>
        ) : null}

        {/* ─────────────── Footer ─────────────── */}
        <footer style={idx(9)} className="rule-hair pt-md flex items-center justify-between">
          <button
            type="button"
            onClick={() => router.push('/log')}
            className="text-small text-text-muted hover:text-text underline underline-offset-4 decoration-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg rounded-sm"
            style={{ textDecorationColor: 'var(--rule-strong)' }}
          >
            View full history →
          </button>
          <span className="text-caption text-text-faint italic">Quiet, on purpose.</span>
        </footer>
      </div>
    </div>
  );
}

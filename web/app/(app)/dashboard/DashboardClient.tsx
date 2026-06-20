'use client';

/*
 * Dashboard — "Quiet editorial · your own daily report"
 *
 * ─── CHARACTER ANIMATIONS INTEGRATION ──────────────────────────────────────
 * The five additions below are the ONLY changes vs the original file. Each is
 * tagged with `// CHARACTER:` so they're easy to lift if you want to apply a
 * surgical patch instead of replacing the file.
 *
 *   1. Imports for CharacterCompanion + the mood bus.
 *   2. Greet mood fired on first dashboard load.
 *   3. Streak-milestone detection — when streak crosses a tier, the milestone
 *      modal fires.
 *   4. Mood dispatched inside runQuickLog when a log lands (regret if under
 *      baseline, concern if it pushed the user over).
 *   5. <CharacterCompanion> rendered inside the masthead header.
 *
 * Everything else (data path, layout, copy, classes) is unchanged.
 * ───────────────────────────────────────────────────────────────────────────
 */

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { revalidateAppViews } from '../_actions/revalidate';
import {
  dailyStats,
  sticksOn,
  spendOn,
  trendVsBaseline,
  rollingAvgSticks,
  smokeFreeStreak,
  lastLog,
} from '@/domain/calc';
import { evaluateGoal } from '@/domain/goals';
import { generateInsights } from '@/domain/insights';
import { todayIst, daysAgoIst, dayOfWeekShort, formatIndianDate } from '@/lib/date';
import { isBirthdayToday } from '@/domain/age';
import { formatInr, formatDelta } from '@/lib/format';
import { isHomeTotalsHidden } from '@/lib/discreet';
import { createLog, inferUnitPriceForVariant } from '@/db/repositories/logs';
import { AnalyticsEvents } from '@/constants/events';
import { track } from '@/services/analytics';
import { toSafeErrorMessage } from '@/lib/errors';

import { HealthMilestones } from '@web/components/ui/HealthMilestones';
import { QuickLogStrip } from '@web/components/dashboard/QuickLogStrip';
import { WeekStrip } from '@web/components/dashboard/WeekStrip';
// CHARACTER (1): imports for the companion + mood bus.
import { CharacterCompanion } from '@web/components/character/CharacterCompanion';
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
}

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
    if (todaySticks < baseline) return `${todaySticks} today — below your usual day.`;
    if (todaySticks === baseline) return `${todaySticks} today — at your usual.`;
    return `${todaySticks} today — above your usual day.`;
  }
  return `${todaySticks} today.`;
}

function trendTone(deltaPct: number): 'up' | 'down' | 'flat' {
  if (!Number.isFinite(deltaPct)) return 'flat';
  if (deltaPct > 2) return 'up';
  if (deltaPct < -2) return 'down';
  return 'flat';
}

export function DashboardClient({ profile, logs, goals, brands }: DashboardClientProps) {
  const router = useRouter();
  const [quickLogError, setQuickLogError] = React.useState<string | null>(null);
  const [quickLogPending, setQuickLogPending] = React.useState(false);
  const [toast, setToast] = React.useState<string | null>(null);

  const today = todayIst();
  const todaySticks = React.useMemo(() => sticksOn(logs, today), [logs, today]);
  const todaySpend = React.useMemo(() => spendOn(logs, today), [logs, today]);
  const avgPerDay = React.useMemo(() => rollingAvgSticks(logs, today, 7), [logs, today]);
  const trend = React.useMemo(() => trendVsBaseline(logs, today, 7, 30), [logs, today]);
  const weekBars = React.useMemo(() => {
    const stats = dailyStats(logs, daysAgoIst(6), today);
    return stats.map((s) => ({
      label: dayOfWeekShort(s.date).slice(0, 1).toUpperCase(),
      value: s.sticks,
    }));
  }, [logs, today]);
  const streak = React.useMemo(() => smokeFreeStreak(logs, today), [logs, today]);
  const last = React.useMemo(() => lastLog(logs), [logs]);
  const insights = React.useMemo(() => generateInsights(logs, today), [logs, today]);
  const hidden = isHomeTotalsHidden(profile);

  const activeGoal = goals[0] ?? null;
  const goalProgress = React.useMemo(
    () => (activeGoal ? evaluateGoal(activeGoal, logs, today) : null),
    [activeGoal, logs, today],
  );

  // CHARACTER (2): fire a soft greet on first dashboard render so the figure
  // reaches its resting wave. We deliberately don't fire on every render —
  // only on mount.
  React.useEffect(() => {
    const t = window.setTimeout(() => dispatchMood('greet', { durationMs: 1800 }), 400);
    return () => window.clearTimeout(t);
  }, []);

  // CHARACTER (3): when the smoke-free streak crosses a tier (1, 3, 7, 14, 30
  // days), fire the full milestone modal. Only fires when the value INCREASES
  // into a tier — so re-renders, refreshes, and history edits that drop the
  // streak don't re-trigger.
  const prevStreakRef = React.useRef<number | null>(null);
  const toastTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  React.useEffect(() => {
    return () => { if (toastTimerRef.current) clearTimeout(toastTimerRef.current); };
  }, []);
  React.useEffect(() => {
    if (prevStreakRef.current === null) { prevStreakRef.current = streak; return; }
    if (streak > prevStreakRef.current) {
      const m = milestoneForStreak(streak);
      if (m) dispatchMilestone(m);
    }
    prevStreakRef.current = streak;
  }, [streak]);

  // Birthday celebration — fired once per session.
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

        // CHARACTER (4): pick a mood based on the post-log day total vs
        // baseline. Computed inline so we don't have to wait for the router
        // refresh to update `todaySticks`.
        const newDayTotal = todaySticks + opts.quantity;
        const baseline = profile.baselinePerDay ?? null;
        if (baseline && baseline > 0 && newDayTotal > baseline) {
          dispatchMood('concern', {
            caption: 'Above your baseline — be kind to yourself.',
            durationMs: 3400,
          });
        } else {
          dispatchMood('regret', {
            caption: 'Noted. No judgment.',
            durationMs: 3200,
          });
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
    [router, todaySticks, profile.baselinePerDay],
  );

  const deck = headlineDeck({ todaySticks, baseline: profile.baselinePerDay, streak, hidden });
  const tTone = trendTone(trend.deltaPct);
  const trendColour =
    tTone === 'up' ? 'var(--warn-earth)' : tTone === 'down' ? 'var(--accent)' : 'var(--text-muted)';
  const streakColour = streak >= 1 ? 'var(--accent)' : 'var(--text)';

  const idx = (n: number) => ({ ['--ed-index' as string]: n } as React.CSSProperties);

  return (
    <div className="relative mx-auto w-full max-w-[44rem] lg:max-w-[52rem] xl:max-w-[60rem] px-lg pt-xl pb-xxxl md:pt-xxl md:px-xxl">
      <div aria-hidden className="paper-noise absolute inset-0 -z-10" />

      <div className="editorial-stage flex flex-col gap-xxl">
        {/* ─────────────── Masthead ─────────────── */}
        <header style={idx(0)} className="flex flex-col gap-sm relative">
          <div className="flex items-center gap-md">
            <span aria-hidden className="h-px flex-1 bg-[var(--rule-strong)] rule-draw" style={idx(0)} />
            <span className="editorial-caption nums-tabular">{formatIndianDate(today)}</span>
            <span aria-hidden className="h-px flex-1 bg-[var(--rule-strong)] rule-draw" style={idx(0)} />
          </div>
          <p className="text-small text-text-muted text-center italic">
            Your daily ledger
          </p>

          {/* CHARACTER (5): the masthead companion. Hidden on narrow viewports
              so it never collides with the rule on small screens. Position
              is absolute against the header (header is relative above), so
              it doesn't disturb the existing layout. */}
          <div className="hidden md:block absolute -top-2 right-0 pointer-events-none">
            <CharacterCompanion size={88} />
          </div>
        </header>

        {/* ─────────────── Headline · the day in one number ─────────────── */}
        <section style={idx(1)} aria-labelledby="today-heading" className="flex flex-col gap-lg">
          <h2 id="today-heading" className="sr-only">
            Today
          </h2>

          <div className="flex items-end justify-between gap-lg flex-wrap">
            <div className="flex flex-col">
              <span className="editorial-caption mb-sm">Today</span>
              <div
                className="editorial-numeral editorial-headline-rise"
                aria-label={
                  hidden
                    ? "Today's count: hidden"
                    : `Today's count: ${todaySticks} ${todaySticks === 1 ? 'cigarette' : 'cigarettes'}`
                }
              >
                {hidden ? '••' : todaySticks}
              </div>
            </div>
            <div className="flex flex-col items-end text-right ml-auto pb-sm">
              <span className="editorial-caption mb-sm">Spend</span>
              <div className="editorial-numeral--small nums-tabular" aria-label={hidden ? 'Spend hidden' : `Spent today: ${formatInr(todaySpend)}`}>
                {hidden ? '•••' : formatInr(todaySpend, { compact: true })}
              </div>
            </div>
          </div>

          <p className="text-body text-text-muted max-w-[36ch]">{deck}</p>

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
              <p
                role="status"
                aria-live="polite"
                className="text-small text-accent mt-md"
              >
                {toast}
              </p>
            ) : null}
            {quickLogError ? (
              <p
                role="alert"
                className="text-small mt-md"
                style={{ color: 'var(--warn-earth)' }}
              >
                {quickLogError}
              </p>
            ) : null}
          </div>
        </section>

        {/* ─────────────── Ledger — two typographic rows ─────────────── */}
        <section style={idx(2)} aria-labelledby="ledger-heading" className="flex flex-col">
          <h2 id="ledger-heading" className="editorial-caption mb-md">
            The ledger
          </h2>

          <dl className="flex flex-col">
            <div className="rule-hair-strong grid grid-cols-[1fr_auto] items-baseline gap-md py-md">
              <div>
                <dt className="text-body text-text">Seven-day average</dt>
                <dd className="text-small text-text-muted nums-tabular">
                  Trend{' '}
                  <span style={{ color: trendColour }} className="nums-tabular">
                    {formatDelta(trend.deltaPct)}
                  </span>{' '}
                  vs your 30-day baseline
                </dd>
              </div>
              <dd
                className="editorial-numeral--small nums-tabular text-right"
                aria-label={hidden ? 'Seven-day average hidden' : `Seven-day average: ${avgPerDay.toFixed(1)} per day`}
              >
                {hidden ? '••' : avgPerDay.toFixed(1)}
                <span className="text-small text-text-faint font-sans ml-xs">/d</span>
              </dd>
            </div>

            <div className="rule-hair grid grid-cols-[1fr_auto] items-baseline gap-md py-md">
              <div>
                <dt className="text-body text-text">Smoke-free streak</dt>
                <dd className="text-small text-text-muted">
                  {last ? `Last logged ${formatIndianDate(last.localDate)}` : 'No logs yet'}
                </dd>
              </div>
              <dd
                className="editorial-numeral--small nums-tabular text-right"
                style={{ color: streakColour }}
                aria-label={`Smoke-free streak: ${streak} ${streak === 1 ? 'day' : 'days'}`}
              >
                {streak}
                <span className="text-small text-text-faint font-sans ml-xs">d</span>
              </dd>
            </div>
          </dl>
        </section>

        {/* ─────────────── Goal verse ─────────────── */}
        {goalProgress ? (
          <section style={idx(3)} aria-labelledby="goal-heading" className="flex flex-col gap-sm">
            <h2 id="goal-heading" className="editorial-caption">
              Your goal
            </h2>
            <p className="editorial-headline text-[clamp(1.25rem,2.4vw,1.6rem)] text-text">
              {goalProgress.label}
              <span className="text-text-faint"> · </span>
              <span
                className="nums-tabular"
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

        {/* ─────────────── The week ─────────────── */}
        {logs.length > 0 ? (
          <section style={idx(4)} aria-labelledby="week-heading">
            <div className="ink-panel rounded-xl p-xl flex flex-col gap-lg">
              <div className="flex items-baseline justify-between">
                <h2 id="week-heading" className="editorial-caption" style={{ color: 'var(--ink-surface-muted)' }}>
                  The week
                </h2>
                <span className="text-small ink-muted nums-tabular">
                  Mon — Sun
                </span>
              </div>
              <WeekStrip data={weekBars} inverted hidden={hidden} />
            </div>
          </section>
        ) : null}

        {/* ─────────────── Body recovery ─────────────── */}
        <section style={idx(5)} aria-labelledby="recovery-heading">
          <h2 id="recovery-heading" className="editorial-caption mb-md">
            Body recovery
          </h2>
          <HealthMilestones lastSmokeIso={last?.tsUtc ?? null} />
        </section>

        {/* ─────────────── Editor's note ─────────────── */}
        {insights.length > 0 ? (
          <section style={idx(6)} aria-labelledby="insight-heading" className="flex flex-col gap-md">
            <h2 id="insight-heading" className="editorial-caption">
              From your week
            </h2>
            <blockquote className="relative pl-lg border-l-2 border-[var(--rule-strong)]">
              <p className="editorial-headline text-[clamp(1.125rem,2vw,1.375rem)] text-text">
                {insights[0]?.title}
              </p>
              {insights[0]?.explanation ? (
                <p className="text-body text-text-muted mt-sm">{insights[0].explanation}</p>
              ) : null}
            </blockquote>
          </section>
        ) : null}

        {/* ─────────────── Empty state ─────────────── */}
        {logs.length === 0 ? (
          <section style={idx(7)} className="rule-hair pt-lg flex flex-col gap-sm">
            <p className="editorial-headline text-[clamp(1.125rem,2vw,1.375rem)] text-text">
              No entries yet.
            </p>
            <p className="text-body text-text-muted max-w-[40ch]">
              Logging one cigarette is enough to start seeing your spend, your
              cadence, and the days you skipped.
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
        <footer style={idx(8)} className="rule-hair pt-md flex items-center justify-between">
          <button
            type="button"
            onClick={() => router.push('/log')}
            className="text-small text-text-muted hover:text-text underline underline-offset-4 decoration-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg rounded-sm"
            style={{ textDecorationColor: 'var(--rule-strong)' }}
          >
            View full history →
          </button>
          <span className="text-caption text-text-faint italic">
            Quiet, on purpose.
          </span>
        </footer>
      </div>
    </div>
  );
}

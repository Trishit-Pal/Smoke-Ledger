'use client';

/*
 * ─────────────────────────────────────────────────────────────────────────────
 *  Dashboard — "Quiet editorial · your own daily report" (revamp pilot)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *  Aesthetic direction: A single thoughtful spread, not a dashboard. The day's
 *  cigarette count is presented as an editorial display numeral (Fraunces,
 *  display optical-size, light weight, tight tracking). Sections aren't cards —
 *  they are layout movements held together by hairline rules and small caps
 *  captions, the way a Sunday paper is. Teal is reserved for genuinely positive
 *  moments (a real smoke-free streak, an under-baseline week). Trend-up uses a
 *  muted terracotta earth tone, never alarm red. Gamification is absent on
 *  purpose — this is a quit-smoking app, and the design respects that.
 *
 *  Motion: a single page-load choreography. The masthead, headline numeral, and
 *  ledger rows rise in sequence with a slow gravitational ease (CSS keyframes
 *  via .editorial-stage + --ed-index). Charts animate their bar heights in.
 *  Everything short-circuits under prefers-reduced-motion via the global rule
 *  in globals.css.
 *
 *  Data path is unchanged. The exported `DashboardClient` keeps the same name
 *  and props so page.tsx is untouched.
 *
 *  Discreet mode (isHomeTotalsHidden) masks all numeric totals consistently —
 *  the editorial numeral becomes "••", spend lines collapse to "•••", week
 *  bars flatten to a quiet uniform track.
 */

import * as React from 'react';
import { useRouter } from 'next/navigation';
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
import { formatInr, formatDelta } from '@/lib/format';
import { isHomeTotalsHidden } from '@/lib/discreet';
import { createLog, inferUnitPriceForVariant } from '@/db/repositories/logs';
import { AnalyticsEvents } from '@/constants/events';
import { track } from '@/services/analytics';
import { toSafeErrorMessage } from '@/lib/errors';

import { HealthMilestones } from '@web/components/ui/HealthMilestones';
import { QuickLogStrip } from '@web/components/dashboard/QuickLogStrip';
import { WeekStrip } from '@web/components/dashboard/WeekStrip';
import type { Brand, BrandVariant, CigaretteLog, Goal, UserProfile } from '@/types';

export interface DashboardClientProps {
  profile: UserProfile;
  logs: CigaretteLog[];
  goals: Goal[];
  brands: (Brand & { variants: BrandVariant[] })[];
}

/** Editorial sentence for the headline number — keeps tone honest, not cheerful,
 *  not alarming. Returns a phrase that pairs with the visible numeral. */
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

/** Tone for the 7-day trend line. Earth-toned terracotta for "up", teal for
 *  "down" (positive), neutral for stable. NEVER alarm red. */
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
        setToast(
          `Logged ${opts.quantity} · ${opts.brandName ?? 'entry'}${
            total != null ? ` · ${formatInr(total, { compact: true })}` : ''
          }`,
        );
        window.setTimeout(() => setToast(null), 2500);
        router.refresh();
      } catch (e) {
        setQuickLogError(toSafeErrorMessage(e, 'dependency_failure'));
      } finally {
        setQuickLogPending(false);
      }
    },
    [router],
  );

  const deck = headlineDeck({ todaySticks, baseline: profile.baselinePerDay, streak, hidden });
  const tTone = trendTone(trend.deltaPct);
  const trendColour =
    tTone === 'up' ? 'var(--warn-earth)' : tTone === 'down' ? 'var(--accent)' : 'var(--text-muted)';
  const streakColour = streak >= 1 ? 'var(--accent)' : 'var(--text)';

  // Helper for editorial stage CSS-variable indexing (drives the stagger reveal).
  const idx = (n: number) => ({ ['--ed-index' as string]: n } as React.CSSProperties);

  return (
    <div className="relative mx-auto w-full max-w-[44rem] px-lg pt-xl pb-xxxl md:pt-xxl md:px-xxl">
      {/* Atmospheric paper noise — purely decorative, behind everything. */}
      <div aria-hidden className="paper-noise absolute inset-0 -z-10" />

      <div className="editorial-stage flex flex-col gap-xxl">
        {/* ─────────────── Masthead ─────────────── */}
        <header style={idx(0)} className="flex flex-col gap-sm">
          <div className="flex items-center gap-md">
            <span aria-hidden className="h-px flex-1 bg-[var(--rule-strong)] rule-draw" style={idx(0)} />
            <span className="editorial-caption nums-tabular">{formatIndianDate(today)}</span>
            <span aria-hidden className="h-px flex-1 bg-[var(--rule-strong)] rule-draw" style={idx(0)} />
          </div>
          <p className="text-small text-text-muted text-center italic">
            Your daily ledger
          </p>
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
            {/* Row 1 — 7-day average */}
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

            {/* Row 2 — smoke-free streak */}
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
            {/* Hairline progress rule — does the work of a progress bar, quietly. */}
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

        {/* ─────────────── The week — inverted editorial spread ─────────────── */}
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

        {/* ─────────────── Editor's note — pull quote ─────────────── */}
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

        {/* ─────────────── Empty state — a quiet invitation ─────────────── */}
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

        {/* ─────────────── Footer — typographic link ─────────────── */}
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

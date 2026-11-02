// Session store — in-memory cache; rehydrates from Supabase when authenticated.

import { create } from 'zustand';
import type { Brand, BrandVariant, CigaretteLog, Goal, UserProfile } from '@/types';
import type { GoalPatchInput } from '@/lib/validation';
import * as logsRepo from '@/db/repositories/logs';
import * as brandsRepo from '@/db/repositories/brands';
import { maybeSyncDefaultBrandCatalog } from '@/lib/catalogSync';
import { makeNativeCatalogStorage } from '@/lib/catalogStorageNative';
import * as goalsRepo from '@/db/repositories/goals';
import * as profileRepo from '@/db/repositories/profile';
import * as summaryRepo from '@/db/repositories/summary';
import { useOnboardingDraft } from '@/store/onboardingDraft';
import type { DailySummaryRow as PeriodRow } from '@/domain/periodSummary';
import { daysAgoInZone, daysAgoIst, todayInZone, todayIst } from '@/lib/date';
import { timezoneForCountry } from '@/lib/regions';
import { reconcileGoals } from '@/services/goalReconcile';
import { track } from '@/services/analytics';
import { AnalyticsEvents } from '@/constants/events';
import type { GoalTransition } from '@/domain/goalTransitions';

/** Earliest day "saved" should count from: onboarding, floored at the RPC's 366-day cap. */
function summarySinceFor(profile: UserProfile | null): string {
  const yearAgo = daysAgoIst(365);
  const onboard = profile?.onboardedAt ? profile.onboardedAt.slice(0, 10) : null;
  return onboard && onboard > yearAgo ? onboard : yearAgo;
}

/** Boundary adapter: repo DailySummaryRow → the domain engine's DailySummaryRow. */
function toPeriodRow(r: summaryRepo.DailySummaryRow): PeriodRow {
  return {
    date: r.localDate,
    sticks: r.sticks,
    spendInr: r.totalSpendInr,
    avgUnitPriceInr: r.avgUnitPriceInr,
  };
}

/** Boot-time fetch — empty on error is acceptable (other slices fail loudly too). */
async function fetchSummary(): Promise<PeriodRow[]> {
  const rows = await summaryRepo.getDailySummary(daysAgoIst(365), todayIst()).catch(() => []);
  return rows.map(toPeriodRow);
}

interface Reconciled {
  goals: Goal[];
  applied: GoalTransition[];
  failed: boolean;
}

/**
 * Writes any goal transition that has come due and returns the goals as they now stand.
 * Idempotent (the planner returns nothing once a write has landed) and never throws, so
 * boot cannot be blocked by it; `today` is the reader's ledger date; a failed write leaves the goal as stored and sets `failed`.
 */
async function reconcileLoaded(goals: Goal[], logs: CigaretteLog[], today: string): Promise<Reconciled> {
  try {
    const r = await reconcileGoals(goals, logs, today, {
      setGoalStatus: goalsRepo.setGoalStatus,
      updateGoal: goalsRepo.updateGoal,
    });
    return { goals: r.goals, applied: r.applied, failed: r.failed.length > 0 };
  } catch {
    return { goals, applied: [], failed: true };
  }
}

/** Append moments, skipping any already queued (two overlapping reconciles can plan the same one). */
function withMoments(queued: GoalTransition[], applied: GoalTransition[]): GoalTransition[] {
  const fresh = applied.filter((a) => !queued.some((q) => q.goalId === a.goalId && q.kind === a.kind));
  return fresh.length === 0 ? queued : [...queued, ...fresh];
}

// Initial hydration window. Trends/history screens fetch their own deeper
// windows on demand so we keep the boot payload small.
const LOG_LOOKBACK_DAYS = 90;
export const HISTORY_LOG_LOOKBACK_DAYS = 365;
// ponytail: one page of up to 2000 rows; the 90-day window holds >= 22 entries a day under that
// ceiling. If nextCursor is ever non-null, page until it is null.
const GOAL_WINDOW_LOG_LIMIT = 2000;

async function loadGoalWindowLogs() {
  const { logs } = await logsRepo.listLogsPage({
    fromDate: daysAgoIst(LOG_LOOKBACK_DAYS),
    toDate: todayIst(),
    limit: GOAL_WINDOW_LOG_LIMIT,
  });
  return logs;
}

interface SessionState {
  booted: boolean;
  profile: UserProfile | null;
  logs: CigaretteLog[];
  brands: (Brand & { variants: BrandVariant[] })[];
  goals: Goal[];
  // Canonical per-day daily-summary (quantity-correct, up to 365 days) — the
  // single source of truth for dashboard/trends timeframe totals. `summarySinceYmd`
  // floors "saved" so pre-onboarding days aren't counted.
  summary: PeriodRow[];
  summarySinceYmd: string;
  // Deliberate achievement-animation dismissals this login session. In-memory
  // only and zeroed in reset(), so it naturally resets per login. See
  // `@/lib/achievements` for the suppression rule.
  achievementDismissCount: number;
  // Goal transitions applied by reconcile that the goals tab has yet to announce.
  pendingGoalMoments: GoalTransition[];
  // True when the last reconcile could not save a due goal update; the goals tab says so.
  goalsReconcileFailed: boolean;

  boot: () => Promise<void>;
  reset: () => void;
  refreshLogs: () => Promise<void>;
  refreshBrands: () => Promise<void>;
  refreshGoals: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  refreshSummary: () => Promise<void>;
  refreshAll: () => Promise<void>;
  incrementAchievementDismiss: () => void;
  /** Returns the queued goal moments and clears the queue. */
  consumeGoalMoments: () => GoalTransition[];

  addLog: (draft: logsRepo.LogDraft) => Promise<CigaretteLog>;
  updateLog: (id: string, patch: Partial<CigaretteLog>) => Promise<void>;
  removeLog: (id: string) => Promise<void>;

  addGoal: (
    input: Parameters<typeof goalsRepo.createGoal>[0],
    opts?: { fromProposal?: boolean },
  ) => Promise<Goal>;
  updateGoal: (id: string, patch: GoalPatchInput) => Promise<Goal>;
  setGoalStatus: (id: string, status: Goal['status']) => Promise<void>;
  removeGoal: (id: string) => Promise<void>;
}

export const useSession = create<SessionState>((set, get) => ({
  booted: false,
  profile: null,
  logs: [],
  brands: [],
  goals: [],
  summary: [],
  summarySinceYmd: daysAgoIst(365),
  achievementDismissCount: 0,
  pendingGoalMoments: [],
  goalsReconcileFailed: false,

  reset: () => {
    // Clear the in-memory onboarding draft on logout so a different user does
    // not inherit the previous session's un-committed input.
    useOnboardingDraft.getState().clear();
    set({
      booted: false,
      profile: null,
      logs: [],
      brands: [],
      goals: [],
      summary: [],
      summarySinceYmd: daysAgoIst(365),
      achievementDismissCount: 0,
      pendingGoalMoments: [],
      goalsReconcileFailed: false,
    });
  },

  boot: async () => {
    // Keep existing users in sync with the evolving default catalog (once per
    // catalog version). On native we hydrate the marker from AsyncStorage so the
    // gate survives cold boots — without it, `window` is undefined and the RPC
    // would re-run on every launch. The RPC is timeout-guarded internally.
    const catalogStorage = await makeNativeCatalogStorage();
    await maybeSyncDefaultBrandCatalog(catalogStorage).catch(() => undefined);
    const [profile, logs, brands, goals, summary] = await Promise.all([
      profileRepo.getProfile(),
      loadGoalWindowLogs(),
      brandsRepo.listBrandsWithVariants(),
      goalsRepo.listAllGoals(),
      fetchSummary(),
    ]);
    // The store's profile is not set yet at boot, so read the zone from the profile just loaded.
    const today = todayInZone(timezoneForCountry(profile?.country));
    const reconciled = await reconcileLoaded(goals, logs, today);
    set((s) => ({
      booted: true,
      profile,
      logs,
      brands,
      goals: reconciled.goals,
      pendingGoalMoments: withMoments(s.pendingGoalMoments, reconciled.applied),
      goalsReconcileFailed: reconciled.failed,
      summary,
      summarySinceYmd: summarySinceFor(profile),
    }));
  },

  refreshLogs: async () => {
    set({ logs: await loadGoalWindowLogs() });
  },
  refreshBrands: async () => {
    const brands = await brandsRepo.listBrandsWithVariants();
    set({ brands });
  },
  refreshGoals: async () => {
    const loaded = await goalsRepo.listAllGoals();
    const reconciled = await reconcileLoaded(loaded, get().logs, ledgerToday());
    set((s) => ({
      goals: reconciled.goals,
      pendingGoalMoments: withMoments(s.pendingGoalMoments, reconciled.applied),
      goalsReconcileFailed: reconciled.failed,
    }));
  },
  refreshProfile: async () => {
    const profile = await profileRepo.getProfile();
    set({ profile, summarySinceYmd: summarySinceFor(profile) });
  },
  refreshSummary: async () => {
    // Preserve the prior summary on a transient failure — a refresh after a log
    // write must never blank the dashboard's totals.
    try {
      const rows = await summaryRepo.getDailySummary(daysAgoIst(365), todayIst());
      set({ summary: rows.map(toPeriodRow) });
    } catch {
      // keep existing summary
    }
  },
  // Re-pull every slice at once. Used by the foreground/focus refetch fallback
  // and after a backgrounded socket reconnects (see RealtimeRefresher).
  refreshAll: async () => {
    const { refreshLogs, refreshBrands, refreshGoals, refreshProfile, refreshSummary } = get();
    await Promise.all([
      refreshLogs(),
      refreshBrands(),
      refreshGoals(),
      refreshProfile(),
      refreshSummary(),
    ]);
  },

  incrementAchievementDismiss: () =>
    set((s) => ({ achievementDismissCount: s.achievementDismissCount + 1 })),

  consumeGoalMoments: () => {
    const moments = get().pendingGoalMoments;
    if (moments.length > 0) set({ pendingGoalMoments: [] });
    return moments;
  },

  addLog: async (draft) => {
    // Every native log comes through here: stamp local_date / local_hour in the
    // ledger's zone (the profile country; IST when there is none).
    const created = await logsRepo.createLog({ ...draft, timeZone: draft.timeZone ?? ledgerTimeZone() });
    set((s) => ({ logs: [created, ...s.logs] }));
    // The dashboard/trends totals read `summary`; keep it in step after a write.
    await get().refreshSummary();
    return created;
  },
  updateLog: async (id, patch) => {
    await logsRepo.updateLog(id, patch);
    set((s) => ({ logs: s.logs.map((l) => (l.id === id ? { ...l, ...patch } : l)) }));
    await get().refreshSummary();
  },
  removeLog: async (id) => {
    await logsRepo.deleteLog(id);
    set((s) => ({ logs: s.logs.filter((l) => l.id !== id) }));
    await get().refreshSummary();
  },

  addGoal: async (input, opts) => {
    const created = await goalsRepo.createGoal(input);
    set((s) => ({ goals: [created, ...s.goals] }));
    void track(AnalyticsEvents.GOAL_CREATED, {
      type: created.type,
      from_proposal: opts?.fromProposal ?? false,
    });
    return created;
  },
  updateGoal: async (id, patch) => {
    const updated = await goalsRepo.updateGoal(id, patch);
    set((s) => ({ goals: s.goals.map((g) => (g.id === id ? updated : g)) }));
    return updated;
  },
  setGoalStatus: async (id, status) => {
    await goalsRepo.setGoalStatus(id, status);
    // The DB stamps completed_at on completed/abandoned; mirror it locally until the next load.
    const completedAt = status === 'completed' || status === 'abandoned' ? new Date().toISOString() : null;
    set((s) => ({ goals: s.goals.map((g) => (g.id === id ? { ...g, status, completedAt } : g)) }));
  },
  removeGoal: async (id) => {
    await goalsRepo.deleteGoal(id);
    set((s) => ({ goals: s.goals.filter((g) => g.id !== id) }));
  },
}));

/**
 * The zone a new log's local_date / local_hour are stamped in: the profile's
 * country, IST when there is none. Native screens that call createLog directly
 * pass this as `timeZone`; without it createLog falls back to IST.
 */
export function ledgerTimeZone(): string {
  return timezoneForCountry(useSession.getState().profile?.country);
}

/** Today in the ledger zone — the date new logs are stamped with. */
export function ledgerToday(): string {
  return todayInZone(ledgerTimeZone());
}

export function ledgerDaysAgo(days: number): string {
  return daysAgoInZone(days, ledgerTimeZone());
}

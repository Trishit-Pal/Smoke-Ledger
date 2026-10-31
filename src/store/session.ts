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

// Initial hydration window. Trends/history screens fetch their own deeper
// windows on demand so we keep the boot payload small.
const LOG_LOOKBACK_DAYS = 90;
export const HISTORY_LOG_LOOKBACK_DAYS = 365;

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

  boot: () => Promise<void>;
  reset: () => void;
  refreshLogs: () => Promise<void>;
  refreshBrands: () => Promise<void>;
  refreshGoals: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  refreshSummary: () => Promise<void>;
  refreshAll: () => Promise<void>;
  incrementAchievementDismiss: () => void;

  addLog: (draft: logsRepo.LogDraft) => Promise<CigaretteLog>;
  updateLog: (id: string, patch: Partial<CigaretteLog>) => Promise<void>;
  removeLog: (id: string) => Promise<void>;

  addGoal: (input: Parameters<typeof goalsRepo.createGoal>[0]) => Promise<Goal>;
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
      logsRepo.listLogs({ fromDate: daysAgoIst(LOG_LOOKBACK_DAYS), toDate: todayIst() }),
      brandsRepo.listBrandsWithVariants(),
      goalsRepo.listAllGoals(),
      fetchSummary(),
    ]);
    set({
      booted: true,
      profile,
      logs,
      brands,
      goals,
      summary,
      summarySinceYmd: summarySinceFor(profile),
    });
  },

  refreshLogs: async () => {
    const logs = await logsRepo.listLogs({
      fromDate: daysAgoIst(LOG_LOOKBACK_DAYS),
      toDate: todayIst(),
    });
    set({ logs });
  },
  refreshBrands: async () => {
    const brands = await brandsRepo.listBrandsWithVariants();
    set({ brands });
  },
  refreshGoals: async () => {
    const goals = await goalsRepo.listAllGoals();
    set({ goals });
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

  addGoal: async (input) => {
    const created = await goalsRepo.createGoal(input);
    set((s) => ({ goals: [created, ...s.goals] }));
    return created;
  },
  updateGoal: async (id, patch) => {
    const updated = await goalsRepo.updateGoal(id, patch);
    set((s) => ({ goals: s.goals.map((g) => (g.id === id ? updated : g)) }));
    return updated;
  },
  setGoalStatus: async (id, status) => {
    await goalsRepo.setGoalStatus(id, status);
    set((s) => ({ goals: s.goals.map((g) => (g.id === id ? { ...g, status } : g)) }));
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

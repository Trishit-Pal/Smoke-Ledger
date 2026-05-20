// Session store — in-memory cache; rehydrates from Supabase when authenticated.

import { create } from 'zustand';
import type { Brand, BrandVariant, CigaretteLog, Goal, UserProfile } from '@/types';
import * as logsRepo from '@/db/repositories/logs';
import * as brandsRepo from '@/db/repositories/brands';
import * as goalsRepo from '@/db/repositories/goals';
import * as profileRepo from '@/db/repositories/profile';
import { daysAgoIst, todayIst } from '@/lib/date';

// Initial hydration window. Trends/history screens fetch their own deeper
// windows on demand so we keep the boot payload small.
const LOG_LOOKBACK_DAYS = 60;
export const HISTORY_LOG_LOOKBACK_DAYS = 365;

interface SessionState {
  booted: boolean;
  profile: UserProfile | null;
  logs: CigaretteLog[];
  brands: (Brand & { variants: BrandVariant[] })[];
  goals: Goal[];

  boot: () => Promise<void>;
  reset: () => void;
  refreshLogs: () => Promise<void>;
  refreshBrands: () => Promise<void>;
  refreshGoals: () => Promise<void>;
  refreshProfile: () => Promise<void>;

  addLog: (draft: logsRepo.LogDraft) => Promise<CigaretteLog>;
  updateLog: (id: string, patch: Partial<CigaretteLog>) => Promise<void>;
  removeLog: (id: string) => Promise<void>;
}

export const useSession = create<SessionState>((set, get) => ({
  booted: false,
  profile: null,
  logs: [],
  brands: [],
  goals: [],

  reset: () =>
    set({
      booted: false,
      profile: null,
      logs: [],
      brands: [],
      goals: [],
    }),

  boot: async () => {
    // Keep existing users in sync with the evolving default catalog.
    await brandsRepo.syncDefaultBrandCatalog().catch(() => undefined);
    const [profile, logs, brands, goals] = await Promise.all([
      profileRepo.getProfile(),
      logsRepo.listLogs({ fromDate: daysAgoIst(LOG_LOOKBACK_DAYS), toDate: todayIst() }),
      brandsRepo.listBrandsWithVariants(),
      goalsRepo.listActiveGoals(),
    ]);
    set({ booted: true, profile, logs, brands, goals });
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
    const goals = await goalsRepo.listActiveGoals();
    set({ goals });
  },
  refreshProfile: async () => {
    const profile = await profileRepo.getProfile();
    set({ profile });
  },

  addLog: async (draft) => {
    const created = await logsRepo.createLog(draft);
    set((s) => ({ logs: [created, ...s.logs] }));
    return created;
  },
  updateLog: async (id, patch) => {
    await logsRepo.updateLog(id, patch);
    set((s) => ({ logs: s.logs.map((l) => (l.id === id ? { ...l, ...patch } : l)) }));
  },
  removeLog: async (id) => {
    await logsRepo.deleteLog(id);
    set((s) => ({ logs: s.logs.filter((l) => l.id !== id) }));
  },
}));

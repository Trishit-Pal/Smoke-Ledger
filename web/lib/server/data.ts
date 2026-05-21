import { cache } from 'react';
import { redirect } from 'next/navigation';
import { createClient } from '@web/lib/supabase/server';
import { daysAgoIst } from '@/lib/date';
import type {
  Brand,
  BrandVariant,
  CigaretteLog,
  Goal,
  PurchaseMode,
  PriceSource,
  UserProfile,
} from '@/types';

type ProfileRow = {
  id: string;
  baseline_per_day: number | null;
  baseline_window_days: number;
  currency: string;
  discreet_mode: boolean;
  app_lock_enabled: boolean;
  hide_totals_on_home: boolean;
  onboarded_at: string | null;
  onboarding_step: UserProfile['onboardingStep'];
  age_confirmed_at: string | null;
  terms_version: string | null;
  privacy_version: string | null;
  health_disclaimer_version: string | null;
  data_processing_consent_at: string | null;
  marketing_consent_at: string | null;
};

type LogRow = {
  id: string;
  ts_utc: string;
  local_date: string;
  local_hour: number;
  brand_id: string | null;
  brand_name_snap: string | null;
  variant_snap: string | null;
  quantity: number;
  purchase_mode: PurchaseMode;
  pack_size: number | null;
  total_price_inr: number | null;
  unit_price_inr: number | null;
  price_source: PriceSource;
  trigger_tag: string | null;
  mood_before: string | null;
  mood_after: string | null;
  craving: number | null;
  context_tag: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type GoalRow = {
  id: string;
  type: Goal['type'];
  target_value: number;
  current_baseline: number | null;
  start_date: string;
  end_date: string | null;
  status: Goal['status'];
  meta_json: Record<string, unknown> | string | null;
  created_at: string;
};

type BrandRow = {
  id: string;
  name: string;
  category: Brand['category'];
  is_seed: boolean;
  is_favorite: boolean;
  created_at: string;
  updated_at: string;
};

type VarRow = {
  id: string;
  brand_id: string;
  name: string;
  default_pack_size: number;
  avg_price_inr: number | null;
  last_price_inr: number | null;
  last_priced_at: string | null;
};

function mapProfile(row: ProfileRow): UserProfile {
  return {
    baselinePerDay: row.baseline_per_day,
    baselineWindowDays: row.baseline_window_days,
    currency: row.currency as UserProfile['currency'],
    discreetMode: row.discreet_mode,
    appLockEnabled: row.app_lock_enabled,
    hideTotalsOnHome: row.hide_totals_on_home,
    onboardedAt: row.onboarded_at,
    onboardingStep: row.onboarding_step ?? null,
    ageConfirmedAt: row.age_confirmed_at,
    termsVersion: row.terms_version,
    privacyVersion: row.privacy_version,
    healthDisclaimerVersion: row.health_disclaimer_version,
    dataProcessingConsentAt: row.data_processing_consent_at,
    marketingConsentAt: row.marketing_consent_at,
  };
}

function mapLog(row: LogRow): CigaretteLog {
  return {
    id: row.id,
    tsUtc: row.ts_utc,
    localDate: row.local_date,
    localHour: row.local_hour,
    brandId: row.brand_id,
    brandNameSnap: row.brand_name_snap,
    variantSnap: row.variant_snap,
    quantity: row.quantity,
    purchaseMode: row.purchase_mode,
    packSize: row.pack_size,
    totalPriceInr: row.total_price_inr != null ? Number(row.total_price_inr) : null,
    unitPriceInr: row.unit_price_inr != null ? Number(row.unit_price_inr) : null,
    priceSource: row.price_source,
    triggerTag: (row.trigger_tag as CigaretteLog['triggerTag']) ?? null,
    moodBefore: (row.mood_before as CigaretteLog['moodBefore']) ?? null,
    moodAfter: (row.mood_after as CigaretteLog['moodAfter']) ?? null,
    craving: row.craving,
    contextTag: (row.context_tag as CigaretteLog['contextTag']) ?? null,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapGoal(row: GoalRow): Goal {
  let meta: Record<string, unknown> | null = null;
  const raw = row.meta_json;
  if (raw == null) meta = null;
  else if (typeof raw === 'string') {
    try {
      meta = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      meta = null;
    }
  } else {
    meta = raw;
  }
  return {
    id: row.id,
    type: row.type,
    targetValue: Number(row.target_value),
    currentBaseline: row.current_baseline != null ? Number(row.current_baseline) : null,
    startDate: row.start_date,
    endDate: row.end_date,
    status: row.status,
    meta,
    createdAt: row.created_at,
  };
}

async function requireServerUserId(): Promise<string> {
  const supabase = createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) redirect('/login');
  return user.id;
}

export const getServerProfile = cache(async (): Promise<UserProfile> => {
  const supabase = createClient();
  const userId = await requireServerUserId();
  const { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();
  if (error || !data) redirect('/login');
  return mapProfile(data as ProfileRow);
});

export const getServerLogs = cache(
  async (opts?: { fromDate?: string; limit?: number }): Promise<CigaretteLog[]> => {
    const supabase = createClient();
    const userId = await requireServerUserId();
    const limit = Math.max(1, Math.min(opts?.limit ?? 5000, 5000));
    let q = supabase.from('cigarette_logs').select('*').eq('user_id', userId);
    if (opts?.fromDate) q = q.gte('local_date', opts.fromDate);
    q = q.order('ts_utc', { ascending: false }).limit(limit);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return (data as LogRow[]).map(mapLog);
  },
);

export const getServerGoals = cache(async (): Promise<Goal[]> => {
  const supabase = createClient();
  const userId = await requireServerUserId();
  const { data, error } = await supabase
    .from('goals')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data as GoalRow[]).map(mapGoal);
});

export const getServerBrandsWithVariants = cache(
  async (): Promise<(Brand & { variants: BrandVariant[] })[]> => {
    const supabase = createClient();
    const userId = await requireServerUserId();
    const { data: brands, error: bErr } = await supabase
      .from('brands')
      .select('*')
      .eq('user_id', userId)
      .order('is_favorite', { ascending: false })
      .order('name', { ascending: true });
    if (bErr) throw new Error(bErr.message);
    const { data: vars, error: vErr } = await supabase
      .from('brand_variants')
      .select('*')
      .eq('user_id', userId);
    if (vErr) throw new Error(vErr.message);
    const byBrand = new Map<string, BrandVariant[]>();
    for (const v of (vars ?? []) as VarRow[]) {
      const list = byBrand.get(v.brand_id) ?? [];
      list.push({
        id: v.id,
        brandId: v.brand_id,
        name: v.name,
        defaultPackSize: v.default_pack_size,
        avgPriceInr: v.avg_price_inr != null ? Number(v.avg_price_inr) : null,
        lastPriceInr: v.last_price_inr != null ? Number(v.last_price_inr) : null,
        lastPricedAt: v.last_priced_at,
      });
      byBrand.set(v.brand_id, list);
    }
    return ((brands ?? []) as BrandRow[]).map((b) => ({
      id: b.id,
      name: b.name,
      category: b.category,
      isSeed: b.is_seed,
      isFavorite: b.is_favorite,
      createdAt: b.created_at,
      updatedAt: b.updated_at,
      variants: byBrand.get(b.id) ?? [],
    }));
  },
);

export async function getServerSetting<T>(key: string): Promise<T | null> {
  const supabase = createClient();
  const userId = await requireServerUserId();
  const { data, error } = await supabase
    .from('settings_kv')
    .select('value_json')
    .eq('user_id', userId)
    .eq('key', key)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data?.value_json) return null;
  return data.value_json as T;
}

export async function getDashboardData() {
  const fromDate = daysAgoIst(60);
  const [profile, logs, goals, brands] = await Promise.all([
    getServerProfile(),
    getServerLogs({ fromDate, limit: 5000 }),
    getServerGoals(),
    getServerBrandsWithVariants(),
  ]);
  return { profile, logs, goals, brands };
}

export async function getLogPageData() {
  const today = daysAgoIst(0);
  const [profile, logs] = await Promise.all([
    getServerProfile(),
    getServerLogs({ fromDate: today, limit: 500 }),
  ]);
  return { profile, logs };
}

export async function getHistoryPageData() {
  const fromDate = daysAgoIst(365);
  const [profile, logs] = await Promise.all([
    getServerProfile(),
    getServerLogs({ fromDate, limit: 5000 }),
  ]);
  return { profile, logs };
}

export async function getTrendsPageData() {
  const fromDate = daysAgoIst(365);
  const [profile, logs] = await Promise.all([
    getServerProfile(),
    getServerLogs({ fromDate, limit: 5000 }),
  ]);
  return { profile, logs };
}

export async function getNewLogPageData() {
  const brands = await getServerBrandsWithVariants();
  return { brands };
}

export async function getSettingsPageData() {
  const [profile, brands, analyticsOptIn] = await Promise.all([
    getServerProfile(),
    getServerBrandsWithVariants(),
    getServerSetting<boolean>('consent.analyticsOptIn'),
  ]);
  return { profile, brands, analyticsOptIn: analyticsOptIn === true };
}

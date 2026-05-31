import { cache } from 'react';
import { unstable_cache } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@web/lib/supabase/server';
import { createAdminClient } from '@web/lib/supabase/admin';
import type { SupabaseClient } from '@supabase/supabase-js';
import { daysAgoIst } from '@/lib/date';
import type {
  Brand,
  BrandVariant,
  CigaretteLog,
  Goal,
  UserProfile,
} from '@/types';

type ProfileRow = {
  id: string;
  // supabase-js returns Postgres `numeric` columns as strings; we coerce in mapProfile.
  baseline_per_day: string | number | null;
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
    // numeric(5,2) is returned as a string by the pg driver; coerce to JS number.
    baselinePerDay: row.baseline_per_day != null ? Number(row.baseline_per_day) : null,
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

/** Maximum rows returned by `getServerLogs`. Callers that need more should use `getServerLogsPage`. */
const SERVER_LOGS_PAGE_SIZE = 200;

export interface LogCursor {
  ts: string;
  id: string;
}

export interface LogPage {
  logs: CigaretteLog[];
  nextCursor: LogCursor | null;
}

/** Raw payload shape returned by the `list_logs_page` RPC. */
type RpcLogRow = {
  id: string;
  tsUtc: string;
  localDate: string;
  localHour: number;
  brandId: string | null;
  brandNameSnap: string | null;
  variantSnap: string | null;
  quantity: number;
  purchaseMode: string;
  packSize: number | null;
  totalPriceInr: number | null;
  unitPriceInr: number | null;
  priceSource: string;
  triggerTag: string | null;
  moodBefore: string | null;
  moodAfter: string | null;
  craving: number | null;
  contextTag: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

type RpcListLogsPagePayload = {
  logs: RpcLogRow[];
  nextCursorTs: string | null;
  nextCursorId: string | null;
  hasMore: boolean;
};

function mapRpcLog(row: RpcLogRow): CigaretteLog {
  return {
    id: row.id,
    tsUtc: row.tsUtc,
    localDate: row.localDate,
    localHour: row.localHour,
    brandId: row.brandId,
    brandNameSnap: row.brandNameSnap,
    variantSnap: row.variantSnap,
    quantity: row.quantity,
    purchaseMode: row.purchaseMode as CigaretteLog['purchaseMode'],
    packSize: row.packSize,
    totalPriceInr: row.totalPriceInr != null ? Number(row.totalPriceInr) : null,
    unitPriceInr: row.unitPriceInr != null ? Number(row.unitPriceInr) : null,
    priceSource: row.priceSource as CigaretteLog['priceSource'],
    triggerTag: (row.triggerTag as CigaretteLog['triggerTag']) ?? null,
    moodBefore: (row.moodBefore as CigaretteLog['moodBefore']) ?? null,
    moodAfter: (row.moodAfter as CigaretteLog['moodAfter']) ?? null,
    craving: row.craving,
    contextTag: (row.contextTag as CigaretteLog['contextTag']) ?? null,
    notes: row.notes,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/**
 * Keyset-paginated server-side log fetch backed by the `list_logs_page` RPC.
 * Prefer this over `getServerLogs` for any view that may display large date ranges.
 */
export async function getServerLogsPage(opts?: {
  fromDate?: string;
  toDate?: string;
  brandId?: string;
  triggerTag?: string;
  cursor?: LogCursor | null;
  limit?: number;
}): Promise<LogPage> {
  const supabase = createClient();
  const userId = await requireServerUserId();
  const limit = Math.max(1, Math.min(opts?.limit ?? SERVER_LOGS_PAGE_SIZE, 5000));

  const { data, error } = await supabase.rpc('list_logs_page', {
    p_user_id: userId,
    p_from_date: opts?.fromDate ?? null,
    p_to_date: opts?.toDate ?? null,
    p_brand_id: opts?.brandId ?? null,
    p_trigger_tag: opts?.triggerTag ?? null,
    p_cursor_ts: opts?.cursor?.ts ?? null,
    p_cursor_id: opts?.cursor?.id ?? null,
    p_limit: limit,
  });
  if (error) throw new Error(error.message);

  const payload = data as RpcListLogsPagePayload;
  const logs = (Array.isArray(payload.logs) ? payload.logs : []).map(mapRpcLog);
  const nextCursor =
    payload.hasMore && payload.nextCursorTs && payload.nextCursorId
      ? { ts: payload.nextCursorTs, id: payload.nextCursorId }
      : null;

  return { logs, nextCursor };
}

/**
 * Flat-array log fetch capped at `SERVER_LOGS_PAGE_SIZE` (200) rows.
 * Delegates to `getServerLogsPage` so all reads go through the RPC.
 * If the result is capped and more rows exist, a server-side warning is emitted
 * to signal that the caller should migrate to `getServerLogsPage`.
 */
export const getServerLogs = cache(
  async (opts?: { fromDate?: string; limit?: number }): Promise<CigaretteLog[]> => {
    const limit = Math.max(1, Math.min(opts?.limit ?? SERVER_LOGS_PAGE_SIZE, SERVER_LOGS_PAGE_SIZE));
    const { logs, nextCursor } = await getServerLogsPage({
      fromDate: opts?.fromDate,
      limit,
    });

    if (nextCursor !== null) {
      console.warn(
        `[getServerLogs] Result capped at ${limit} rows — more data exists. ` +
          'Consider paginating via getServerLogsPage instead.',
      );
    }

    return logs;
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

/** Per-user cache tag for the brand+variant Data Cache. Bust via `revalidateBrands()`. */
export function brandsCacheTag(userId: string): string {
  return `brands:${userId}`;
}

/** Brand data changes rarely; cache it cross-request and let mutations bust the tag. */
const BRANDS_CACHE_TTL_SECONDS = 600;

async function loadBrandsWithVariants(
  supabase: SupabaseClient,
  userId: string,
): Promise<(Brand & { variants: BrandVariant[] })[]> {
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
    .eq('user_id', userId)
    .order('name', { ascending: true });
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
}

export const getServerBrandsWithVariants = cache(
  async (): Promise<(Brand & { variants: BrandVariant[] })[]> => {
    const userId = await requireServerUserId();
    const admin = createAdminClient();
    // Without a service-role key we cannot read inside unstable_cache (it forbids
    // cookies), so fall back to the request-scoped RLS client — correct, uncached.
    if (!admin) return loadBrandsWithVariants(createClient(), userId);
    // Cross-request Data Cache. Using the service-role client here is safe: every
    // query is explicitly scoped to the authenticated user's id, which is also the
    // cache key + tag, so no cross-user data can be cached or returned.
    return unstable_cache(
      () => loadBrandsWithVariants(admin, userId),
      ['brands-with-variants', userId],
      { tags: [brandsCacheTag(userId)], revalidate: BRANDS_CACHE_TTL_SECONDS },
    )();
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
    getServerLogs({ fromDate }),
    getServerGoals(),
    getServerBrandsWithVariants(),
  ]);
  return { profile, logs, goals, brands };
}

export async function getLogPageData() {
  const today = daysAgoIst(0);
  const [profile, logs] = await Promise.all([
    getServerProfile(),
    getServerLogs({ fromDate: today }),
  ]);
  return { profile, logs };
}

/**
 * CONCERN: History pagination is partially implemented.
 * The initial SSR render is capped at 200 rows over a 60-day rolling window via
 * `getServerLogsPage`. The `nextCursor` is passed to `HistoryClient` so it can
 * be threaded into a future "load more" / infinite-scroll flow, but that client-
 * side wiring is not in C1's scope. Full unbounded history requires a follow-up
 * task to add a paginated fetch action and load-more UI in HistoryClient.
 */
export async function getHistoryPageData() {
  const fromDate = daysAgoIst(60);
  const [profile, { logs, nextCursor }] = await Promise.all([
    getServerProfile(),
    getServerLogsPage({ fromDate, limit: SERVER_LOGS_PAGE_SIZE }),
  ]);
  return { profile, logs, nextCursor };
}

// ---------------------------------------------------------------------------
// Daily summary (F1a: Trends Year view egress fix)
// ---------------------------------------------------------------------------

export type DailySummary = {
  localDate: string;       // YYYY-MM-DD
  sticks: number;
  totalSpendInr: number;   // numeric from Postgres → coerced via Number()
  avgUnitPriceInr: number | null;
};

/**
 * Fetches per-day aggregates via the `get_daily_summary` RPC.
 *
 * Auth + row-level isolation are enforced by the RPC's auth.uid() check and the
 * SECURITY DEFINER wrapper. The underlying view is SECURITY INVOKER, so RLS on
 * cigarette_logs applies automatically.
 *
 * Date params use `from`/`to` (matching RPC param names p_from/p_to).
 */
export const getServerDailySummary = cache(
  async (opts: { from: string; to: string }): Promise<DailySummary[]> => {
    const supabase = createClient();
    const { data, error } = await supabase.rpc('get_daily_summary', {
      p_from: opts.from,
      p_to: opts.to,
    });
    if (error) throw new Error(error.message);
    return ((data ?? []) as Array<Record<string, unknown>>).map((r) => ({
      localDate: String(r.local_date),
      sticks: Number(r.sticks),
      // Postgres `numeric` is returned as a string by supabase-js (like baseline_per_day).
      // Always coerce via Number() — mirrors the C4 fix pattern.
      totalSpendInr: Number(r.total_spend_inr),
      avgUnitPriceInr: r.avg_unit_price_inr != null ? Number(r.avg_unit_price_inr) : null,
    }));
  },
);

/**
 * RESOLVED (F1a): Trends data now fetches both:
 *   - 90 days of raw logs (200-row cap) for hour/dow/brand/mood charts
 *   - 365 days of daily summaries via get_daily_summary RPC for the sticks/spend time series
 *
 * The Year view sticks+spend charts are now accurate over a full rolling year.
 * Other charts (hour, dow, brand mix, mood-trigger matrix, heatmap) still use
 * 90-day raw logs — tracked as F1 follow-on: full-Year breakdowns.
 */
export async function getTrendsPageData() {
  const fromDate90 = daysAgoIst(90);
  const fromDate365 = daysAgoIst(365);
  const today = daysAgoIst(0);
  const [profile, logs, dailySummary] = await Promise.all([
    getServerProfile(),
    getServerLogs({ fromDate: fromDate90 }),    // raw logs, 90-day capped at 200 — for hour/dow/brand/mood charts
    getServerDailySummary({ from: fromDate365, to: today }),  // 365 daily rows — for sticks/spend time series
  ]);
  return { profile, logs, dailySummary };
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

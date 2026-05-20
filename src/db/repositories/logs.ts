// Repository for cigarette_logs via Supabase (RLS-enforced).

import type { CigaretteLog, PriceSource, PurchaseMode } from '@/types';
import { makeId } from '@/lib/id';
import { nowUtcIso, toLocalDate, toLocalHour } from '@/lib/date';
import {
  CigaretteLogPatchSchema,
  CigaretteLogSchema,
  IdSchema,
  YmdSchema,
  parseOrThrow,
} from '@/lib/validation';
import { getSupabase } from '@/lib/supabase';
import { requireUserId, mapDbError } from '@/db/repositories/_supabase';
import { AppError } from '@/lib/errors';

type Row = {
  id: string;
  user_id: string;
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
  client_op_id?: string | null;
};

function rowToLog(r: Row): CigaretteLog {
  return {
    id: r.id,
    tsUtc: r.ts_utc,
    localDate: r.local_date,
    localHour: r.local_hour,
    brandId: r.brand_id,
    brandNameSnap: r.brand_name_snap,
    variantSnap: r.variant_snap,
    quantity: r.quantity,
    purchaseMode: r.purchase_mode,
    packSize: r.pack_size,
    totalPriceInr: r.total_price_inr != null ? Number(r.total_price_inr) : null,
    unitPriceInr: r.unit_price_inr != null ? Number(r.unit_price_inr) : null,
    priceSource: r.price_source,
    triggerTag: (r.trigger_tag as CigaretteLog['triggerTag']) ?? null,
    moodBefore: (r.mood_before as CigaretteLog['moodBefore']) ?? null,
    moodAfter: (r.mood_after as CigaretteLog['moodAfter']) ?? null,
    craving: r.craving,
    contextTag: (r.context_tag as CigaretteLog['contextTag']) ?? null,
    notes: r.notes,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export type LogDraft = Omit<
  CigaretteLog,
  'id' | 'createdAt' | 'updatedAt' | 'localDate' | 'localHour'
> & {
  localDate?: string;
  localHour?: number;
  /**
   * Optional client-generated idempotency key. The atomic create RPC will
   * return the original row if a key collision occurs. Required for retries
   * to be safe against duplicate inserts on flaky networks.
   */
  clientOpId?: string;
};

export const MAX_LIST_LOGS = 5_000;

export async function createLog(draft: LogDraft): Promise<CigaretteLog> {
  const supabase = getSupabase();
  const id = makeId('log');
  const localDate = draft.localDate ?? toLocalDate(draft.tsUtc);
  const localHour = draft.localHour ?? toLocalHour(draft.tsUtc);
  const validated = parseOrThrow(
    CigaretteLogSchema,
    { ...draft, localDate, localHour },
    'cigarette_log',
  );
  const clientOpId = draft.clientOpId ?? makeId('op');

  const { data, error } = await supabase.rpc('create_log_with_rate_limit', {
    p_id: id,
    p_ts_utc: validated.tsUtc,
    p_local_date: validated.localDate ?? localDate,
    p_local_hour: validated.localHour ?? localHour,
    p_brand_id: validated.brandId,
    p_brand_name_snap: validated.brandNameSnap,
    p_variant_snap: validated.variantSnap,
    p_quantity: validated.quantity,
    p_purchase_mode: validated.purchaseMode,
    p_pack_size: validated.packSize,
    p_total_price_inr: validated.totalPriceInr,
    p_unit_price_inr: validated.unitPriceInr,
    p_price_source: validated.priceSource,
    p_trigger_tag: validated.triggerTag,
    p_mood_before: validated.moodBefore,
    p_mood_after: validated.moodAfter,
    p_craving: validated.craving,
    p_context_tag: validated.contextTag,
    p_notes: validated.notes,
    p_client_op_id: clientOpId,
  });
  if (error) throw mapDbError(error);
  if (!data) throw new AppError('internal_error', 'log_insert_returned_no_row');
  return rowToLog(data as Row);
}

export async function updateLog(id: string, patch: Partial<CigaretteLog>): Promise<void> {
  parseOrThrow(IdSchema, id, 'log_id');
  const defined = Object.fromEntries(
    Object.entries(patch).filter(([, v]) => v !== undefined),
  ) as Partial<CigaretteLog>;
  if (!Object.keys(defined).length) return;
  const validated = parseOrThrow(CigaretteLogPatchSchema, defined, 'cigarette_log_patch');
  const supabase = getSupabase();
  const userId = await requireUserId();
  const row: Record<string, unknown> = { updated_at: nowUtcIso() };
  if (validated.tsUtc !== undefined) row.ts_utc = validated.tsUtc;
  if (validated.localDate !== undefined) row.local_date = validated.localDate;
  if (validated.localHour !== undefined) row.local_hour = validated.localHour;
  if (validated.brandId !== undefined) row.brand_id = validated.brandId;
  if (validated.brandNameSnap !== undefined) row.brand_name_snap = validated.brandNameSnap;
  if (validated.variantSnap !== undefined) row.variant_snap = validated.variantSnap;
  if (validated.quantity !== undefined) row.quantity = validated.quantity;
  if (validated.purchaseMode !== undefined) row.purchase_mode = validated.purchaseMode;
  if (validated.packSize !== undefined) row.pack_size = validated.packSize;
  if (validated.totalPriceInr !== undefined) row.total_price_inr = validated.totalPriceInr;
  if (validated.unitPriceInr !== undefined) row.unit_price_inr = validated.unitPriceInr;
  if (validated.priceSource !== undefined) row.price_source = validated.priceSource;
  if (validated.triggerTag !== undefined) row.trigger_tag = validated.triggerTag;
  if (validated.moodBefore !== undefined) row.mood_before = validated.moodBefore;
  if (validated.moodAfter !== undefined) row.mood_after = validated.moodAfter;
  if (validated.craving !== undefined) row.craving = validated.craving;
  if (validated.contextTag !== undefined) row.context_tag = validated.contextTag;
  if (validated.notes !== undefined) row.notes = validated.notes;
  if (Object.keys(row).length <= 1) return;
  const { error } = await supabase
    .from('cigarette_logs')
    .update(row)
    .eq('user_id', userId)
    .eq('id', id);
  if (error) throw mapDbError(error);
}

export async function deleteLog(id: string): Promise<void> {
  parseOrThrow(IdSchema, id, 'log_id');
  const supabase = getSupabase();
  const userId = await requireUserId();
  const { error } = await supabase
    .from('cigarette_logs')
    .delete()
    .eq('user_id', userId)
    .eq('id', id);
  if (error) throw mapDbError(error);
}

export async function getLog(id: string): Promise<CigaretteLog | null> {
  parseOrThrow(IdSchema, id, 'log_id');
  const supabase = getSupabase();
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from('cigarette_logs')
    .select('*')
    .eq('user_id', userId)
    .eq('id', id)
    .maybeSingle();
  if (error) throw mapDbError(error);
  return data ? rowToLog(data as Row) : null;
}

export async function listLogs(opts?: {
  fromDate?: string;
  toDate?: string;
  limit?: number;
  brandId?: string;
  triggerTag?: string;
}): Promise<CigaretteLog[]> {
  const supabase = getSupabase();
  const userId = await requireUserId();
  if (opts?.fromDate) parseOrThrow(YmdSchema, opts.fromDate, 'from_date');
  if (opts?.toDate) parseOrThrow(YmdSchema, opts.toDate, 'to_date');
  if (opts?.brandId) parseOrThrow(IdSchema, opts.brandId, 'brand_id');
  const limit = Math.max(1, Math.min(opts?.limit ?? MAX_LIST_LOGS, MAX_LIST_LOGS));
  let q = supabase.from('cigarette_logs').select('*').eq('user_id', userId);
  if (opts?.fromDate) q = q.gte('local_date', opts.fromDate);
  if (opts?.toDate) q = q.lte('local_date', opts.toDate);
  if (opts?.brandId) q = q.eq('brand_id', opts.brandId);
  if (opts?.triggerTag) q = q.eq('trigger_tag', opts.triggerTag);
  q = q.order('ts_utc', { ascending: false }).limit(limit);
  const { data, error } = await q;
  if (error) throw mapDbError(error);
  return (data as Row[]).map(rowToLog);
}

export async function getLastLog(): Promise<CigaretteLog | null> {
  const supabase = getSupabase();
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from('cigarette_logs')
    .select('*')
    .eq('user_id', userId)
    .order('ts_utc', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw mapDbError(error);
  return data ? rowToLog(data as Row) : null;
}

/**
 * Infer the per-stick price for a (brand, variant) by averaging recent logs.
 * The previous implementation used `.or(...)` interpolation that could be
 * abused with crafted strings; we now run two filtered queries and merge in
 * memory.
 */
export async function inferUnitPriceForVariant(
  variantSnap: string | null,
  brandId: string | null,
): Promise<number | null> {
  if (!variantSnap && !brandId) return null;
  const supabase = getSupabase();
  const userId = await requireUserId();

  const nums: number[] = [];

  if (variantSnap) {
    const { data, error } = await supabase
      .from('cigarette_logs')
      .select('unit_price_inr')
      .eq('user_id', userId)
      .eq('variant_snap', variantSnap)
      .not('unit_price_inr', 'is', null)
      .order('ts_utc', { ascending: false })
      .limit(20);
    if (error) throw mapDbError(error);
    for (const row of data ?? []) {
      const n = Number(row.unit_price_inr);
      if (Number.isFinite(n) && n >= 0) nums.push(n);
    }
  }

  if (brandId && nums.length < 20) {
    const { data, error } = await supabase
      .from('cigarette_logs')
      .select('unit_price_inr')
      .eq('user_id', userId)
      .eq('brand_id', brandId)
      .not('unit_price_inr', 'is', null)
      .order('ts_utc', { ascending: false })
      .limit(20);
    if (error) throw mapDbError(error);
    for (const row of data ?? []) {
      const n = Number(row.unit_price_inr);
      if (Number.isFinite(n) && n >= 0) nums.push(n);
      if (nums.length >= 20) break;
    }
  }

  if (!nums.length) return null;
  return Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 100) / 100;
}

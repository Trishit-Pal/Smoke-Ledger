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
import { logClientError } from '@/lib/logger';

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

/**
 * Shape returned by the `list_logs_page` RPC's `jsonb_build_object` — camelCase keys,
 * mirroring the SQL function in 20260521000000_audit_export_ops.sql (lines 431–451).
 * Do NOT use `Row` here: `.from('cigarette_logs').select('*')` returns snake_case columns,
 * but the RPC serialises each row through jsonb_build_object with explicit camelCase keys.
 */
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

function rpcRowToLog(r: RpcLogRow): CigaretteLog {
  return {
    id: r.id,
    tsUtc: r.tsUtc,
    localDate: r.localDate,
    localHour: r.localHour,
    brandId: r.brandId,
    brandNameSnap: r.brandNameSnap,
    variantSnap: r.variantSnap,
    quantity: r.quantity,
    purchaseMode: r.purchaseMode as CigaretteLog['purchaseMode'],
    packSize: r.packSize,
    totalPriceInr: r.totalPriceInr != null ? Number(r.totalPriceInr) : null,
    unitPriceInr: r.unitPriceInr != null ? Number(r.unitPriceInr) : null,
    priceSource: r.priceSource as CigaretteLog['priceSource'],
    triggerTag: (r.triggerTag as CigaretteLog['triggerTag']) ?? null,
    moodBefore: (r.moodBefore as CigaretteLog['moodBefore']) ?? null,
    moodAfter: (r.moodAfter as CigaretteLog['moodAfter']) ?? null,
    craving: r.craving,
    contextTag: (r.contextTag as CigaretteLog['contextTag']) ?? null,
    notes: r.notes,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

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
  /** IANA zone for local_date / local_hour. Defaults to IST. */
  timeZone?: string;
};

export const MAX_LIST_LOGS = 5_000;
/** Default page size for the legacy `listLogs` helper — triggers a warning when hit. */
export const PAGE_SIZE_DEFAULT = 200;

export interface LogCursor {
  ts: string;
  id: string;
}

export interface ListLogsPageOpts {
  fromDate?: string;
  toDate?: string;
  brandId?: string;
  triggerTag?: string;
  cursor?: LogCursor | null;
  limit?: number;
}

export interface LogPage {
  logs: CigaretteLog[];
  nextCursor: LogCursor | null;
}

/**
 * Keyset-paginated log listing. Callers that need the full history window
 * should loop over pages via `nextCursor`.
 */
export async function listLogsPage(opts?: ListLogsPageOpts): Promise<LogPage> {
  const supabase = getSupabase();
  const userId = await requireUserId();
  if (opts?.fromDate) parseOrThrow(YmdSchema, opts.fromDate, 'from_date');
  if (opts?.toDate) parseOrThrow(YmdSchema, opts.toDate, 'to_date');
  if (opts?.brandId) parseOrThrow(IdSchema, opts.brandId, 'brand_id');
  const limit = Math.max(1, Math.min(opts?.limit ?? PAGE_SIZE_DEFAULT, MAX_LIST_LOGS));

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
  if (error) throw mapDbError(error);

  const payload = data as {
    logs: RpcLogRow[];
    nextCursorTs: string | null;
    nextCursorId: string | null;
    hasMore: boolean;
  };

  const logs = (Array.isArray(payload.logs) ? payload.logs : []).map(rpcRowToLog);
  const nextCursor =
    payload.hasMore && payload.nextCursorTs && payload.nextCursorId
      ? { ts: payload.nextCursorTs, id: payload.nextCursorId }
      : null;

  return { logs, nextCursor };
}

export async function createLog(draft: LogDraft): Promise<CigaretteLog> {
  const supabase = getSupabase();
  // Brand is mandatory for every log (price/amount stays optional). The UI
  // disables logging until a brand is chosen; this is the defense-in-depth
  // guard so no entry point can persist a brand-less log.
  if (!draft.brandId) {
    throw new AppError('validation_error', 'A cigarette brand is required to log.');
  }
  const { timeZone, clientOpId: suppliedOpId, ...fields } = draft;
  const id = makeId('log');
  const localDate = fields.localDate ?? toLocalDate(fields.tsUtc, timeZone);
  const localHour = fields.localHour ?? toLocalHour(fields.tsUtc, timeZone);
  // CigaretteLogSchema applies the 24h backdate cap as a refinement — see
  // MAX_BACKDATE_MS in src/lib/validation.ts. This parse runs in the client
  // Supabase context, so the cap is a client-side guard (RLS scopes any forged
  // ts_utc to the caller's own rows), not a DB-enforced constraint. The
  // rate-limit RPC counts its window off server-set created_at, not the
  // now-backdatable ts_utc, so backdating can't evade it.
  // timeZone and clientOpId are transport fields. The strict schema rejects them.
  const validated = parseOrThrow(
    CigaretteLogSchema,
    { ...fields, localDate, localHour },
    'cigarette_log',
  );
  const clientOpId = suppliedOpId ?? makeId('op');

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

/**
 * Legacy list helper — returns a flat array for callers that don't need
 * pagination. Defaults to `PAGE_SIZE_DEFAULT` rows and emits a warning via
 * `logClientError` when the result is capped, signalling that the caller
 * should migrate to `listLogsPage`.
 */
export async function listLogs(opts?: {
  fromDate?: string;
  toDate?: string;
  limit?: number;
  brandId?: string;
  triggerTag?: string;
}): Promise<CigaretteLog[]> {
  const limit = Math.max(1, Math.min(opts?.limit ?? PAGE_SIZE_DEFAULT, PAGE_SIZE_DEFAULT));
  const { logs, nextCursor } = await listLogsPage({
    fromDate: opts?.fromDate,
    toDate: opts?.toDate,
    brandId: opts?.brandId,
    triggerTag: opts?.triggerTag,
    limit,
  });

  if (nextCursor !== null) {
    void logClientError(
      `listLogs hit the page cap (${limit} rows). Switch to listLogsPage for full history.`,
      { category: 'listLogs.pagination_hint' },
    );
  }

  return logs;
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

  if (!nums.length) {
    const catalogUnit = await inferUnitPriceFromCatalog(variantSnap, brandId);
    if (catalogUnit != null) return catalogUnit;
    return null;
  }
  return Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 100) / 100;
}

async function inferUnitPriceFromCatalog(
  variantSnap: string | null,
  brandId: string | null,
): Promise<number | null> {
  if (!brandId || !variantSnap) return null;
  const supabase = getSupabase();
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from('brand_variants')
    .select('avg_price_inr, default_pack_size, price_count')
    .eq('user_id', userId)
    .eq('brand_id', brandId)
    .eq('name', variantSnap)
    .maybeSingle();
  if (error) throw mapDbError(error);
  if (!data?.avg_price_inr || !data.default_pack_size) return null;
  const packOrUnit = Number(data.avg_price_inr);
  const packSize = Number(data.default_pack_size);
  if (!Number.isFinite(packOrUnit) || packSize <= 0) return null;
  const unit =
    Number(data.price_count) > 0 ? packOrUnit : packOrUnit / packSize;
  return Math.round(unit * 100) / 100;
}

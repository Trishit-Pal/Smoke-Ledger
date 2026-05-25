// Repository for the `get_daily_summary` Postgres RPC.
// Used by the Trends Year window to fetch accurate full-year daily aggregates
// without pulling raw logs (which are capped at 90 days in the session store).

import { getSupabase } from '@/lib/supabase';
import { requireUserId, mapDbError } from '@/db/repositories/_supabase';
import { YmdSchema, parseOrThrow } from '@/lib/validation';

export type DailySummaryRow = {
  /** YYYY-MM-DD in IST */
  localDate: string;
  sticks: number;
  /** Total INR spend on this day */
  totalSpendInr: number;
  /** Average per-stick price (may be null when no priced logs exist) */
  avgUnitPriceInr: number | null;
};

/**
 * Fetches per-day aggregates from the `get_daily_summary` RPC for the given
 * inclusive date range (YYYY-MM-DD).
 *
 * RLS is enforced inside the RPC via auth.uid() — the caller must be authenticated.
 * Postgres `numeric` columns are returned as strings by supabase-js and are
 * explicitly coerced via Number().
 */
export async function getDailySummary(from: string, to: string): Promise<DailySummaryRow[]> {
  parseOrThrow(YmdSchema, from, 'from');
  parseOrThrow(YmdSchema, to, 'to');

  // requireUserId ensures the call is authenticated and throws AppError if not.
  await requireUserId();

  const supabase = getSupabase();
  const { data, error } = await supabase.rpc('get_daily_summary', {
    p_from: from,
    p_to: to,
  });
  if (error) throw mapDbError(error);

  return ((data ?? []) as Array<Record<string, unknown>>).map((r) => ({
    localDate: String(r.local_date),
    sticks: Number(r.sticks),
    totalSpendInr: Number(r.total_spend_inr),
    avgUnitPriceInr: r.avg_unit_price_inr != null ? Number(r.avg_unit_price_inr) : null,
  }));
}

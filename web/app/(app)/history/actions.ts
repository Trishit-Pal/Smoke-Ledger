'use server';

import { daysAgoIst } from '@/lib/date';
import type { CigaretteLog } from '@/types';
import { getServerLogsPage, type LogCursor } from '@web/lib/server/data';

export type FetchMoreHistoryResult = {
  logs: CigaretteLog[];
  nextCursor: LogCursor | null;
};

/**
 * Server action: fetch the next page of history logs using the keyset cursor.
 *
 * Window: same 60-day fromDate as the initial SSR fetch (`getHistoryPageData`)
 * so consecutive page boundaries are consistent and a "Load older" click can't
 * suddenly pull rows outside the original window. To extend the window beyond
 * 60 days, ship a date-range filter UI — out of F1b scope.
 *
 * The RPC underneath enforces auth and per-user RLS via `list_logs_page`'s
 * `auth.uid()` check (SECURITY DEFINER). The action does not need an explicit
 * user-id parameter.
 */
export async function fetchMoreHistoryLogs(cursor: LogCursor): Promise<FetchMoreHistoryResult> {
  const fromDate = daysAgoIst(60);
  return getServerLogsPage({ fromDate, cursor });
}

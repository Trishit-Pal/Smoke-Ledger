'use server';

import type { CigaretteLog } from '@/types';
import { getServerLogsPage, type LogCursor } from '@web/lib/server/data';

export type FetchMoreHistoryResult = {
  logs: CigaretteLog[];
  nextCursor: LogCursor | null;
};

/**
 * Next History page. Same unbounded window as getHistoryPageData (no fromDate).
 * list_logs_page enforces auth.uid(); no user-id argument.
 */
export async function fetchMoreHistoryLogs(cursor: LogCursor): Promise<FetchMoreHistoryResult> {
  return getServerLogsPage({ cursor });
}

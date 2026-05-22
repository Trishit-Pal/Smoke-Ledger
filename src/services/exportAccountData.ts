import { getSupabase } from '@/lib/supabase';
import { AppError } from '@/lib/errors';

export interface AccountExportPayload {
  version: number;
  exportedAt: string;
  /**
   * True when the export loop exited because the safety cap (MAX_EXPORT_PAGES)
   * was reached before all records were fetched. False when the RPC signalled
   * that no more pages remain. Callers should surface a warning to the user
   * when this is true so they know the file may be incomplete.
   */
  truncated: boolean;
  logs?: unknown[];
  [key: string]: unknown;
}

const MAX_EXPORT_PAGES = 200;
const PAGE_SIZE = 5000;

/**
 * Fetches the user's data export via the bounded RPC. Paginates log rows
 * until all are retrieved or the safety cap is hit.
 *
 * Check `payload.truncated` after a successful call: when true the returned
 * file covers only the most recent MAX_EXPORT_PAGES × PAGE_SIZE rows and
 * older history was omitted.
 */
export async function exportAccountData(): Promise<AccountExportPayload> {
  const supabase = getSupabase();
  let cursorTs: string | null = null;
  let cursorId: string | null = null;
  let merged: AccountExportPayload | null = null;
  let page = 0;
  let reachedNaturalEnd = false;

  while (page < MAX_EXPORT_PAGES) {
    const { data, error } = await supabase.rpc('export_account_data', {
      p_from: null,
      p_to: null,
      p_cursor_ts: cursorTs,
      p_cursor_id: cursorId,
      p_limit: PAGE_SIZE,
    });
    if (error) throw new AppError('dependency_failure', error.message);
    if (!data || typeof data !== 'object') {
      throw new AppError('internal_error', 'Unexpected export payload.');
    }
    const chunk = data as AccountExportPayload & {
      hasMore?: boolean;
      nextCursorTs?: string | null;
      nextCursorId?: string | null;
    };
    if (!chunk.version || !chunk.exportedAt) {
      throw new AppError('internal_error', 'Export payload is missing required metadata.');
    }

    if (!merged) {
      merged = { ...chunk, logs: Array.isArray(chunk.logs) ? [...chunk.logs] : [] };
    } else {
      const nextLogs = Array.isArray(chunk.logs) ? chunk.logs : [];
      merged.logs = [...(merged.logs ?? []), ...nextLogs];
    }

    if (!chunk.hasMore || !chunk.nextCursorTs || !chunk.nextCursorId) {
      // RPC signals no more pages — this is a genuine, complete export.
      reachedNaturalEnd = true;
      break;
    }
    cursorTs = chunk.nextCursorTs;
    cursorId = chunk.nextCursorId;
    page += 1;
  }

  if (!merged) {
    throw new AppError('internal_error', 'Export returned no data.');
  }

  // Override any `truncated` field that may have come from the RPC chunk with
  // the authoritative value derived from how the loop exited.
  merged.truncated = !reachedNaturalEnd;
  return merged;
}

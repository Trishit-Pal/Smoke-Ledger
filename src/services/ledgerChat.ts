// Ask the ledger on mobile: a thin client for the web route (GET state, POST
// question) with the Supabase session as Bearer, plus the opt-in switch.
// It never logs, stores or forwards the question or the answer anywhere else.

import { getSupabase } from '@/lib/supabase';
import { getSetting, setSetting } from '@/db/repositories/settings';
import { recordAuditEvent } from '@/services/audit';
import { LEGAL_VERSIONS } from '@/lib/legal';
import {
  CHAT_HISTORY_MAX_TURNS,
  CHAT_HISTORY_TEXT_MAX,
  type ChatErrorCode,
  type ChatHistoryTurn,
  type ChatResponse,
  type ChatStateResponse,
} from '@/domain/ledgerChat/types';
import { LEDGER_CHAT_NOTICE_VERSION, chatOptInValue, isCurrentChatOptIn } from '@/domain/ledgerChat/notice';

export const LEDGER_CHAT_OPT_IN_KEY = 'consent.ledgerChatOptIn';

/** The server's own turn budget is 25s; give it a little longer, then fail calmly. */
const REQUEST_TIMEOUT_MS = 30_000;
const DEFAULT_WEB_BASE_URL = 'https://smokeledger.app';

/**
 * The web origin the route lives on. Unset falls back to production (as legal.ts
 * does); set but blank is a misconfiguration, so it yields null rather than a
 * relative URL that fetch would reject as a "network" problem.
 */
export function resolveWebBaseUrl(raw: string | undefined): string | null {
  if (raw === undefined) return DEFAULT_WEB_BASE_URL;
  return raw.trim().replace(/\/+$/, '') || null;
}

export type ChatFailure =
  | 'disabled'
  | 'signed_out'
  | 'consent_required'
  | 'consent_outdated'
  | 'rate_limited'
  | 'unavailable'
  | 'network';

export type ChatResult<T> = { ok: true; data: T } | { ok: false; reason: ChatFailure };

/** One finished exchange, held in screen state only. */
export interface ChatTurn {
  question: string;
  answer: string;
}

/** The last few exchanges as alternating turns, the same shape and limit the web panel sends. */
export function historyFor(turns: readonly ChatTurn[]): ChatHistoryTurn[] {
  return turns.slice(-Math.floor(CHAT_HISTORY_MAX_TURNS / 2)).flatMap((t): ChatHistoryTurn[] => [
    { role: 'user', text: t.question.slice(0, CHAT_HISTORY_TEXT_MAX) },
    { role: 'assistant', text: t.answer.slice(0, CHAT_HISTORY_TEXT_MAX) },
  ]);
}

/** One mapping from the route's refusals to what the screen says. */
function failureFor(status: number, error: ChatErrorCode | undefined): ChatFailure {
  if (status === 503 || error === 'feature_disabled') return 'disabled';
  if (status === 401 || error === 'unauthorized') return 'signed_out';
  if (error === 'consent_required') return 'consent_required';
  if (error === 'consent_outdated') return 'consent_outdated';
  if (status === 429 || error === 'rate_limited') return 'rate_limited';
  return 'unavailable';
}

async function request<T>(
  init: { method: 'GET' } | { method: 'POST'; body: unknown },
  isValid: (body: unknown) => body is T,
): Promise<ChatResult<T>> {
  const base = resolveWebBaseUrl(process.env.EXPO_PUBLIC_WEB_BASE_URL);
  if (base === null) return { ok: false, reason: 'unavailable' };
  const { data } = await getSupabase().auth.getSession();
  const token = data.session?.access_token;
  if (!token) return { ok: false, reason: 'signed_out' };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(`${base}/api/ledger-chat`, {
      method: init.method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(init.method === 'POST' ? { 'Content-Type': 'application/json' } : {}),
      },
      body: init.method === 'POST' ? JSON.stringify(init.body) : undefined,
      signal: controller.signal,
    });
    const body: unknown = await res.json().catch(() => null);
    if (res.ok) return isValid(body) ? { ok: true, data: body } : { ok: false, reason: 'unavailable' };
    const code = (body as { error?: ChatErrorCode } | null)?.error;
    return { ok: false, reason: failureFor(res.status, code) };
  } catch {
    // Offline, timed out or aborted. Nothing about the request is kept or logged.
    return { ok: false, reason: 'network' };
  } finally {
    clearTimeout(timer);
  }
}

const isState = (b: unknown): b is ChatStateResponse =>
  !!b && typeof b === 'object' && typeof (b as ChatStateResponse).consented === 'boolean' && Array.isArray((b as ChatStateResponse).starters);

const isAnswer = (b: unknown): b is ChatResponse =>
  !!b && typeof b === 'object' && typeof (b as ChatResponse).answer === 'string' && Array.isArray((b as ChatResponse).rows);

export function getChatState(): Promise<ChatResult<ChatStateResponse>> {
  return request({ method: 'GET' }, isState);
}

export function askLedger(question: string, history: readonly ChatHistoryTurn[]): Promise<ChatResult<ChatResponse>> {
  return request({ method: 'POST', body: { question, history } }, isAnswer);
}

/** On only for the current notice version; the stored value is a version string or false. */
export async function readLedgerChatOptIn(): Promise<boolean> {
  return isCurrentChatOptIn(await getSetting<unknown>(LEDGER_CHAT_OPT_IN_KEY));
}

/**
 * Save the opt-in, then record it. A failed save throws (the switch must not
 * claim a state that was not stored); a failed audit row never blocks, since the
 * consent itself is already saved and the edge allowlist can lag a deploy.
 */
export async function setLedgerChatOptIn(enabled: boolean): Promise<void> {
  await setSetting(LEDGER_CHAT_OPT_IN_KEY, chatOptInValue(enabled));
  try {
    await recordAuditEvent('ledger_chat_consent_toggled', 'privacy', {
      enabled,
      privacyVersion: LEGAL_VERSIONS.privacy,
      noticeVersion: LEDGER_CHAT_NOTICE_VERSION,
    });
  } catch {
    // Best effort, as on web.
  }
}

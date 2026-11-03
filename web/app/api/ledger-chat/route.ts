import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { buildToolContext } from '@/domain/ledgerChat/context';
import { chatRequestSchema, type ChatErrorCode, type ChatResponse } from '@/domain/ledgerChat/types';
import { hasRequiredConsents, isOnboarded } from '@/lib/compliance';
import { daysAgoInZone, todayInZone } from '@/lib/date';
import { timezoneForCountry } from '@/lib/regions';
import { checkRateLimits } from '@web/lib/auth/rateLimit';
import { serverLog } from '@web/lib/log';
import { resolveChatCaller } from '@web/lib/server/ledgerChat/auth';
import { isLedgerChatEnabled } from '@web/lib/server/ledgerChat/enabled';
import { runLedgerChatTurn } from '@web/lib/server/ledgerChat/turn';
import {
  GOAL_WINDOW_LOG_LIMIT,
  loadDailySummary,
  loadGoals,
  loadLogsPage,
  loadProfile,
  toDailySummaryRow,
} from '@web/lib/server/data';
import { cleanEnvValue } from '@web/lib/supabase/env';

// Two model calls plus four parallel reads fit well inside this; Hobby allows 300s.
export const maxDuration = 30;
// Production Supabase is in AWS us-east-2 (Ohio); cle1 (Cleveland) is the Vercel
// region next to it, so the tool queries stay in-region.
export const preferredRegion = 'cle1';
export const dynamic = 'force-dynamic';

const CONSENT_KEY = 'consent.ledgerChatOptIn';
const DEFAULT_MODEL = 'claude-haiku-5-5';
const DEFAULT_USER_CAP = 20;
const DEFAULT_GLOBAL_CAP = 500;
const DAY_SECONDS = 86_400;
/** Same windows the screens load, so tool figures equal screen figures. */
const LOG_WINDOW_DAYS = 90;
const SUMMARY_WINDOW_DAYS = 365;
const UPSTREAM_TIMEOUT_MS = 20_000;
/** Whole-turn budget, inside maxDuration so a slow upstream yields a calm 502, not a platform 504. */
const TURN_BUDGET_MS = 25_000;

function fail(error: ChatErrorCode, status: number) {
  return NextResponse.json({ error }, { status });
}

function envInt(name: string, fallback: number): number {
  const n = Number(cleanEnvValue(process.env[name]));
  return Number.isInteger(n) && n > 0 ? n : fallback;
}

export async function POST(request: Request) {
  const startedAt = Date.now();
  try {
    if (!isLedgerChatEnabled()) return fail('feature_disabled', 503);
    const apiKey = cleanEnvValue(process.env.ANTHROPIC_API_KEY);
    if (!apiKey) return fail('server_misconfigured', 500);

    const resolved = await resolveChatCaller(request);
    if (!resolved.ok) return fail(resolved.error, resolved.status);
    const { userId, db } = resolved.caller;

    const parsed = chatRequestSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return fail('validation_error', 400);

    // Consent fails closed, and is checked before anything is loaded or sent.
    const { data: consent, error: consentError } = await db
      .from('settings_kv')
      .select('value_json')
      .eq('user_id', userId)
      .eq('key', CONSENT_KEY)
      .maybeSingle();
    if (consentError || consent?.value_json !== true) return fail('consent_required', 403);

    // The middleware carve-out skipped the age, consent and onboarded gates for
    // this route; re-apply them here, before a daily token is spent and before
    // any ledger data is loaded or sent.
    const profile = await loadProfile(db, userId);
    if (!profile) return fail('unauthorized', 401);
    if (!hasRequiredConsents(profile) || !isOnboarded(profile)) return fail('forbidden', 403);

    const allowed = await checkRateLimits([
      { kind: 'ledger_chat_user', key: userId, max: envInt('LEDGER_CHAT_DAILY_CAP_USER', DEFAULT_USER_CAP), windowSec: DAY_SECONDS },
      { kind: 'ledger_chat_global', key: 'all', max: envInt('LEDGER_CHAT_DAILY_CAP_GLOBAL', DEFAULT_GLOBAL_CAP), windowSec: DAY_SECONDS },
    ]);
    if (!allowed) return fail('rate_limited', 429);

    const zone = timezoneForCountry(profile.country);
    const today = todayInZone(zone);
    // Floor the summary at onboarding, exactly as the dashboard does.
    const yearAgo = daysAgoInZone(SUMMARY_WINDOW_DAYS, zone);
    const onboardYmd = profile.onboardedAt ? profile.onboardedAt.slice(0, 10) : null;
    const summarySinceYmd = onboardYmd && onboardYmd > yearAgo ? onboardYmd : yearAgo;

    // ponytail: one page of up to GOAL_WINDOW_LOG_LIMIT (2000) rows, like Home; the 90-day window
    // holds ~22 entries a day under that ceiling. recent_entries still hands the model only 200.
    const [logsPage, summary, goals] = await Promise.all([
      loadLogsPage(db, userId, { fromDate: daysAgoInZone(LOG_WINDOW_DAYS, zone), limit: GOAL_WINDOW_LOG_LIMIT }),
      loadDailySummary(db, { from: summarySinceYmd, to: today }),
      loadGoals(db, userId, { activeOnly: true }),
    ]);

    const ctx = buildToolContext({
      profile,
      logs: logsPage.logs,
      rows: summary.map(toDailySummaryRow),
      goals,
      today,
      summarySinceYmd,
    });

    const anthropic = new Anthropic({ apiKey, timeout: UPSTREAM_TIMEOUT_MS, maxRetries: 0 });
    const model = cleanEnvValue(process.env.LEDGER_CHAT_MODEL) || DEFAULT_MODEL;
    const result = await runLedgerChatTurn({
      anthropic,
      model,
      ctx,
      history: parsed.data.history,
      question: parsed.data.question,
      signal: AbortSignal.timeout(TURN_BUDGET_MS),
    });

    // Counts and names only: never the question, the answer, or who asked.
    serverLog('info', 'api.ledger_chat.turn', { tools: result.toolsUsed, ...result.usage, ms: Date.now() - startedAt });

    const body: ChatResponse = { answer: result.answer, rows: result.rows, toolsUsed: result.toolsUsed };
    return NextResponse.json(body);
  } catch (error) {
    if (error instanceof Anthropic.APIError) {
      serverLog('error', 'api.ledger_chat.upstream', { status: error.status, ms: Date.now() - startedAt });
      return fail('dependency_failure', 502);
    }
    serverLog('error', 'api.ledger_chat.failed', { name: error instanceof Error ? error.name : 'unknown' });
    return fail('internal_error', 500);
  }
}

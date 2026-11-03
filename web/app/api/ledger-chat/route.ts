import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import type { SupabaseClient } from '@supabase/supabase-js';
import { buildToolContext, type ToolContext } from '@/domain/ledgerChat/context';
import { starterQuestions } from '@/domain/ledgerChat/starters';
import {
  chatRequestSchema,
  type ChatErrorCode,
  type ChatResponse,
  type ChatStateResponse,
} from '@/domain/ledgerChat/types';
import { hasRequiredConsents, isOnboarded } from '@/lib/compliance';
import { consentsOutdated } from '@/lib/onboardingSteps';
import type { UserProfile } from '@/types';
import { daysAgoInZone, todayInZone } from '@/lib/date';
import { isHomeTotalsHidden } from '@/lib/discreet';
import { localeForCountry, timezoneForCountry } from '@/lib/regions';
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
/** Dock opens per reader per day; separate from the question cap. */
const DEFAULT_STATE_CAP = 120;
/** Enough recent entries for the starters' mood/trigger check. */
const STARTER_LOG_LIMIT = 200;
/** Bounds the one goals read (active + history). Generous so an old active goal is never cut;
 *  goal_history still hands the model at most 50. */
const CHAT_GOALS_READ_LIMIT = 200;
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
    if (!(await readChatOptIn(db, userId))) return fail('consent_required', 403);

    // The middleware carve-out skipped the age, consent and onboarded gates for
    // this route; re-apply them here, before a daily token is spent and before
    // any ledger data is loaded or sent.
    const gate = await gatedProfile(db, userId);
    if (!gate.ok) return gate.response;

    const allowed = await checkRateLimits([
      { kind: 'ledger_chat_user', key: userId, max: envInt('LEDGER_CHAT_DAILY_CAP_USER', DEFAULT_USER_CAP), windowSec: DAY_SECONDS },
      { kind: 'ledger_chat_global', key: 'all', max: envInt('LEDGER_CHAT_DAILY_CAP_GLOBAL', DEFAULT_GLOBAL_CAP), windowSec: DAY_SECONDS },
    ]);
    if (!allowed) return fail('rate_limited', 429);

    const ctx = await loadLedgerContext(db, userId, gate.profile);

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

/**
 * Panel state for the dock: opt-in, discreet, currency and starter questions.
 * Same flag, caller and profile gates as POST. It never calls the model, needs
 * no model key, and spends its own daily cap, never the question cap. Without
 * opt-in it reads only the profile; with it, only what the starters need.
 */
export async function GET(request: Request) {
  try {
    if (!isLedgerChatEnabled()) return fail('feature_disabled', 503);
    const resolved = await resolveChatCaller(request);
    if (!resolved.ok) return fail(resolved.error, resolved.status);
    const { userId, db } = resolved.caller;

    const allowed = await checkRateLimits([
      { kind: 'ledger_chat_state', key: userId, max: envInt('LEDGER_CHAT_DAILY_CAP_STATE', DEFAULT_STATE_CAP), windowSec: DAY_SECONDS },
    ]);
    if (!allowed) return fail('rate_limited', 429);

    const gate = await gatedProfile(db, userId);
    if (!gate.ok) return gate.response;
    const { profile } = gate;

    const state = {
      discreet: profile.discreetMode,
      hideTotals: isHomeTotalsHidden(profile),
      currency: profile.currency,
      locale: localeForCountry(profile.country),
    };
    if (!(await readChatOptIn(db, userId))) {
      const body: ChatStateResponse = { consented: false, ...state, starters: [] };
      return NextResponse.json(body);
    }

    const ctx = await loadLedgerContext(db, userId, profile, { forStarters: true });
    const body: ChatStateResponse = { consented: true, ...state, starters: starterQuestions(ctx).map((s) => s.text) };
    return NextResponse.json(body);
  } catch (error) {
    serverLog('error', 'api.ledger_chat.state_failed', { name: error instanceof Error ? error.name : 'unknown' });
    return fail('internal_error', 500);
  }
}

/** The reader's own opt-in switch; any read error counts as off. */
async function readChatOptIn(db: SupabaseClient, userId: string): Promise<boolean> {
  const { data, error } = await db
    .from('settings_kv')
    .select('value_json')
    .eq('user_id', userId)
    .eq('key', CONSENT_KEY)
    .maybeSingle();
  return !error && data?.value_json === true;
}

type ProfileGate = { ok: true; profile: UserProfile } | { ok: false; response: NextResponse };

/** Signed-up, consented on the current legal versions, and onboarded; or the refusal to send. */
async function gatedProfile(db: SupabaseClient, userId: string): Promise<ProfileGate> {
  const profile = await loadProfile(db, userId);
  if (!profile) return { ok: false, response: fail('unauthorized', 401) };
  if (!hasRequiredConsents(profile) || !isOnboarded(profile)) return { ok: false, response: fail('forbidden', 403) };
  // Fails closed on an old terms, privacy or medical version, or a missing
  // health-data consent: mobile's own gate has gaps, so the server holds the line.
  if (consentsOutdated(profile)) return { ok: false, response: fail('consent_outdated', 403) };
  return { ok: true, profile };
}

/**
 * The reader's own rows, loaded in parallel under RLS. A turn reads the full
 * windows; the starters (GET) need only the summary, active goals and a short
 * log page for the mood/trigger check, so they read no goal history.
 */
async function loadLedgerContext(
  db: SupabaseClient,
  userId: string,
  profile: UserProfile,
  { forStarters = false }: { forStarters?: boolean } = {},
): Promise<ToolContext> {
  const zone = timezoneForCountry(profile.country);
  const today = todayInZone(zone);
  // Floor the summary at onboarding, exactly as the dashboard does.
  const yearAgo = daysAgoInZone(SUMMARY_WINDOW_DAYS, zone);
  const onboardYmd = profile.onboardedAt ? profile.onboardedAt.slice(0, 10) : null;
  const summarySinceYmd = onboardYmd && onboardYmd > yearAgo ? onboardYmd : yearAgo;

  // ponytail: one page of up to GOAL_WINDOW_LOG_LIMIT (2000) rows, like Home; the 90-day window
  // holds ~22 entries a day under that ceiling. recent_entries still hands the model only 200.
  // A turn's one goals read serves both goal_status (active) and goal_history (all).
  const [logsPage, summary, goals] = await Promise.all([
    loadLogsPage(db, userId, {
      fromDate: daysAgoInZone(LOG_WINDOW_DAYS, zone),
      limit: forStarters ? STARTER_LOG_LIMIT : GOAL_WINDOW_LOG_LIMIT,
    }),
    loadDailySummary(db, { from: summarySinceYmd, to: today }),
    loadGoals(db, userId, { activeOnly: forStarters, limit: CHAT_GOALS_READ_LIMIT }),
  ]);

  return buildToolContext({
    profile,
    logs: logsPage.logs,
    rows: summary.map(toDailySummaryRow),
    goals: goals.filter((g) => g.status === 'active'),
    goalHistory: forStarters ? [] : goals,
    today,
    summarySinceYmd,
  });
}

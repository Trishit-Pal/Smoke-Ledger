import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { APIUserAbortError } from '@anthropic-ai/sdk';
import type { UserProfile } from '@/types';

// Behaviour of the ledger-chat route itself: each gate, in order, with what it
// must NOT do when it refuses. The order pins in ledgerChatRouteGuard.test.ts
// say the checks exist; these say they hold. Every dependency is a factory mock
// (automocking would load data.ts, which pulls in next/cache); next/server and
// the Anthropic SDK are real.
vi.mock('@web/lib/server/ledgerChat/auth', () => ({ resolveChatCaller: vi.fn() }));
vi.mock('@web/lib/auth/rateLimit', () => ({ checkRateLimits: vi.fn() }));
vi.mock('@web/lib/server/data', () => ({
  loadProfile: vi.fn(),
  loadLogsPage: vi.fn(),
  loadDailySummary: vi.fn(),
  loadGoals: vi.fn(),
  toDailySummaryRow: vi.fn((d: { localDate: string; sticks: number; totalSpendInr: number; avgUnitPriceInr: number | null }) => ({
    date: d.localDate,
    sticks: d.sticks,
    spendInr: d.totalSpendInr,
    avgUnitPriceInr: d.avgUnitPriceInr,
  })),
}));
vi.mock('@web/lib/server/ledgerChat/turn', () => ({ runLedgerChatTurn: vi.fn() }));
vi.mock('@web/lib/log', () => ({ serverLog: vi.fn() }));

import { resolveChatCaller } from '@web/lib/server/ledgerChat/auth';
import { checkRateLimits } from '@web/lib/auth/rateLimit';
import { loadDailySummary, loadGoals, loadLogsPage, loadProfile } from '@web/lib/server/data';
import { runLedgerChatTurn } from '@web/lib/server/ledgerChat/turn';
import { serverLog } from '@web/lib/log';
import { POST } from '@web/app/api/ledger-chat/route';

const USER = 'user-1';
const QUESTION = 'How did the week of the quiet heron compare?';
const ANSWER = 'The heron week was quieter than the one before.';
const ROWS = [{ id: 'compare.week.current.sticks', label: 'This week', value: 8, unit: 'sticks' as const }];
const ONBOARDED_AT = new Date(Date.now() - 30 * 86_400_000).toISOString();
const ONBOARD_DAY = ONBOARDED_AT.slice(0, 10);

let consent: { data: { value_json: unknown } | null; error: { message: string } | null };
const query = {
  select: vi.fn(() => query),
  eq: vi.fn(() => query),
  maybeSingle: vi.fn(async () => consent),
};
const db = { from: vi.fn(() => query) };

function consentedProfile(over: Partial<UserProfile> = {}): UserProfile {
  return {
    baselinePerDay: 10,
    baselineWindowDays: 7,
    currency: 'INR',
    discreetMode: false,
    appLockEnabled: false,
    hideTotalsOnHome: false,
    onboardedAt: ONBOARDED_AT,
    ageConfirmedAt: ONBOARDED_AT,
    termsVersion: '2026-05-19',
    privacyVersion: '2026-11-02',
    healthDisclaimerVersion: '2026-05-19',
    dataProcessingConsentAt: ONBOARDED_AT,
    country: null,
    ...over,
  };
}

function post(body: string = JSON.stringify({ question: QUESTION, history: [] })): Promise<Response> {
  return POST(
    new Request('http://localhost/api/ledger-chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body,
    }),
  );
}

async function expectError(res: Response, status: number, error: string): Promise<void> {
  expect(res.status).toBe(status);
  expect(await res.json()).toEqual({ error });
}

function logged(): string {
  return JSON.stringify(vi.mocked(serverLog).mock.calls);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('LEDGER_CHAT_ENABLED', 'true');
  vi.stubEnv('ANTHROPIC_API_KEY', 'test-key');
  consent = { data: { value_json: true }, error: null };
  vi.mocked(resolveChatCaller).mockResolvedValue({ ok: true, caller: { userId: USER, db: db as never } });
  vi.mocked(loadProfile).mockResolvedValue(consentedProfile());
  vi.mocked(checkRateLimits).mockResolvedValue(true);
  vi.mocked(loadLogsPage).mockResolvedValue({ logs: [], nextCursor: null });
  vi.mocked(loadDailySummary).mockResolvedValue([]);
  vi.mocked(loadGoals).mockResolvedValue([]);
  vi.mocked(runLedgerChatTurn).mockResolvedValue({
    answer: ANSWER,
    rows: ROWS,
    toolsUsed: ['compare_periods'],
    usage: { inputTokens: 10, outputTokens: 5, cacheReadTokens: 0, modelCalls: 2, guardRetries: 0 },
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('POST /api/ledger-chat — gates', () => {
  test('feature off: 503, and the caller is never resolved', async () => {
    vi.stubEnv('LEDGER_CHAT_ENABLED', 'false');
    await expectError(await post(), 503, 'feature_disabled');
    expect(resolveChatCaller).not.toHaveBeenCalled();
  });

  test('no API key: 500, and the caller is never resolved', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', '');
    await expectError(await post(), 500, 'server_misconfigured');
    expect(resolveChatCaller).not.toHaveBeenCalled();
  });

  test('a refused caller passes its status through, and nothing is read', async () => {
    vi.mocked(resolveChatCaller).mockResolvedValue({ ok: false, status: 401, error: 'unauthorized' });
    await expectError(await post(), 401, 'unauthorized');
    expect(db.from).not.toHaveBeenCalled();
    expect(loadProfile).not.toHaveBeenCalled();
  });

  test('a body that is not the request shape: 400, and nothing is read', async () => {
    await expectError(await post('not json'), 400, 'validation_error');
    expect(db.from).not.toHaveBeenCalled();
    expect(loadProfile).not.toHaveBeenCalled();
  });

  test.each([
    ['no consent row', null],
    ['consent off', { value_json: false }],
    ['a string, not exactly true', { value_json: 'true' }],
  ])('%s: 403 consent_required, and nothing is loaded, spent, or sent', async (_name, row) => {
    consent = { data: row, error: null };
    await expectError(await post(), 403, 'consent_required');
    expect(loadProfile).not.toHaveBeenCalled();
    expect(checkRateLimits).not.toHaveBeenCalled();
    expect(runLedgerChatTurn).not.toHaveBeenCalled();
  });

  test('a consent read error fails closed: 403, and the profile is never loaded', async () => {
    consent = { data: null, error: { message: 'connection reset' } };
    await expectError(await post(), 403, 'consent_required');
    expect(loadProfile).not.toHaveBeenCalled();
  });

  test('missing onboarding data-processing consent: 403, and no daily allowance is spent', async () => {
    vi.mocked(loadProfile).mockResolvedValue(consentedProfile({ dataProcessingConsentAt: null }));
    await expectError(await post(), 403, 'forbidden');
    expect(checkRateLimits).not.toHaveBeenCalled();
  });

  test('not onboarded: 403, and no daily allowance is spent', async () => {
    vi.mocked(loadProfile).mockResolvedValue(consentedProfile({ onboardedAt: null }));
    await expectError(await post(), 403, 'forbidden');
    expect(checkRateLimits).not.toHaveBeenCalled();
  });

  test('daily limit reached: 429, and the ledger is never loaded or sent', async () => {
    vi.mocked(checkRateLimits).mockResolvedValue(false);
    await expectError(await post(), 429, 'rate_limited');
    expect(loadLogsPage).not.toHaveBeenCalled();
    expect(runLedgerChatTurn).not.toHaveBeenCalled();
  });
});

describe('POST /api/ledger-chat — answers and errors', () => {
  test('returns exactly the answer, rows, and tools, scoped to the caller and the screens\' windows', async () => {
    const res = await post();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ answer: ANSWER, rows: ROWS, toolsUsed: ['compare_periods'] });
    expect(db.from).toHaveBeenCalledWith('settings_kv');
    expect(query.eq).toHaveBeenCalledWith('user_id', USER);
    expect(query.eq).toHaveBeenCalledWith('key', 'consent.ledgerChatOptIn');
    expect(loadLogsPage).toHaveBeenCalledWith(db, USER, expect.objectContaining({ limit: 200 }));
    expect(loadDailySummary).toHaveBeenCalledWith(db, expect.objectContaining({ from: ONBOARD_DAY }));
    expect(runLedgerChatTurn).toHaveBeenCalledTimes(1);
    const input = vi.mocked(runLedgerChatTurn).mock.calls[0][0];
    expect(input.signal).toBeInstanceOf(AbortSignal);
    expect(input.ctx.summarySinceYmd).toBe(ONBOARD_DAY);
    expect(input.question).toBe(QUESTION);
  });

  test('an upstream abort or timeout: 502 dependency_failure', async () => {
    vi.mocked(runLedgerChatTurn).mockRejectedValue(new APIUserAbortError());
    await expectError(await post(), 502, 'dependency_failure');
  });

  test('any other failure: 500 internal_error', async () => {
    vi.mocked(runLedgerChatTurn).mockRejectedValue(new Error('boom'));
    await expectError(await post(), 500, 'internal_error');
  });

  test.each([
    ['an answer', () => undefined],
    ['an upstream failure', () => vi.mocked(runLedgerChatTurn).mockRejectedValue(new APIUserAbortError())],
    ['an internal failure', () => vi.mocked(runLedgerChatTurn).mockRejectedValue(new Error(QUESTION))],
  ])('logs never carry the question, the answer, or who asked (%s)', async (_name, arrange) => {
    arrange();
    await post();
    expect(vi.mocked(serverLog)).toHaveBeenCalled();
    expect(logged()).not.toContain(QUESTION);
    expect(logged()).not.toContain(ANSWER);
    expect(logged()).not.toContain(USER);
  });
});

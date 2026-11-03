import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { LEGAL_VERSIONS } from '@/lib/legal';
import type { UserProfile } from '@/types';

// Handler-level checks for the chat route with every I/O boundary mocked:
// the consent_outdated gate on POST, and the GET that serves panel state.
const mocks = vi.hoisted(() => ({
  enabled: vi.fn(() => true),
  resolveChatCaller: vi.fn(),
  loadProfile: vi.fn(),
  loadLogsPage: vi.fn(async () => ({ logs: [], nextCursor: null })),
  loadDailySummary: vi.fn(async () => [] as unknown[]),
  loadGoals: vi.fn(async () => [] as unknown[]),
  checkRateLimits: vi.fn(async () => true),
  runLedgerChatTurn: vi.fn(),
  consentValue: { value: true as unknown },
}));

vi.mock('@web/lib/server/ledgerChat/enabled', () => ({ isLedgerChatEnabled: mocks.enabled }));
vi.mock('@web/lib/server/ledgerChat/auth', () => ({ resolveChatCaller: mocks.resolveChatCaller }));
vi.mock('@web/lib/server/ledgerChat/turn', () => ({ runLedgerChatTurn: mocks.runLedgerChatTurn }));
vi.mock('@web/lib/auth/rateLimit', () => ({ checkRateLimits: mocks.checkRateLimits }));
vi.mock('@web/lib/log', () => ({ serverLog: vi.fn() }));
vi.mock('@web/lib/server/data', () => ({
  GOAL_WINDOW_LOG_LIMIT: 2000,
  loadProfile: mocks.loadProfile,
  loadLogsPage: mocks.loadLogsPage,
  loadDailySummary: mocks.loadDailySummary,
  loadGoals: mocks.loadGoals,
  toDailySummaryRow: (d: { localDate: string; sticks: number; totalSpendInr: number }) => ({
    date: d.localDate,
    sticks: d.sticks,
    spendInr: d.totalSpendInr,
    avgUnitPriceInr: null,
  }),
}));

const { GET, POST } = await import('@web/app/api/ledger-chat/route');

const current: UserProfile = {
  baselinePerDay: 10,
  baselineWindowDays: 7,
  currency: 'EUR',
  country: 'DE',
  discreetMode: true,
  appLockEnabled: false,
  hideTotalsOnHome: false,
  onboardedAt: '2026-01-01T00:00:00.000Z',
  ageConfirmedAt: '2026-01-01T00:00:00.000Z',
  termsVersion: LEGAL_VERSIONS.terms,
  privacyVersion: LEGAL_VERSIONS.privacy,
  healthDisclaimerVersion: LEGAL_VERSIONS.medicalDisclaimer,
  dataProcessingConsentAt: '2026-01-01T00:00:00.000Z',
  healthDataConsentAt: '2026-01-01T00:00:00.000Z',
};

function fakeDb() {
  const chain = {
    select: () => chain,
    eq: () => chain,
    maybeSingle: async () => ({ data: { value_json: mocks.consentValue.value }, error: null }),
  };
  return { from: () => chain };
}

function post(): Request {
  return new Request('http://localhost/api/ledger-chat', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: 'Bearer t' },
    body: JSON.stringify({ question: 'How did this week compare to last?' }),
  });
}

function get(): Request {
  return new Request('http://localhost/api/ledger-chat', { headers: { authorization: 'Bearer t' } });
}

beforeEach(() => {
  vi.stubEnv('ANTHROPIC_API_KEY', 'test-key');
  mocks.enabled.mockReturnValue(true);
  mocks.consentValue.value = true;
  mocks.resolveChatCaller.mockResolvedValue({ ok: true, caller: { userId: 'u1', db: fakeDb() } });
  mocks.loadProfile.mockResolvedValue(current);
  mocks.loadGoals.mockResolvedValue([]);
  mocks.loadDailySummary.mockResolvedValue([]);
  mocks.runLedgerChatTurn.mockResolvedValue({
    answer: 'Fewer than last week.',
    rows: [],
    toolsUsed: [],
    usage: { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, modelCalls: 1, guardRetries: 0 },
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe('POST /api/ledger-chat consent currency', () => {
  test('answers 403 consent_outdated for an old legal version, before any limit or model call', async () => {
    mocks.loadProfile.mockResolvedValue({ ...current, privacyVersion: '2026-05-19' });

    const res = await POST(post());

    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: 'consent_outdated' });
    expect(mocks.checkRateLimits).not.toHaveBeenCalled();
    expect(mocks.loadLogsPage).not.toHaveBeenCalled();
    expect(mocks.runLedgerChatTurn).not.toHaveBeenCalled();
  });

  test('answers 403 consent_outdated when the health-data consent is missing', async () => {
    mocks.loadProfile.mockResolvedValue({ ...current, healthDataConsentAt: null });

    const res = await POST(post());

    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: 'consent_outdated' });
  });

  test('a current reader still gets an answer', async () => {
    const res = await POST(post());

    expect(res.status).toBe(200);
    expect(mocks.runLedgerChatTurn).toHaveBeenCalledTimes(1);
  });
});

describe('ledger loads', () => {
  test('one goals read covers active goals and history, and no other table is read', async () => {
    const goal = { id: 'g', type: 'daily_cap', targetValue: 5, currentBaseline: null, startDate: '2026-01-01', endDate: null, meta: null, createdAt: '', completedAt: null };
    mocks.loadGoals.mockResolvedValue([
      { ...goal, id: 'a', status: 'active' },
      { ...goal, id: 'p', status: 'paused' },
    ]);

    await POST(post());

    expect(mocks.loadGoals).toHaveBeenCalledTimes(1);
    expect(mocks.loadGoals).toHaveBeenCalledWith(expect.anything(), 'u1', { activeOnly: false });
    const ctx = mocks.runLedgerChatTurn.mock.calls[0][0].ctx;
    expect(ctx.goals.map((g: { id: string }) => g.id)).toEqual(['a']);
    expect(ctx.goalHistory.map((g: { id: string }) => g.id)).toEqual(['a', 'p']);
  });
});

describe('GET /api/ledger-chat panel state', () => {
  test('is off with the flag, like POST', async () => {
    mocks.enabled.mockReturnValue(false);

    const res = await GET(get());

    expect(res.status).toBe(503);
    expect(mocks.resolveChatCaller).not.toHaveBeenCalled();
  });

  test('refuses an unresolved caller with its own status', async () => {
    mocks.resolveChatCaller.mockResolvedValue({ ok: false, status: 401, error: 'unauthorized' });

    const res = await GET(get());

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'unauthorized' });
  });

  test('opted in: returns state and starters from the summary, active goals and a short log read; no model', async () => {
    mocks.loadDailySummary.mockResolvedValue([{ localDate: '2026-06-21', sticks: 3, totalSpendInr: 60 }]);

    const res = await GET(get());

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      consented: true,
      discreet: true,
      currency: 'EUR',
      starters: ['What does my ledger say so far?'],
    });
    expect(mocks.loadGoals).toHaveBeenCalledWith(expect.anything(), 'u1', { activeOnly: true });
    const logOpts = (mocks.loadLogsPage.mock.calls[0] as unknown[])[2] as { limit: number };
    expect(logOpts.limit).toBeLessThanOrEqual(200);
    expect(mocks.runLedgerChatTurn).not.toHaveBeenCalled();
  });

  test('spends its own daily state cap, never the question cap', async () => {
    await GET(get());

    expect(mocks.checkRateLimits).toHaveBeenCalledTimes(1);
    expect(mocks.checkRateLimits).toHaveBeenCalledWith([
      { kind: 'ledger_chat_state', key: 'u1', max: 120, windowSec: 86_400 },
    ]);
  });

  test('over the state cap: 429 and no ledger reads', async () => {
    mocks.checkRateLimits.mockResolvedValueOnce(false);

    const res = await GET(get());

    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({ error: 'rate_limited' });
    expect(mocks.loadLogsPage).not.toHaveBeenCalled();
  });

  test('not opted in: consented false and no starters, after reading only the profile; no model key needed', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', '');
    mocks.consentValue.value = null;

    const res = await GET(get());

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ consented: false, discreet: true, currency: 'EUR', starters: [] });
    expect(mocks.loadProfile).toHaveBeenCalledTimes(1);
    for (const load of [mocks.loadLogsPage, mocks.loadDailySummary, mocks.loadGoals]) expect(load).not.toHaveBeenCalled();
  });

  test('applies the same profile gates as POST', async () => {
    mocks.loadProfile.mockResolvedValue({ ...current, termsVersion: '2025-01-01' });

    const res = await GET(get());

    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: 'consent_outdated' });
  });
});

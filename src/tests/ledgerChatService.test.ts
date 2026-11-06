import { getSupabase } from '@/lib/supabase';
import { getSetting, setSetting } from '@/db/repositories/settings';
import { recordAuditEvent } from '@/services/audit';
import { CHAT_HISTORY_MAX_TURNS, CHAT_HISTORY_TEXT_MAX } from '@/domain/ledgerChat/types';
import { LEDGER_CHAT_NOTICE_VERSION } from '@/domain/ledgerChat/notice';
import {
  askLedger,
  getChatState,
  historyFor,
  readLedgerChatOptIn,
  setLedgerChatOptIn,
  resolveWebBaseUrl,
  type ChatTurn,
} from '@/services/ledgerChat';

jest.mock('@/lib/supabase', () => ({ getSupabase: jest.fn() }));
jest.mock('@/db/repositories/settings', () => ({ getSetting: jest.fn(), setSetting: jest.fn() }));
jest.mock('@/services/audit', () => ({ recordAuditEvent: jest.fn() }));

const getSession = jest.fn();
const fetchMock = jest.fn();

function reply(status: number, body: unknown) {
  return Promise.resolve({ ok: status >= 200 && status < 300, status, json: () => Promise.resolve(body) });
}

const STATE = {
  consented: true,
  discreet: false,
  hideTotals: false,
  currency: 'INR',
  locale: 'en-IN',
  starters: ['How did this week compare?'],
};
const ANSWER = { answer: 'A calm week.', rows: [{ id: 'r1', label: 'Sticks', value: 4, unit: 'sticks' }], toolsUsed: ['week'] };

beforeEach(() => {
  jest.clearAllMocks();
  process.env.EXPO_PUBLIC_WEB_BASE_URL = 'https://example.test';
  getSession.mockResolvedValue({ data: { session: { access_token: 'tok-123' } } });
  (getSupabase as jest.Mock).mockReturnValue({ auth: { getSession } });
  (global as unknown as { fetch: jest.Mock }).fetch = fetchMock;
  fetchMock.mockReset();
});

describe('getChatState', () => {
  it('GETs the route with the Bearer token and returns the state', async () => {
    fetchMock.mockReturnValueOnce(reply(200, STATE));
    const result = await getChatState();
    expect(result).toEqual({ ok: true, data: STATE });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://example.test/api/ledger-chat');
    expect(init.method).toBe('GET');
    expect(init.headers.Authorization).toBe('Bearer tok-123');
  });

  it('reports signed_out without calling the network when there is no session', async () => {
    getSession.mockResolvedValueOnce({ data: { session: null } });
    expect(await getChatState()).toEqual({ ok: false, reason: 'signed_out' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('treats a malformed success body as unavailable', async () => {
    fetchMock.mockReturnValueOnce(reply(200, { nope: true }));
    expect(await getChatState()).toEqual({ ok: false, reason: 'unavailable' });
  });
});

describe('askLedger', () => {
  it('POSTs the question and history and returns the answer', async () => {
    fetchMock.mockReturnValueOnce(reply(200, ANSWER));
    const history = [{ role: 'user' as const, text: 'hi' }, { role: 'assistant' as const, text: 'hello' }];
    const result = await askLedger('And today?', history);
    expect(result).toEqual({ ok: true, data: ANSWER });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://example.test/api/ledger-chat');
    expect(init.method).toBe('POST');
    expect(init.headers['Content-Type']).toBe('application/json');
    expect(init.headers.Authorization).toBe('Bearer tok-123');
    expect(JSON.parse(init.body)).toEqual({ question: 'And today?', history });
  });

  it.each([
    [503, 'feature_disabled', 'disabled'],
    [401, 'unauthorized', 'signed_out'],
    [403, 'consent_required', 'consent_required'],
    [403, 'consent_outdated', 'consent_outdated'],
    [403, 'forbidden', 'unavailable'],
    [429, 'rate_limited', 'rate_limited'],
    [400, 'validation_error', 'unavailable'],
    [500, 'internal_error', 'unavailable'],
    [500, 'server_misconfigured', 'unavailable'],
    [502, 'dependency_failure', 'unavailable'],
  ])('maps %i %s to %s', async (status, error, reason) => {
    fetchMock.mockReturnValueOnce(reply(status, { error }));
    expect(await askLedger('q', [])).toEqual({ ok: false, reason });
  });

  it('maps a bare status when the body is not JSON', async () => {
    fetchMock.mockReturnValueOnce(
      Promise.resolve({ ok: false, status: 429, json: () => Promise.reject(new Error('bad json')) }),
    );
    expect(await askLedger('q', [])).toEqual({ ok: false, reason: 'rate_limited' });
  });

  it('maps a thrown fetch to network', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Network request failed'));
    expect(await askLedger('q', [])).toEqual({ ok: false, reason: 'network' });
  });

  it('never writes the question or the answer to the console', async () => {
    const spies = (['log', 'info', 'warn', 'error', 'debug'] as const).map((m) => jest.spyOn(console, m).mockImplementation());
    fetchMock.mockReturnValueOnce(reply(200, ANSWER));
    await askLedger('a private question', []);
    fetchMock.mockRejectedValueOnce(new Error('a private question'));
    await askLedger('a private question', []);
    for (const spy of spies) {
      expect(spy).not.toHaveBeenCalled();
      spy.mockRestore();
    }
  });
});

describe('base URL', () => {
  it('trims and strips trailing slashes', () => {
    expect(resolveWebBaseUrl('  https://example.test///  ')).toBe('https://example.test');
  });

  it('falls back to production only when unset', () => {
    expect(resolveWebBaseUrl(undefined)).toBe('https://smokeledger.fyi');
  });

  it('is null when set but blank', () => {
    expect(resolveWebBaseUrl('')).toBeNull();
    expect(resolveWebBaseUrl('   /  ')).toBeNull();
  });

  it('a trailing slash in the env never produces a double slash in the request', async () => {
    process.env.EXPO_PUBLIC_WEB_BASE_URL = 'https://example.test/';
    fetchMock.mockReturnValueOnce(reply(200, STATE));
    await getChatState();
    expect(fetchMock.mock.calls[0][0]).toBe('https://example.test/api/ledger-chat');
  });

  it('a blank env is unavailable and never calls fetch', async () => {
    process.env.EXPO_PUBLIC_WEB_BASE_URL = '';
    expect(await getChatState()).toEqual({ ok: false, reason: 'unavailable' });
    expect(await askLedger('q', [])).toEqual({ ok: false, reason: 'unavailable' });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('historyFor', () => {
  const turn = (i: number, extra = ''): ChatTurn => ({ question: `q${i}${extra}`, answer: `a${i}${extra}` });

  it('is empty for an empty transcript', () => {
    expect(historyFor([])).toEqual([]);
  });

  it('sends the last few exchanges as alternating user/assistant turns, up to the limit', () => {
    const turns = Array.from({ length: 9 }, (_, i) => turn(i));
    const history = historyFor(turns);
    expect(history).toHaveLength(CHAT_HISTORY_MAX_TURNS);
    expect(history[0]).toEqual({ role: 'user', text: 'q4' });
    expect(history[history.length - 1]).toEqual({ role: 'assistant', text: 'a8' });
    history.forEach((h, i) => expect(h.role).toBe(i % 2 === 0 ? 'user' : 'assistant'));
  });

  it('clips each turn to the history text limit', () => {
    const history = historyFor([turn(1, 'x'.repeat(CHAT_HISTORY_TEXT_MAX + 50))]);
    expect(history.every((h) => h.text.length <= CHAT_HISTORY_TEXT_MAX)).toBe(true);
  });
});

describe('ledger chat opt-in', () => {
  it('reads the settings_kv key; only the current notice version is on', async () => {
    (getSetting as jest.Mock).mockResolvedValueOnce(LEDGER_CHAT_NOTICE_VERSION);
    expect(await readLedgerChatOptIn()).toBe(true);
    expect(getSetting).toHaveBeenCalledWith('consent.ledgerChatOptIn');
    // A pre-versioning true, an older notice's version, off and unset all read as off.
    for (const stale of [true, '2026-11-02', false, null]) {
      (getSetting as jest.Mock).mockResolvedValueOnce(stale);
      expect(await readLedgerChatOptIn()).toBe(false);
    }
  });

  it.each([
    [true, LEDGER_CHAT_NOTICE_VERSION],
    [false, false],
  ])('set to %s: stores %s and writes the audit row with both versions', async (enabled, stored) => {
    await setLedgerChatOptIn(enabled);
    expect(setSetting).toHaveBeenCalledWith('consent.ledgerChatOptIn', stored);
    expect(recordAuditEvent).toHaveBeenCalledWith('ledger_chat_consent_toggled', 'privacy', {
      enabled,
      privacyVersion: expect.any(String),
      noticeVersion: LEDGER_CHAT_NOTICE_VERSION,
    });
  });

  it('saves the opt-in even when the audit row fails', async () => {
    (recordAuditEvent as jest.Mock).mockRejectedValueOnce(new Error('edge allowlist lag'));
    await expect(setLedgerChatOptIn(true)).resolves.toBeUndefined();
    expect(setSetting).toHaveBeenCalledWith('consent.ledgerChatOptIn', LEDGER_CHAT_NOTICE_VERSION);
  });

  it('does not swallow a failed settings write, and writes no audit row for it', async () => {
    (setSetting as jest.Mock).mockRejectedValueOnce(new Error('rls'));
    await expect(setLedgerChatOptIn(true)).rejects.toThrow('rls');
    expect(recordAuditEvent).not.toHaveBeenCalled();
  });
});

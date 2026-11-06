import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { LEDGER_CHAT_DISCLOSED_PROVIDERS, LEDGER_CHAT_NOTICE_TEXT } from '@/domain/ledgerChat/notice';

// The turn engine is replaced by a script that calls the client once, like the real one does, so the
// runner's guard around the client is exercised. Errors the script throws ITSELF stand in for our own bugs.
const mocks = vi.hoisted(() => ({ turn: vi.fn() }));
vi.mock('@web/lib/server/ledgerChat/turn', () => ({ runLedgerChatTurn: mocks.turn }));

import {
  attemptBudgetMs,
  ChatUpstreamError,
  hasUsableProvider,
  MIN_ATTEMPT_MS,
  runWithFallback,
  type ChatProvider,
} from '@web/lib/server/ledgerChat/fallback';
import { PROVIDERS } from '@web/lib/server/ledgerChat/providers';
import type { ChatModelClient } from '@web/lib/server/ledgerChat/turn';

const RESULT = { answer: 'ok', rows: [], toolsUsed: [], usage: { inputTokens: 1, outputTokens: 1, cacheReadTokens: 0, modelCalls: 1, guardRetries: 0 } };
const ctx = {} as never;

function client(create: () => Promise<unknown> = async () => ({})): ChatModelClient {
  return { messages: { create } } as unknown as ChatModelClient;
}

function provider(id: string, over: Partial<ChatProvider> & { create?: () => Promise<unknown> } = {}): ChatProvider & { made: number } {
  const p = {
    id,
    label: 'Groq',
    model: () => `${id}-model`,
    made: 0,
    client() {
      p.made += 1;
      return client(over.create);
    },
    ...over,
  };
  return p as ChatProvider & { made: number };
}

class UpstreamBoom extends Error {
  constructor(public status: number) {
    super('SECRET ledger text that must never be logged');
    this.name = 'RateLimitError';
  }
}

beforeEach(() => {
  mocks.turn.mockReset();
  // By default the turn calls the client once and succeeds with whatever the client returns.
  mocks.turn.mockImplementation(async (input: { anthropic: ChatModelClient }) => {
    await input.anthropic.messages.create({} as never);
    return RESULT;
  });
});

const input = (providers: readonly ChatProvider[], budgetMs = 25_000) => ({ providers, ctx, history: [], question: 'q', budgetMs });

describe('runWithFallback', () => {
  test('the first provider serves when it works, and the next one is never called', async () => {
    const a = provider('groq', { model: () => 'm1' });
    const bCreate = vi.fn(async () => ({}));
    const b = provider('groq', { model: () => 'm2', create: bCreate });
    const out = await runWithFallback(input([a, b]));
    expect(out.providerId).toBe('groq');
    expect(out.failed).toEqual([]);
    expect(bCreate).not.toHaveBeenCalled();
    expect(mocks.turn).toHaveBeenCalledTimes(1);
  });

  test('a provider failure restarts the whole turn on the next one', async () => {
    const a = provider('groq', { create: async () => { throw new UpstreamBoom(429); } });
    const b = provider('groq', { model: () => 'm2' });
    const out = await runWithFallback(input([a, b]));
    expect(out.providerId).toBe('groq');
    expect(out.failed).toEqual([{ providerId: 'groq', errorName: 'RateLimitError', status: 429 }]);
    expect(mocks.turn).toHaveBeenCalledTimes(2);
    expect(mocks.turn.mock.calls[1][0].model).toBe('m2');
  });

  test('an AI SDK error (statusCode, not status) still logs its HTTP status', async () => {
    const aiSdkError = Object.assign(new Error('SECRET body'), { name: 'AI_APICallError', statusCode: 429 });
    const a = provider('groq', { create: async () => { throw aiSdkError; } });
    const out = await runWithFallback(input([a, provider('groq', { model: () => 'm2' })]));
    expect(out.failed).toEqual([{ providerId: 'groq', errorName: 'AI_APICallError', status: 429 }]);
  });

  test('an error that is not from the model call is a bug, not an upstream failure: no failover', async () => {
    mocks.turn.mockRejectedValueOnce(new TypeError('our own bug'));
    const a = provider('groq', { model: () => 'm1' });
    const b = provider('groq', { model: () => 'm2' });
    await expect(runWithFallback(input([a, b]))).rejects.toThrow('our own bug');
    expect(mocks.turn).toHaveBeenCalledTimes(1);
  });

  test('every provider failing gives one calm error that carries no content', async () => {
    const boom = async () => { throw new UpstreamBoom(503); };
    const err = await runWithFallback(input([provider('groq', { model: () => 'm1', create: boom }), provider('groq', { model: () => 'm2', create: boom })])).catch((e) => e);
    expect(err).toBeInstanceOf(ChatUpstreamError);
    expect(err.failed.map((f: { providerId: string }) => f.providerId)).toEqual(['groq', 'groq']);
    expect(err.message).toBe('every model provider failed');
    expect(JSON.stringify(err.failed)).not.toContain('SECRET');
  });

  test('a provider with no key is skipped without an error', async () => {
    const noKey = provider('groq', { client: () => null });
    const b = provider('groq', { model: () => 'm2' });
    const out = await runWithFallback(input([noKey, b]));
    expect(out.providerId).toBe('groq');
    expect(out.failed).toEqual([]);
    expect(mocks.turn.mock.calls[0][0].model).toBe('m2');
  });

  test('a provider whose client() throws (a bad key, a broken adapter) is recorded and skipped, never a crash', async () => {
    const broken = provider('groq', {
      model: () => 'm1',
      client: () => {
        throw new TypeError('SECRET key format is wrong');
      },
    });
    const b = provider('groq', { model: () => 'm2' });
    const out = await runWithFallback(input([broken, b]));
    expect(out.providerId).toBe('groq');
    expect(out.failed).toEqual([{ providerId: 'groq', errorName: 'TypeError' }]);
    expect(JSON.stringify(out.failed)).not.toContain('SECRET');
    expect(mocks.turn.mock.calls[0][0].model).toBe('m2');
    expect(hasUsableProvider([broken])).toBe(false);
    expect(hasUsableProvider([broken, b])).toBe(true);
  });

  test('no usable provider is an upstream failure with nothing tried', async () => {
    const err = await runWithFallback(input([provider('groq', { client: () => null })])).catch((e) => e);
    expect(err).toBeInstanceOf(ChatUpstreamError);
    expect(err.failed).toEqual([]);
    expect(mocks.turn).not.toHaveBeenCalled();
  });

  test('a vendor the consent notice does not name is refused, and its client is never built', async () => {
    const mistral = provider('mistral', { label: 'Mistral' });
    const err = await runWithFallback(input([mistral])).catch((e) => e);
    expect(err).toBeInstanceOf(ChatUpstreamError);
    expect(mistral.made).toBe(0);
    expect(hasUsableProvider([mistral])).toBe(false);
  });

  test('a listed id whose label the notice does not contain is refused too', async () => {
    const odd = provider('groq', { label: 'Some Other Vendor' });
    expect(hasUsableProvider([odd])).toBe(false);
  });

  test('the total budget ends the run: a slow first provider is cut off and leaves nothing for a second', async () => {
    // The turn passes its attempt signal to the model call, as the real one does; the first client hangs until it fires.
    mocks.turn.mockImplementation(async (i: { signal?: AbortSignal; anthropic: ChatModelClient }) => {
      await (i.anthropic.messages.create as (p: unknown, o?: { signal?: AbortSignal }) => Promise<unknown>)({}, { signal: i.signal });
      return RESULT;
    });
    const hangs = (_p: unknown, o?: { signal?: AbortSignal }) =>
      new Promise((_, reject) => o?.signal?.addEventListener('abort', () => reject(new Error('timed out'))));
    const slow = provider('groq', { model: () => 'm1', create: hangs as never });
    const bCreate = vi.fn(async () => ({}));
    const b = provider('groq', { model: () => 'm2', create: bCreate });
    const err = await runWithFallback(input([slow, b], 40)).catch((e) => e);
    expect(err).toBeInstanceOf(ChatUpstreamError);
    expect(err.failed).toHaveLength(1);
    expect(bCreate).not.toHaveBeenCalled();
  });

  test('each attempt gets its own abort signal, slice-limited', async () => {
    const seen: AbortSignal[] = [];
    mocks.turn.mockImplementation(async (i: { signal?: AbortSignal; anthropic: ChatModelClient }) => {
      seen.push(i.signal as AbortSignal);
      await i.anthropic.messages.create({} as never);
      return RESULT;
    });
    const boom = async () => { throw new UpstreamBoom(500); };
    await runWithFallback(input([provider('groq', { model: () => 'm1', create: boom }), provider('groq', { model: () => 'm2' })]));
    expect(seen).toHaveLength(2);
    expect(seen[0]).not.toBe(seen[1]);
    expect(seen.every((s) => s instanceof AbortSignal)).toBe(true);
  });
});

describe('time slices count only providers that can actually run', () => {
  test('a later provider with no key does not shrink the first one: it gets the whole budget', async () => {
    const timeout = vi.spyOn(AbortSignal, 'timeout');
    try {
      await runWithFallback(input([provider('groq', { model: () => 'm1' }), provider('groq', { client: () => null })]));
      expect(timeout).toHaveBeenCalledTimes(1);
      expect(timeout.mock.calls[0][0]).toBeGreaterThan(24_000);
    } finally {
      timeout.mockRestore();
    }
  });

  test('two runnable providers still share the budget', async () => {
    const timeout = vi.spyOn(AbortSignal, 'timeout');
    try {
      const boom = async () => { throw new UpstreamBoom(503); };
      await runWithFallback(input([provider('groq', { model: () => 'm1', create: boom }), provider('groq', { model: () => 'm2' })]));
      expect(timeout.mock.calls[0][0]).toBeLessThanOrEqual(12_500);
    } finally {
      timeout.mockRestore();
    }
  });
});

describe('attemptBudgetMs', () => {
  test('one provider gets everything that is left', () => {
    expect(attemptBudgetMs(25_000, 1)).toBe(25_000);
  });
  test('the rest is shared out evenly, never below the floor', () => {
    expect(attemptBudgetMs(25_000, 2)).toBe(12_500);
    expect(attemptBudgetMs(25_000, 5)).toBe(MIN_ATTEMPT_MS);
  });
  test('never more than what is left', () => {
    expect(attemptBudgetMs(5_000, 3)).toBe(5_000);
  });
});

describe('the registry is a consent matter', () => {
  const KEY_ENVS = ['GROQ_API_KEY_1', 'GROQ_API_KEY_2', 'GROQ_API_KEY_3', 'GEMINI_API_KEY_1', 'GEMINI_API_KEY_2', 'OPENROUTER_API_KEY'];
  afterEach(() => vi.unstubAllEnvs());

  test('six slots, free Groq first and paid vendors last', () => {
    expect(PROVIDERS.map((p) => p.id)).toEqual(['groq', 'groq', 'groq', 'google', 'google', 'openrouter']);
  });

  test('every registered provider is named in the notice and the disclosed list', () => {
    const disclosed = new Set<string>(LEDGER_CHAT_DISCLOSED_PROVIDERS.map((p) => p.id));
    for (const p of PROVIDERS) {
      expect(disclosed.has(p.id), `${p.id} is not in LEDGER_CHAT_DISCLOSED_PROVIDERS`).toBe(true);
      expect(LEDGER_CHAT_NOTICE_TEXT, `the consent notice does not name ${p.label}`).toContain(p.label);
    }
  });

  test('each slot reads only its own key: an unset key is skipped, a set one builds a client', () => {
    for (const env of KEY_ENVS) vi.stubEnv(env, '');
    expect(PROVIDERS.every((p) => p.client() === null)).toBe(true);
    expect(hasUsableProvider(PROVIDERS)).toBe(false);

    vi.stubEnv('GEMINI_API_KEY_2', 'test-key');
    expect(PROVIDERS.map((p) => p.client() !== null)).toEqual([false, false, false, false, true, false]);
    expect(hasUsableProvider(PROVIDERS)).toBe(true);
  });

  test('the model is read per vendor, with a tool-capable default', () => {
    vi.stubEnv('GROQ_MODEL', '');
    expect(PROVIDERS[0].model()).toBe('openai/gpt-oss-120b');
    vi.stubEnv('GEMINI_MODEL', 'gemini-test');
    expect(PROVIDERS[3].model()).toBe('gemini-test');
  });

  test('when all six keys fail, the reader gets one calm error naming every attempt', async () => {
    const boom = async () => { throw new UpstreamBoom(429); };
    const six = PROVIDERS.map((p) => provider(p.id, { label: p.label, create: boom }));
    const err = await runWithFallback(input(six)).catch((e) => e);
    expect(err).toBeInstanceOf(ChatUpstreamError);
    expect(err.failed.map((f: { providerId: string }) => f.providerId)).toEqual(['groq', 'groq', 'groq', 'google', 'google', 'openrouter']);
  });
});

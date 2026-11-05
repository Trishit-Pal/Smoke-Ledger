import { beforeEach, describe, expect, test, vi } from 'vitest';
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
import { langchainProviders } from '@web/lib/server/ledgerChat/providers/langchain';
import type { ChatModelClient } from '@web/lib/server/ledgerChat/turn';

const RESULT = { answer: 'ok', rows: [], toolsUsed: [], usage: { inputTokens: 1, outputTokens: 1, cacheReadTokens: 0, modelCalls: 1, guardRetries: 0 } };
const ctx = {} as never;

function client(create: () => Promise<unknown> = async () => ({})): ChatModelClient {
  return { messages: { create } } as unknown as ChatModelClient;
}

function provider(id: string, over: Partial<ChatProvider> & { create?: () => Promise<unknown> } = {}): ChatProvider & { made: number } {
  const p = {
    id,
    label: 'Anthropic',
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
  test('the first provider serves when it works, and no other client is built', async () => {
    const a = provider('anthropic', { model: () => 'm1' });
    const b = provider('anthropic', { model: () => 'm2' });
    const out = await runWithFallback(input([a, b]));
    expect(out.providerId).toBe('anthropic');
    expect(out.failed).toEqual([]);
    expect(b.made).toBe(0);
  });

  test('a provider failure restarts the whole turn on the next one', async () => {
    const a = provider('anthropic', { create: async () => { throw new UpstreamBoom(429); } });
    const b = provider('anthropic', { model: () => 'm2' });
    const out = await runWithFallback(input([a, b]));
    expect(out.providerId).toBe('anthropic');
    expect(out.failed).toEqual([{ providerId: 'anthropic', errorName: 'RateLimitError', status: 429 }]);
    expect(mocks.turn).toHaveBeenCalledTimes(2);
    expect(mocks.turn.mock.calls[1][0].model).toBe('m2');
  });

  test('an error that is not from the model call is a bug, not an upstream failure: no failover', async () => {
    mocks.turn.mockRejectedValueOnce(new TypeError('our own bug'));
    const a = provider('anthropic', { model: () => 'm1' });
    const b = provider('anthropic', { model: () => 'm2' });
    await expect(runWithFallback(input([a, b]))).rejects.toThrow('our own bug');
    expect(b.made).toBe(0);
  });

  test('every provider failing gives one calm error that carries no content', async () => {
    const boom = async () => { throw new UpstreamBoom(503); };
    const err = await runWithFallback(input([provider('anthropic', { model: () => 'm1', create: boom }), provider('anthropic', { model: () => 'm2', create: boom })])).catch((e) => e);
    expect(err).toBeInstanceOf(ChatUpstreamError);
    expect(err.failed.map((f: { providerId: string }) => f.providerId)).toEqual(['anthropic', 'anthropic']);
    expect(err.message).toBe('every model provider failed');
    expect(JSON.stringify(err.failed)).not.toContain('SECRET');
  });

  test('a provider with no key is skipped without an error', async () => {
    const noKey = provider('anthropic', { client: () => null });
    const b = provider('anthropic', { model: () => 'm2' });
    const out = await runWithFallback(input([noKey, b]));
    expect(out.providerId).toBe('anthropic');
    expect(out.failed).toEqual([]);
    expect(mocks.turn.mock.calls[0][0].model).toBe('m2');
  });

  test('a provider whose client() throws (a bad key, a broken adapter) is recorded and skipped, never a crash', async () => {
    const broken = provider('anthropic', {
      model: () => 'm1',
      client: () => {
        throw new TypeError('SECRET key format is wrong');
      },
    });
    const b = provider('anthropic', { model: () => 'm2' });
    const out = await runWithFallback(input([broken, b]));
    expect(out.providerId).toBe('anthropic');
    expect(out.failed).toEqual([{ providerId: 'anthropic', errorName: 'TypeError' }]);
    expect(JSON.stringify(out.failed)).not.toContain('SECRET');
    expect(mocks.turn.mock.calls[0][0].model).toBe('m2');
    expect(hasUsableProvider([broken])).toBe(false);
    expect(hasUsableProvider([broken, b])).toBe(true);
  });

  test('no usable provider is an upstream failure with nothing tried', async () => {
    const err = await runWithFallback(input([provider('anthropic', { client: () => null })])).catch((e) => e);
    expect(err).toBeInstanceOf(ChatUpstreamError);
    expect(err.failed).toEqual([]);
    expect(mocks.turn).not.toHaveBeenCalled();
  });

  test('a vendor the consent notice does not name is refused, and its client is never built', async () => {
    const groq = provider('groq', { label: 'Groq' });
    const err = await runWithFallback(input([groq])).catch((e) => e);
    expect(err).toBeInstanceOf(ChatUpstreamError);
    expect(groq.made).toBe(0);
    expect(hasUsableProvider([groq])).toBe(false);
  });

  test('a listed id whose label the notice does not contain is refused too', async () => {
    const odd = provider('anthropic', { label: 'Some Other Vendor' });
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
    const slow = provider('anthropic', { model: () => 'm1', create: hangs as never });
    const b = provider('anthropic', { model: () => 'm2' });
    const err = await runWithFallback(input([slow, b], 40)).catch((e) => e);
    expect(err).toBeInstanceOf(ChatUpstreamError);
    expect(err.failed).toHaveLength(1);
    expect(b.made).toBe(0);
  });

  test('each attempt gets its own abort signal, slice-limited', async () => {
    const seen: AbortSignal[] = [];
    mocks.turn.mockImplementation(async (i: { signal?: AbortSignal; anthropic: ChatModelClient }) => {
      seen.push(i.signal as AbortSignal);
      await i.anthropic.messages.create({} as never);
      return RESULT;
    });
    const boom = async () => { throw new UpstreamBoom(500); };
    await runWithFallback(input([provider('anthropic', { model: () => 'm1', create: boom }), provider('anthropic', { model: () => 'm2' })]));
    expect(seen).toHaveLength(2);
    expect(seen[0]).not.toBe(seen[1]);
    expect(seen.every((s) => s instanceof AbortSignal)).toBe(true);
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
  test('Anthropic comes first', () => {
    expect(PROVIDERS[0].id).toBe('anthropic');
  });

  test('every registered provider is named in the notice and the disclosed list', () => {
    const disclosed = new Set<string>(LEDGER_CHAT_DISCLOSED_PROVIDERS.map((p) => p.id));
    for (const p of PROVIDERS) {
      expect(disclosed.has(p.id), `${p.id} is not in LEDGER_CHAT_DISCLOSED_PROVIDERS`).toBe(true);
      expect(LEDGER_CHAT_NOTICE_TEXT, `the consent notice does not name ${p.label}`).toContain(p.label);
    }
  });

  test('the LangChain slot is a plain array the owner fills', () => {
    expect(Array.isArray(langchainProviders)).toBe(true);
  });
});

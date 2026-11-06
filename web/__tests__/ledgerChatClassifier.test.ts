import { describe, expect, test } from 'vitest';
import { MockLanguageModelV4 } from 'ai/test';
import {
  ClassifierUnavailable,
  INJECTION_THRESHOLD,
  classifyTurn,
  parseLlamaGuard,
  parsePromptGuard,
} from '@web/lib/server/ledgerChat/classifier';

const usage = {
  inputTokens: { total: 1, noCache: 1, cacheRead: undefined, cacheWrite: undefined },
  outputTokens: { total: 1, text: 1, reasoning: undefined },
};

function replying(text: string, seen?: unknown[]) {
  return new MockLanguageModelV4({
    doGenerate: async (options) => {
      seen?.push(options.prompt);
      return { content: [{ type: 'text', text }], finishReason: { unified: 'stop', raw: undefined }, usage, warnings: [] } as never;
    },
  });
}

function failing() {
  return new MockLanguageModelV4({
    doGenerate: async () => {
      throw Object.assign(new Error('rate limited'), { statusCode: 429 });
    },
  });
}

/** One fake Groq key per entry: which model id gets which reply. */
function deps(perKey: Array<{ guard: MockLanguageModelV4; injection: MockLanguageModelV4 }>) {
  const keys = perKey.map((_, i) => `key-${i}`);
  return {
    keys,
    model: (apiKey: string, modelId: string) => {
      const k = perKey[keys.indexOf(apiKey)];
      return modelId.includes('prompt-guard') ? k.injection : k.guard;
    },
  };
}

const turn = { history: [], question: 'How many this week?' };

describe('parseLlamaGuard', () => {
  test('safe', () => expect(parseLlamaGuard('safe')).toEqual({ safe: true }));
  test('unsafe with a code maps to a category', () => {
    expect(parseLlamaGuard('unsafe\nS12')).toEqual({ safe: false, category: 'sexual' });
    expect(parseLlamaGuard('unsafe\nS1')).toEqual({ safe: false, category: 'violence' });
    expect(parseLlamaGuard('unsafe\nS10')).toEqual({ safe: false, category: 'hate' });
  });
  test('S11 is self-harm, so the reader gets the helpline line', () => {
    expect(parseLlamaGuard('unsafe\nS11')).toEqual({ safe: false, category: 'self_harm' });
  });
  test('several codes: self-harm wins over the others', () => {
    expect(parseLlamaGuard('unsafe\nS1,S11')).toEqual({ safe: false, category: 'self_harm' });
  });
  test('unsafe with an unknown or missing code is still unsafe', () => {
    expect(parseLlamaGuard('unsafe')).toEqual({ safe: false, category: 'other' });
    expect(parseLlamaGuard('unsafe\nS99')).toEqual({ safe: false, category: 'other' });
  });
  test('anything else is not a verdict: it throws, so the classifier fails closed', () => {
    expect(() => parseLlamaGuard('I think this is fine')).toThrow();
    expect(() => parseLlamaGuard('')).toThrow();
  });
});

describe('parsePromptGuard', () => {
  test('a probability at or above the threshold is an injection', () => {
    expect(parsePromptGuard(String(INJECTION_THRESHOLD))).toEqual({ safe: false, category: 'injection' });
    expect(parsePromptGuard('0.9993')).toEqual({ safe: false, category: 'injection' });
  });
  test('a probability below the threshold is safe', () => {
    expect(parsePromptGuard('0.0012')).toEqual({ safe: true });
  });
  test('label replies are understood too', () => {
    expect(parsePromptGuard('BENIGN')).toEqual({ safe: true });
    expect(parsePromptGuard('MALICIOUS')).toEqual({ safe: false, category: 'injection' });
    expect(parsePromptGuard('JAILBREAK')).toEqual({ safe: false, category: 'injection' });
  });
  test('an unknown format throws rather than passing silently', () => {
    expect(() => parsePromptGuard('maybe')).toThrow();
  });
});

describe('classifyTurn', () => {
  test('both classifiers safe: safe', async () => {
    const out = await classifyTurn(turn, deps([{ guard: replying('safe'), injection: replying('0.01') }]));
    expect(out).toEqual({ safe: true });
  });

  test('Prompt Guard flags an injection even when Llama Guard says safe', async () => {
    const out = await classifyTurn(turn, deps([{ guard: replying('safe'), injection: replying('0.98') }]));
    expect(out).toEqual({ safe: false, category: 'injection' });
  });

  test('Llama Guard sees the earlier turns and the question, in order, ending on the question', async () => {
    const seen: unknown[] = [];
    await classifyTurn(
      { history: [{ role: 'user', text: 'first' }, { role: 'assistant', text: 'reply' }], question: 'now this' },
      deps([{ guard: replying('safe', seen), injection: replying('0.01') }]),
    );
    const prompt = JSON.stringify(seen[0]);
    expect(prompt.indexOf('first')).toBeLessThan(prompt.indexOf('reply'));
    expect(prompt.indexOf('reply')).toBeLessThan(prompt.indexOf('now this'));
  });

  test('Prompt Guard sees only the question', async () => {
    const seen: unknown[] = [];
    await classifyTurn(
      { history: [{ role: 'user', text: 'earlier secret' }, { role: 'assistant', text: 'r' }], question: 'now this' },
      deps([{ guard: replying('safe'), injection: replying('0.01', seen) }]),
    );
    expect(JSON.stringify(seen[0])).toContain('now this');
    expect(JSON.stringify(seen[0])).not.toContain('earlier secret');
  });

  test('a failing key moves to the next Groq key', async () => {
    const out = await classifyTurn(turn, deps([
      { guard: failing(), injection: replying('0.01') },
      { guard: replying('unsafe\nS12'), injection: replying('0.01') },
    ]));
    expect(out).toEqual({ safe: false, category: 'sexual' });
  });

  test('an unparseable reply counts as a failure and moves on', async () => {
    const out = await classifyTurn(turn, deps([
      { guard: replying('hmm'), injection: replying('0.01') },
      { guard: replying('safe'), injection: replying('0.01') },
    ]));
    expect(out).toEqual({ safe: true });
  });

  test('every key failing throws ClassifierUnavailable (the route fails closed)', async () => {
    const err = await classifyTurn(turn, deps([
      { guard: failing(), injection: replying('0.01') },
      { guard: replying('safe'), injection: failing() },
    ])).catch((e) => e);
    expect(err).toBeInstanceOf(ClassifierUnavailable);
  });

  test('no Groq key at all throws ClassifierUnavailable', async () => {
    const err = await classifyTurn(turn, { keys: [], model: () => replying('safe') }).catch((e) => e);
    expect(err).toBeInstanceOf(ClassifierUnavailable);
  });

  test('a hung classifier is cut off by the timeout and counts as a failure', async () => {
    const hangs = new MockLanguageModelV4({
      doGenerate: ({ abortSignal }) =>
        new Promise((_, reject) => abortSignal?.addEventListener('abort', () => reject(new Error('aborted')))),
    });
    const err = await classifyTurn(turn, { ...deps([{ guard: hangs, injection: replying('0.01') }]), timeoutMs: 20 }).catch((e) => e);
    expect(err).toBeInstanceOf(ClassifierUnavailable);
  });
});

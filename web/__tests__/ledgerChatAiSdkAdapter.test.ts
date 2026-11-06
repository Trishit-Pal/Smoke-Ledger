import { describe, expect, test } from 'vitest';
import { MockLanguageModelV4 } from 'ai/test';
import { aiSdkClient } from '@web/lib/server/ledgerChat/providers/aiSdk';

type Content = Array<Record<string, unknown>>;

const usage = {
  inputTokens: { total: 11, noCache: 11, cacheRead: undefined, cacheWrite: undefined },
  outputTokens: { total: 7, text: 7, reasoning: undefined },
};

function model(content: Content, unified = 'stop') {
  const calls: Array<{ prompt: unknown; tools: unknown; abortSignal?: AbortSignal; maxOutputTokens?: number }> = [];
  const m = new MockLanguageModelV4({
    doGenerate: async (options) => {
      calls.push(options as never);
      return { content, finishReason: { unified, raw: undefined }, usage, warnings: [] } as never;
    },
  });
  return { m, calls };
}

const params = {
  model: 'ignored',
  max_tokens: 4096,
  system: [
    { type: 'text', text: 'SYSTEM', cache_control: { type: 'ephemeral' } },
    { type: 'text', text: 'CONTEXT' },
  ],
  tools: [{ name: 'totals', description: 'Totals', strict: true, input_schema: { type: 'object', properties: { days: { type: 'number' } } } }],
  output_config: { effort: 'low' },
  messages: [
    { role: 'user', content: 'how many?' },
    { role: 'assistant', content: [{ type: 'text', text: 'checking' }, { type: 'tool_use', id: 'call_1', name: 'totals', input: { days: 7 } }] },
    { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'call_1', content: '{"total":3}' }] },
    { role: 'assistant', content: [{ type: 'tool_use', id: 'call_2', name: 'totals', input: {} }] },
    { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'call_2', is_error: true, content: 'bad input' }] },
  ],
} as never;

describe('aiSdkClient (Anthropic shape in and out, AI SDK underneath)', () => {
  test('maps system, tools, history blocks and limits into the AI SDK call', async () => {
    const { m, calls } = model([{ type: 'text', text: 'ok' }]);
    const controller = new AbortController();
    await aiSdkClient(m).messages.create(params, { signal: controller.signal });

    const call = calls[0];
    expect(call.maxOutputTokens).toBe(4096);
    expect(call.abortSignal).toBeDefined();
    expect(JSON.stringify(call.tools)).toContain('totals');

    const prompt = call.prompt as Array<{ role: string; content: unknown }>;
    expect(prompt[0]).toMatchObject({ role: 'system' });
    expect(JSON.stringify(prompt[0])).toContain('SYSTEM');
    expect(JSON.stringify(prompt[0])).toContain('CONTEXT');
    expect(prompt.map((p) => p.role)).toEqual(['system', 'user', 'assistant', 'tool', 'assistant', 'tool']);
    expect(JSON.stringify(prompt[2])).toContain('"toolCallId":"call_1"');
    expect(JSON.stringify(prompt[3])).toContain('"toolName":"totals"');
    expect(JSON.stringify(prompt[3])).toContain('{\\"total\\":3}');
    expect(JSON.stringify(prompt[5])).toContain('error-text');
  });

  test('returns text as an Anthropic text block, end_turn, and token usage', async () => {
    const { m } = model([{ type: 'text', text: 'Here is the ledger.' }]);
    const res = await aiSdkClient(m).messages.create(params);
    expect(res.content).toEqual([expect.objectContaining({ type: 'text', text: 'Here is the ledger.' })]);
    expect(res.stop_reason).toBe('end_turn');
    expect(res.usage).toMatchObject({ input_tokens: 11, output_tokens: 7 });
  });

  test('returns tool calls as tool_use blocks with stop_reason tool_use', async () => {
    const { m } = model([{ type: 'tool-call', toolCallId: 'c9', toolName: 'totals', input: '{"days":30}' }], 'tool-calls');
    const res = await aiSdkClient(m).messages.create(params);
    expect(res.stop_reason).toBe('tool_use');
    expect(res.content).toEqual([{ type: 'tool_use', id: 'c9', name: 'totals', input: { days: 30 } }]);
  });

  test('provider metadata (Gemini thought signatures) survives the round-trip through turn.ts', async () => {
    const signed = { google: { thoughtSignature: 'sig-1' } };
    const first = model([{ type: 'tool-call', toolCallId: 'c1', toolName: 'totals', input: '{}', providerMetadata: signed }], 'tool-calls');
    const res = await aiSdkClient(first.m).messages.create(params);

    // turn.ts pushes the assistant content back unmodified, then the tool result.
    const next = { ...(params as object), messages: [{ role: 'user', content: 'q' }, { role: 'assistant', content: res.content }, { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'c1', content: '{}' }] }] } as never;
    const second = model([{ type: 'text', text: 'done' }]);
    await aiSdkClient(second.m).messages.create(next);
    expect(JSON.stringify(second.calls[0].prompt)).toContain('sig-1');
  });

  test('a tool call reported with finishReason stop is still tool_use', async () => {
    const { m } = model([{ type: 'tool-call', toolCallId: 'c1', toolName: 'totals', input: '{}' }], 'stop');
    expect((await aiSdkClient(m).messages.create(params)).stop_reason).toBe('tool_use');
  });

  test.each([
    ['length', 'max_tokens'],
    ['content-filter', 'refusal'],
  ])('finishReason %s maps to %s', async (unified, expected) => {
    const { m } = model([{ type: 'text', text: 'x' }], unified);
    expect((await aiSdkClient(m).messages.create(params)).stop_reason).toBe(expected);
  });

  test('never returns reasoning parts', async () => {
    const { m } = model([
      { type: 'reasoning', text: 'secret chain' },
      { type: 'text', text: 'answer' },
    ]);
    const res = await aiSdkClient(m).messages.create(params);
    expect(JSON.stringify(res.content)).not.toContain('secret chain');
  });

  test('a model error throws, so the runner moves to the next key', async () => {
    const m = new MockLanguageModelV4({
      doGenerate: async () => {
        throw Object.assign(new Error('rate limited'), { statusCode: 429 });
      },
    });
    await expect(aiSdkClient(m).messages.create(params)).rejects.toThrow();
  });

  test('finishReason error throws instead of answering', async () => {
    const { m } = model([{ type: 'text', text: '' }], 'error');
    await expect(aiSdkClient(m).messages.create(params)).rejects.toThrow();
  });
});

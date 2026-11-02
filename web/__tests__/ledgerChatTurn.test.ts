import { describe, expect, test } from 'vitest';
import type Anthropic from '@anthropic-ai/sdk';
import { buildToolContext } from '@/domain/ledgerChat/context';
import type { DailySummaryRow } from '@/domain/periodSummary';
import type { CigaretteLog, UserProfile } from '@/types';
import {
  FALLBACK_ANSWER,
  MAX_MODEL_CALLS,
  REFUSAL_ANSWER,
  runLedgerChatTurn,
  type ChatModelClient,
} from '@web/lib/server/ledgerChat/turn';

const TODAY = '2026-06-21';

const profile: UserProfile = {
  baselinePerDay: 10,
  baselineWindowDays: 7,
  currency: 'INR',
  discreetMode: false,
  appLockEnabled: false,
  hideTotalsOnHome: false,
  onboardedAt: '2026-01-01T00:00:00.000Z',
  country: null,
};

const rows: DailySummaryRow[] = [
  { date: '2026-06-21', sticks: 3, spendInr: 60, avgUnitPriceInr: 20 },
  { date: '2026-06-20', sticks: 5, spendInr: 100, avgUnitPriceInr: 20 },
  { date: '2026-06-14', sticks: 7, spendInr: 140, avgUnitPriceInr: 20 },
];

const logs: CigaretteLog[] = [];

const ctx = buildToolContext({ profile, logs, rows, goals: [], today: TODAY, summarySinceYmd: '2025-06-22' });

type Call = Anthropic.MessageCreateParamsNonStreaming;
type CallOptions = { signal?: AbortSignal } | undefined;

function message(content: Anthropic.ContentBlock[], stop: Anthropic.StopReason): Anthropic.Message {
  return {
    id: 'msg',
    type: 'message',
    role: 'assistant',
    model: 'fake',
    content,
    stop_reason: stop,
    stop_sequence: null,
    usage: { input_tokens: 10, output_tokens: 5, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 },
  } as unknown as Anthropic.Message;
}

const thinking = { type: 'thinking', thinking: '', signature: 'sig' } as unknown as Anthropic.ContentBlock;
const text = (t: string) => ({ type: 'text', text: t, citations: null }) as unknown as Anthropic.ContentBlock;
const toolUse = (name: string, input: unknown) =>
  ({ type: 'tool_use', id: `tu-${name}`, name, input, caller: { type: 'direct' } }) as unknown as Anthropic.ContentBlock;

/** A scripted model: each call pops the next reply; records every request and its options. */
function fakeClient(replies: Anthropic.Message[]): { client: ChatModelClient; calls: Call[]; options: CallOptions[] } {
  const calls: Call[] = [];
  const options: CallOptions[] = [];
  const queue = [...replies];
  const client: ChatModelClient = {
    messages: {
      create: async (params, opts) => {
        calls.push(params);
        options.push(opts);
        const next = queue.shift();
        if (!next) throw new Error('fake client: no reply scripted');
        return next;
      },
    },
  };
  return { client, calls, options };
}

function run(client: ChatModelClient, question = 'How did this week compare to last?', signal?: AbortSignal) {
  return runLedgerChatTurn({ anthropic: client, model: 'fake', ctx, history: [], question, signal });
}

describe('runLedgerChatTurn', () => {
  test('runs the requested tool, passes the whole assistant turn back, and keeps a verified narration', async () => {
    const first = message([thinking, toolUse('compare_periods', { window: 'week' })], 'tool_use');
    const { client, calls } = fakeClient([first, message([text('This week came to 8 sticks.')], 'end_turn')]);

    const result = await run(client);

    expect(result.toolsUsed).toEqual(['compare_periods']);
    expect(result.rows.some((r) => r.id === 'compare.current.sticks' && r.value === 8)).toBe(true);
    expect(result.answer).toBe('This week came to 8 sticks.');
    expect(result.usage.guardRetries).toBe(0);
    expect(calls).toHaveLength(2);
    // The assistant turn goes back unmodified (thinking block included) before the tool results.
    expect(calls[1].messages[1]).toEqual({ role: 'assistant', content: first.content });
    const results = calls[1].messages[2].content as Anthropic.ToolResultBlockParam[];
    expect(results[0].type).toBe('tool_result');
    expect(results[0].tool_use_id).toBe('tu-compare_periods');
  });

  test('retries once on an unverified figure, then falls back to the rows', async () => {
    const { client, calls } = fakeClient([
      message([toolUse('compare_periods', { window: 'week' })], 'tool_use'),
      message([text('About 15 sticks this week.')], 'end_turn'),
      message([text('Still roughly 15.')], 'end_turn'),
    ]);

    const result = await run(client);

    expect(calls).toHaveLength(3);
    expect(result.usage.guardRetries).toBe(1);
    expect(result.answer).toBe(FALLBACK_ANSWER);
    expect(result.rows.length).toBeGreaterThan(0);
  });

  test('a refusal yields the calm fallback and runs no tools', async () => {
    const { client, calls } = fakeClient([message([], 'refusal')]);

    const result = await run(client, 'How do I quit?');

    expect(calls).toHaveLength(1);
    expect(result.answer).toBe(REFUSAL_ANSWER);
    expect(result.toolsUsed).toEqual([]);
  });

  test('stops after the call cap when the model keeps asking for tools', async () => {
    const replies = Array.from({ length: MAX_MODEL_CALLS + 2 }, () =>
      message([toolUse('savings', {})], 'tool_use'),
    );
    const { client, calls } = fakeClient(replies);

    const result = await run(client);

    expect(calls).toHaveLength(MAX_MODEL_CALLS);
    expect(result.answer).toBe(FALLBACK_ANSWER);
  });

  test('passes one turn-wide abort signal to every model call so a slow upstream cannot outlive the function', async () => {
    const { client, options } = fakeClient([
      message([toolUse('compare_periods', { window: 'week' })], 'tool_use'),
      message([text('Fewer than last week.')], 'end_turn'),
    ]);
    const signal = AbortSignal.timeout(60_000);

    await run(client, 'How did this week compare to last?', signal);

    expect(options).toHaveLength(2);
    for (const o of options) expect(o?.signal).toBe(signal);
  });

  test('an unknown tool becomes an error result the model can read, never a throw', async () => {
    const { client, calls } = fakeClient([
      message([toolUse('delete_everything', {})], 'tool_use'),
      message([text('I can only read the ledger.')], 'end_turn'),
    ]);

    const result = await run(client);

    const results = calls[1].messages[2].content as Anthropic.ToolResultBlockParam[];
    expect(results[0].is_error).toBe(true);
    expect(result.toolsUsed).toEqual([]);
    expect(result.answer).toBe('I can only read the ledger.');
  });
});

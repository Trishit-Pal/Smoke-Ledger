// One chat turn: the model picks tools, the tools run here, the model narrates,
// and the guards decide whether the narration may be shown. Dependency-injected
// (any object with messages.create) so it runs under vitest with a fake model.
// Must not value-import web/lib/server/data or web/lib/auth/rateLimit (Next-bound).

import type Anthropic from '@anthropic-ai/sdk';
import type { ToolContext } from '@/domain/ledgerChat/context';
import { allowedNumbers, findUnverifiedFigures, sanitizeNarration } from '@/domain/ledgerChat/guard';
import { BEYOND_SCOPE_ANSWER, screenAnswer } from '@/domain/ledgerChat/safety';
import { TOOL_DEFS, runTool, toolResultContent, type ToolOutcome } from '@/domain/ledgerChat/tools';
import type { ChatHistoryTurn, ChatResponse, Row } from '@/domain/ledgerChat/types';
import { SYSTEM_PROMPT, userContextBlock } from './prompt';

/** Tool picks, narration, and one spare round; the guard retry is on top of this. */
export const MAX_MODEL_CALLS = 3;
/** Reasoning models (gpt-oss, Gemini) spend part of the cap thinking; 1024 would truncate ordinary tool turns. */
export const MAX_OUTPUT_TOKENS = 4096;
export const FALLBACK_ANSWER = 'Here is what the ledger shows.';

export interface ChatModelClient {
  messages: {
    create(
      params: Anthropic.MessageCreateParamsNonStreaming,
      options?: { signal?: AbortSignal },
    ): Promise<Anthropic.Message>;
  };
}

export interface TurnInput {
  anthropic: ChatModelClient;
  model: string;
  ctx: ToolContext;
  history: ChatHistoryTurn[];
  question: string;
  /** One budget for the whole turn, so several slow calls cannot outlive the function. */
  signal?: AbortSignal;
}

export interface TurnUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  modelCalls: number;
  guardRetries: number;
}

export interface TurnResult extends ChatResponse {
  usage: TurnUsage;
}

const TOOLS: Anthropic.Tool[] = TOOL_DEFS.map((t) => ({
  name: t.name,
  description: t.description,
  strict: true,
  input_schema: t.input_schema,
}));

function textOf(message: Anthropic.Message): string {
  return message.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('\n');
}

function toolUsesOf(message: Anthropic.Message): Anthropic.ToolUseBlock[] {
  return message.content.filter((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use');
}

const baseId = (id: string): string => id.replace(/#\d+$/, '');

/**
 * Row ids are constants per tool, so a second call to one tool ("September vs
 * October" = two totals_in_window calls) must not collide: an exact repeat is
 * dropped, a different result gets `#2`, `#3`. The panel keys React lists and its
 * reveal-on-tap state by id, so ids stay unique and, being call-ordered, stable.
 */
function addRow(rows: Row[], r: Row): void {
  const same = (x: Row) => baseId(x.id) === r.id && x.label === r.label && x.value === r.value && x.unit === r.unit;
  if (rows.some(same)) return;
  let id = r.id;
  for (let n = 2; rows.some((x) => x.id === id); n++) id = `${r.id}#${n}`;
  rows.push(id === r.id ? r : { ...r, id });
}

function retryInstruction(figures: string[]): string {
  return `Your reply stated ${figures.join(', ')}, which is not in the tool results. Rewrite it without stating any numbers; the reader sees the figures as rows.`;
}

export async function runLedgerChatTurn(input: TurnInput): Promise<TurnResult> {
  const { anthropic, model, ctx } = input;
  const usage: TurnUsage = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, modelCalls: 0, guardRetries: 0 };
  const outcomes: ToolOutcome[] = [];
  const rows: Row[] = [];
  const toolsUsed: string[] = [];
  const contextBlock = userContextBlock(ctx);

  const messages: Anthropic.MessageParam[] = [
    ...input.history.map((h): Anthropic.MessageParam => ({ role: h.role, content: h.text })),
    { role: 'user', content: input.question },
  ];

  const call = async (): Promise<Anthropic.Message> => {
    const res = await anthropic.messages.create(
      {
        model,
        max_tokens: MAX_OUTPUT_TOKENS,
        system: [
          { type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } },
          { type: 'text', text: contextBlock },
        ],
        tools: TOOLS,
        output_config: { effort: 'low' },
        messages,
      },
      { signal: input.signal },
    );
    usage.modelCalls += 1;
    usage.inputTokens += res.usage.input_tokens;
    usage.outputTokens += res.usage.output_tokens;
    usage.cacheReadTokens += res.usage.cache_read_input_tokens ?? 0;
    return res;
  };

  const finish = (answer: string): TurnResult => ({ answer, rows, toolsUsed, usage });
  // A refusal or an unsafe answer shows the fixed reply alone: no ledger rows beside it.
  const refuse = (): TurnResult => ({ answer: BEYOND_SCOPE_ANSWER, rows: [], toolsUsed: [], usage });

  let narration: string | null = null;
  let last: Anthropic.Message | null = null;

  for (let i = 0; i < MAX_MODEL_CALLS; i++) {
    const res = await call();
    last = res;
    if (res.stop_reason === 'refusal') return refuse();
    if (res.stop_reason === 'max_tokens') return finish(FALLBACK_ANSWER);

    const toolUses = toolUsesOf(res);
    if (toolUses.length === 0) {
      narration = textOf(res);
      break;
    }

    // The whole assistant turn goes back unmodified (thinking blocks included).
    messages.push({ role: 'assistant', content: res.content });
    const results: Anthropic.ToolResultBlockParam[] = toolUses.map((tu) => {
      const outcome = runTool(tu.name, tu.input, ctx);
      const content = toolResultContent(tu.name, outcome);
      if (outcome.ok) {
        outcomes.push(outcome);
        if (!toolsUsed.includes(tu.name)) toolsUsed.push(tu.name);
        for (const r of outcome.rows) addRow(rows, r);
        return { type: 'tool_result', tool_use_id: tu.id, content };
      }
      return { type: 'tool_result', tool_use_id: tu.id, is_error: true, content };
    });
    messages.push({ role: 'user', content: results });
  }

  if (narration == null || last == null) return finish(FALLBACK_ANSWER);

  const allowed = allowedNumbers(outcomes, { year: ctx.today.slice(0, 4), extraText: [contextBlock] });
  // Brand and variant names the tools may echo (aliases when discreet): "Four Square" is a name.
  const allowedPhrases = ctx.logs.flatMap((l) => [l.brandNameSnap ?? '', l.variantSnap ?? '']);
  const figureOpts = { discreet: ctx.discreet, allowedPhrases };
  let answer = sanitizeNarration(narration);
  // Unsafe narration is replaced outright, never retried: a retry would only give it another go.
  if (screenAnswer(answer).blocked) return refuse();
  let unverified = findUnverifiedFigures(answer, allowed, figureOpts);

  if (unverified.length > 0) {
    usage.guardRetries = 1;
    messages.push({ role: 'assistant', content: last.content });
    messages.push({ role: 'user', content: retryInstruction(unverified) });
    const retry = await call();
    if (retry.stop_reason === 'refusal') return refuse();
    if (toolUsesOf(retry).length > 0) return finish(FALLBACK_ANSWER);
    answer = sanitizeNarration(textOf(retry));
    if (screenAnswer(answer).blocked) return refuse();
    unverified = findUnverifiedFigures(answer, allowed, figureOpts);
    if (unverified.length > 0) return finish(FALLBACK_ANSWER);
  }

  return finish(answer.length > 0 ? answer : FALLBACK_ANSWER);
}

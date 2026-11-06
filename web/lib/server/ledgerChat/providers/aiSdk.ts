// Adapts any Vercel AI SDK model to the Anthropic-shaped ChatModelClient the turn engine speaks
// (../turn.ts), so turn.ts, its guards and its tests stay vendor-neutral and untouched.
// One model call per create(): no `execute` on the tools and the default single step, because
// turn.ts runs the tools itself. Any failure throws; ../fallback.ts then tries the next key.

import type Anthropic from '@anthropic-ai/sdk';
import {
  generateText,
  jsonSchema,
  tool,
  type AssistantModelMessage,
  type LanguageModel,
  type ModelMessage,
  type ToolResultPart,
  type ToolSet,
} from 'ai';
import type { ChatModelClient } from '../turn';

type Params = Anthropic.MessageCreateParamsNonStreaming;
type ProviderOptions = Parameters<typeof generateText>[0]['providerOptions'];

/**
 * Per-part vendor metadata (Gemini's thought signatures) rides on the Anthropic-shaped block under
 * this key. turn.ts pushes assistant content back unmodified, so the next call replays it as
 * providerOptions, which is how the AI SDK expects signatures back.
 */
const PROVIDER_METADATA = 'ai_sdk_provider_metadata';

function metadataOf(block: object): { providerOptions?: ProviderOptions } {
  const meta = (block as Record<string, unknown>)[PROVIDER_METADATA];
  return meta ? { providerOptions: meta as ProviderOptions } : {};
}

function instructionsOf(system: Params['system']): string {
  if (system == null) return '';
  return typeof system === 'string' ? system : system.map((b) => b.text).join('\n\n');
}

function toolsOf(tools: Params['tools']): ToolSet {
  const out: ToolSet = {};
  for (const t of tools ?? []) {
    if (!('input_schema' in t)) continue;
    out[t.name] = tool({ description: t.description, inputSchema: jsonSchema(t.input_schema as Parameters<typeof jsonSchema>[0]) });
  }
  return out;
}

function resultText(content: Anthropic.ToolResultBlockParam['content']): string {
  if (content == null) return '';
  if (typeof content === 'string') return content;
  return content.map((b) => (b.type === 'text' ? b.text : '')).join('');
}

/** Anthropic puts tool results in a user turn; the AI SDK wants a `tool` message that names the tool. */
function messagesOf(messages: Params['messages']): ModelMessage[] {
  const toolNames = new Map<string, string>();
  const out: ModelMessage[] = [];
  for (const m of messages) {
    if (typeof m.content === 'string') {
      out.push({ role: m.role, content: m.content });
      continue;
    }
    if (m.role === 'assistant') {
      const parts: Exclude<AssistantModelMessage['content'], string> = [];
      for (const b of m.content) {
        if (b.type === 'text') parts.push({ type: 'text', text: b.text, ...metadataOf(b) });
        if (b.type === 'tool_use') {
          toolNames.set(b.id, b.name);
          parts.push({ type: 'tool-call', toolCallId: b.id, toolName: b.name, input: b.input, ...metadataOf(b) });
        }
      }
      out.push({ role: 'assistant', content: parts });
      continue;
    }
    const results: ToolResultPart[] = [];
    const texts: { type: 'text'; text: string }[] = [];
    for (const b of m.content) {
      if (b.type === 'text') texts.push({ type: 'text', text: b.text });
      if (b.type === 'tool_result') {
        const value = resultText(b.content);
        results.push({
          type: 'tool-result',
          toolCallId: b.tool_use_id,
          toolName: toolNames.get(b.tool_use_id) ?? 'unknown',
          output: b.is_error ? { type: 'error-text', value } : { type: 'text', value },
        });
      }
    }
    if (results.length > 0) out.push({ role: 'tool', content: results });
    if (texts.length > 0) out.push({ role: 'user', content: texts });
  }
  return out;
}

function stopReasonOf(finishReason: string, hasToolCalls: boolean): Anthropic.StopReason {
  // Some vendors report `stop` alongside tool calls; the calls are what turn.ts acts on.
  if (hasToolCalls) return 'tool_use';
  if (finishReason === 'length') return 'max_tokens';
  if (finishReason === 'content-filter') return 'refusal';
  return 'end_turn';
}

export function aiSdkClient(model: LanguageModel, providerOptions?: ProviderOptions): ChatModelClient {
  return {
    messages: {
      async create(params, options) {
        const res = await generateText({
          model,
          instructions: instructionsOf(params.system),
          messages: messagesOf(params.messages),
          tools: toolsOf(params.tools),
          maxOutputTokens: params.max_tokens,
          maxRetries: 0, // the runner owns retries: a failure moves to the next key
          abortSignal: options?.signal,
          providerOptions,
        });
        if (res.finishReason === 'error') throw new Error('model finished with an error');

        // From res.content, not res.text/toolCalls, so each part keeps its own metadata. Reasoning
        // parts are dropped: turn.ts must never see them.
        const content: Array<Record<string, unknown>> = [];
        for (const part of res.content) {
          const meta = 'providerMetadata' in part && part.providerMetadata ? { [PROVIDER_METADATA]: part.providerMetadata } : {};
          if (part.type === 'text' && part.text.length > 0) content.push({ type: 'text', text: part.text, citations: null, ...meta });
          if (part.type === 'tool-call') content.push({ type: 'tool_use', id: part.toolCallId, name: part.toolName, input: part.input ?? {}, ...meta });
        }
        const hasToolCalls = content.some((b) => b.type === 'tool_use');

        // turn.ts reads only content, stop_reason and usage; the id/model fields are inert here.
        return {
          id: 'ai-sdk',
          type: 'message',
          role: 'assistant',
          model: '',
          content,
          stop_reason: stopReasonOf(res.finishReason, hasToolCalls),
          stop_sequence: null,
          usage: { input_tokens: res.usage.inputTokens ?? 0, output_tokens: res.usage.outputTokens ?? 0, cache_read_input_tokens: 0 },
        } as unknown as Anthropic.Message;
      },
    },
  };
}

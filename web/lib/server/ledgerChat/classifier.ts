// The safety classifier: Groq's Llama Guard 4 (harmful content, judged on the whole conversation)
// and Prompt Guard 2 (injection and jailbreak attempts, judged on the question). Both run on the
// Groq key slots, which the consent notice already names. This file does the calls and reads the
// verdicts; ./screen.ts decides what to do with them. A model, key or format failure moves to the
// next Groq key; when none is left it throws ClassifierUnavailable and the route fails closed.

import { createGroq } from '@ai-sdk/groq';
import { generateText, type LanguageModel, type ModelMessage } from 'ai';
import type { SafetyCategory } from '@/domain/ledgerChat/safety';
import type { ChatHistoryTurn } from '@/domain/ledgerChat/types';
import { cleanEnvValue } from '@web/lib/supabase/env';
import { groqApiKeys } from './providers';

export type Verdict = { safe: true } | { safe: false; category: SafetyCategory };

export class ClassifierUnavailable extends Error {
  constructor() {
    super('safety classifier unavailable');
    this.name = 'ClassifierUnavailable';
  }
}

/** Per classifier call; both run at once, so this is also the per-key cost in time. */
export const GUARD_TIMEOUT_MS = 4_000;

/**
 * Prompt Guard 2 gives the probability that a text is an attack. ponytail: 0.8 trades a little
 * recall for fewer refused readers; lower it if the Preview probes or logs show misses.
 */
export const INJECTION_THRESHOLD = 0.8;

const DEFAULT_GUARD_MODEL = 'meta-llama/llama-guard-4-12b';
const DEFAULT_INJECTION_MODEL = 'meta-llama/llama-prompt-guard-2-86m';

/** Llama Guard 4's hazard codes (MLCommons taxonomy), folded into the categories the app answers. */
const HAZARD_CATEGORY: Readonly<Record<string, SafetyCategory>> = {
  S1: 'violence', // violent crimes
  S2: 'illegal', // non-violent crimes
  S3: 'sexual', // sex-related crimes
  S4: 'sexual', // child sexual exploitation
  S5: 'other', // defamation
  S6: 'other', // specialized advice
  S7: 'other', // privacy
  S8: 'other', // intellectual property
  S9: 'violence', // indiscriminate weapons
  S10: 'hate', // hate
  S11: 'self_harm', // suicide and self-harm
  S12: 'sexual', // sexual content
  S13: 'other', // elections
  S14: 'injection', // code interpreter abuse
};

export function parseLlamaGuard(text: string): Verdict {
  const [first = '', codes = ''] = text.trim().split(/\r?\n/);
  const verdict = first.trim().toLowerCase();
  if (verdict === 'safe') return { safe: true };
  if (verdict !== 'unsafe') throw new Error('unrecognised Llama Guard reply');
  const categories = (codes.match(/S\d+/gi) ?? []).map((c) => HAZARD_CATEGORY[c.toUpperCase()]).filter(Boolean);
  // Self-harm wins: that reader gets the helpline line whatever else was flagged.
  if (categories.includes('self_harm')) return { safe: false, category: 'self_harm' };
  return { safe: false, category: categories[0] ?? 'other' };
}

/** Groq does not document this model's reply shape; accept a probability or a label, refuse anything else. */
export function parsePromptGuard(text: string): Verdict {
  const reply = text.trim();
  const score = Number(reply);
  if (reply !== '' && Number.isFinite(score)) return score >= INJECTION_THRESHOLD ? { safe: false, category: 'injection' } : { safe: true };
  const label = reply.toUpperCase();
  if (/MALICIOUS|JAILBREAK|INJECTION/.test(label)) return { safe: false, category: 'injection' };
  if (/BENIGN|SAFE/.test(label)) return { safe: true };
  throw new Error('unrecognised Prompt Guard reply');
}

export interface ClassifierDeps {
  keys: readonly string[];
  model(apiKey: string, modelId: string): LanguageModel;
  timeoutMs?: number;
}

function defaultDeps(): ClassifierDeps {
  return { keys: groqApiKeys(), model: (apiKey, modelId) => createGroq({ apiKey })(modelId) };
}

async function ask(model: LanguageModel, messages: ModelMessage[], timeoutMs: number, signal?: AbortSignal): Promise<string> {
  const timeout = AbortSignal.timeout(timeoutMs);
  const { text } = await generateText({
    model,
    messages,
    maxOutputTokens: 20,
    maxRetries: 0,
    abortSignal: signal ? AbortSignal.any([signal, timeout]) : timeout,
  });
  return text;
}

export interface ClassifyInput {
  history: readonly ChatHistoryTurn[];
  question: string;
  signal?: AbortSignal;
}

export async function classifyTurn(input: ClassifyInput, deps: ClassifierDeps = defaultDeps()): Promise<Verdict> {
  const guardModel = cleanEnvValue(process.env.LEDGER_CHAT_GUARD_MODEL) || DEFAULT_GUARD_MODEL;
  const injectionModel = cleanEnvValue(process.env.LEDGER_CHAT_INJECTION_MODEL) || DEFAULT_INJECTION_MODEL;
  const timeoutMs = deps.timeoutMs ?? GUARD_TIMEOUT_MS;
  const conversation: ModelMessage[] = [
    ...input.history.map((t): ModelMessage => ({ role: t.role, content: t.text })),
    { role: 'user', content: input.question },
  ];

  for (const apiKey of deps.keys) {
    try {
      const [injection, harm] = await Promise.all([
        ask(deps.model(apiKey, injectionModel), [{ role: 'user', content: input.question }], timeoutMs, input.signal).then(parsePromptGuard),
        ask(deps.model(apiKey, guardModel), conversation, timeoutMs, input.signal).then(parseLlamaGuard),
      ]);
      // A harm verdict outranks an injection flag: it may be self-harm, which gets the helpline.
      if (!harm.safe) return harm;
      return injection;
    } catch {
      // This key, its quota or the reply format failed; the next key gets the same turn.
    }
  }
  throw new ClassifierUnavailable();
}

// Runs one chat turn on the first model provider that works, restarting the whole turn on the
// next one when a provider's call fails. Dependency-injected like turn.ts (the provider list is an
// argument), and it must not value-import web/lib/server/data or web/lib/auth/rateLimit (Next-bound).
//
// Why restart the whole turn: the tools only read in-memory data, so a rerun is safe, and it never
// mixes two vendors inside one conversation turn (their tool-call formats differ).

import type { ToolContext } from '@/domain/ledgerChat/context';
import { LEDGER_CHAT_DISCLOSED_PROVIDERS, LEDGER_CHAT_NOTICE_TEXT } from '@/domain/ledgerChat/notice';
import type { ChatHistoryTurn } from '@/domain/ledgerChat/types';
import { runLedgerChatTurn, type ChatModelClient, type TurnResult } from './turn';

/** One model vendor. Register it in providers.ts (Anthropic) or providers/langchain.ts (yours). */
export interface ChatProvider {
  /** Stable id; must be listed in LEDGER_CHAT_DISCLOSED_PROVIDERS. */
  id: string;
  /** The vendor's name as the consent notice writes it; the notice text must contain it. */
  label: string;
  /** Model id sent with each request; read lazily so a changed env value is picked up. */
  model(): string;
  /** A client for this turn, or null when no key is configured (the provider is then skipped). */
  client(): ChatModelClient | null;
}

/** Counts and names only: never a message, the question, an answer or who asked. */
export interface ProviderFailure {
  providerId: string;
  errorName: string;
  status?: number;
}

export class ChatUpstreamError extends Error {
  constructor(readonly failed: readonly ProviderFailure[]) {
    super('every model provider failed');
    this.name = 'ChatUpstreamError';
  }
}

export interface FallbackResult extends TurnResult {
  providerId: string;
  /** Providers that failed before this one served, in order. */
  failed: readonly ProviderFailure[];
}

/** The floor a provider is given when several are queued, so a turn with tools can still finish. */
export const MIN_ATTEMPT_MS = 8_000;

/** What is left is shared evenly between the providers still to try, never below the floor or above what is left. */
export function attemptBudgetMs(remainingMs: number, providersLeft: number): number {
  return Math.min(remainingMs, Math.max(MIN_ATTEMPT_MS, Math.floor(remainingMs / providersLeft)));
}

/** A provider may receive ledger data only if the consent notice names its vendor. */
function isDisclosed(p: ChatProvider): boolean {
  return LEDGER_CHAT_DISCLOSED_PROVIDERS.some((d) => d.id === p.id) && LEDGER_CHAT_NOTICE_TEXT.includes(p.label);
}

export function hasUsableProvider(providers: readonly ChatProvider[]): boolean {
  return providers.some((p) => isDisclosed(p) && p.client() !== null);
}

/** Marks an error as coming from the model call, so our own bugs are never mistaken for an upstream failure. */
class ProviderCallError extends Error {
  constructor(readonly cause: unknown) {
    super('model call failed');
  }
}

function failureOf(providerId: string, e: ProviderCallError): ProviderFailure {
  const cause = e.cause as { name?: unknown; status?: unknown } | null;
  const failure: ProviderFailure = { providerId, errorName: typeof cause?.name === 'string' ? cause.name : 'Error' };
  if (typeof cause?.status === 'number') failure.status = cause.status;
  return failure;
}

function guarded(client: ChatModelClient): ChatModelClient {
  return {
    messages: {
      create: async (params, options) => {
        try {
          return await client.messages.create(params, options);
        } catch (e) {
          throw new ProviderCallError(e);
        }
      },
    },
  };
}

export interface FallbackInput {
  providers: readonly ChatProvider[];
  ctx: ToolContext;
  history: ChatHistoryTurn[];
  question: string;
  /** One budget for the whole run, shared by every attempt. */
  budgetMs: number;
}

export async function runWithFallback(input: FallbackInput): Promise<FallbackResult> {
  const started = Date.now();
  const queue = input.providers.filter(isDisclosed);
  const failed: ProviderFailure[] = [];

  for (let i = 0; i < queue.length; i++) {
    const remaining = input.budgetMs - (Date.now() - started);
    if (remaining <= 0) break;
    const provider = queue[i];
    const client = provider.client();
    if (!client) continue;
    try {
      const result = await runLedgerChatTurn({
        anthropic: guarded(client),
        model: provider.model(),
        ctx: input.ctx,
        history: input.history,
        question: input.question,
        signal: AbortSignal.timeout(attemptBudgetMs(remaining, queue.length - i)),
      });
      return { ...result, providerId: provider.id, failed };
    } catch (e) {
      if (!(e instanceof ProviderCallError)) throw e;
      failed.push(failureOf(provider.id, e));
    }
  }
  throw new ChatUpstreamError(failed);
}

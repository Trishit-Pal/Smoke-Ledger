// Ledger Chat — the contract between the panel, the route, and the turn engine.
// Pure types and zod schemas; no I/O, no SDK imports (shared by jest and vitest).

import { z } from 'zod';
import type { CurrencyCode } from '@/lib/regions';

export const CHAT_QUESTION_MAX = 500;
export const CHAT_HISTORY_MAX_TURNS = 10;
export const CHAT_HISTORY_TEXT_MAX = 600;
/** recent_entries limits: the only raw entries the model can receive. */
export const RECENT_MAX_DAYS = 30;
export const RECENT_MAX_ROWS = 200;
export const NOTE_MAX_CHARS = 120;
/** Every other free-text field a tool sends (brand, variant, trigger, mood, context). */
export const TEXT_FIELD_MAX_CHARS = 60;

export const chatHistoryTurnSchema = z
  .object({
    role: z.enum(['user', 'assistant']),
    text: z.string().trim().min(1).max(CHAT_HISTORY_TEXT_MAX),
  })
  .strict();

export type ChatHistoryTurn = z.infer<typeof chatHistoryTurnSchema>;

export const chatRequestSchema = z
  .object({
    question: z.string().trim().min(1).max(CHAT_QUESTION_MAX),
    history: z.array(chatHistoryTurnSchema).max(CHAT_HISTORY_MAX_TURNS).default([]),
  })
  .strict()
  .superRefine((value, ctx) => {
    // The Messages API requires the first turn to be the user's.
    if (value.history.length > 0 && value.history[0].role !== 'user') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'history must start with a user turn',
        path: ['history', 0, 'role'],
      });
      return;
    }
    for (let i = 1; i < value.history.length; i++) {
      if (value.history[i].role === value.history[i - 1].role) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'history roles must alternate',
          path: ['history', i, 'role'],
        });
        return;
      }
    }
  });

export type ChatRequest = z.infer<typeof chatRequestSchema>;

export type RowUnit = 'sticks' | 'money' | 'percent' | 'days' | 'text';
export type RowTone = 'neutral' | 'accent' | 'warn';

/** One figure the server computed; the client renders it as a MetricRow. */
export interface Row {
  id: string;
  label: string;
  value: number | string;
  unit: RowUnit;
  tone?: RowTone;
}

export interface ChatResponse {
  answer: string;
  rows: Row[];
  toolsUsed: string[];
}

/** GET /api/ledger-chat: what the dock needs before the first question. */
export interface ChatStateResponse {
  consented: boolean;
  discreet: boolean;
  /** Mask figures at the panel's render sites: discreet mode or hide-totals-on-home. */
  hideTotals: boolean;
  currency: CurrencyCode;
  /** The reader's country locale, for money formatting. */
  locale: string;
  starters: string[];
}

export type ChatErrorCode =
  | 'validation_error'
  | 'unauthorized'
  | 'forbidden'
  | 'consent_required'
  | 'consent_outdated'
  | 'rate_limited'
  | 'feature_disabled'
  | 'server_misconfigured'
  | 'dependency_failure'
  | 'internal_error';

export interface ChatErrorBody {
  error: ChatErrorCode;
}

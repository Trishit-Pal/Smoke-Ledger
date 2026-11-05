// The ordered list of model providers the chat may use. Anthropic is first and is the only vendor
// the consent notice names today. Other vendors go in providers/langchain.ts (your slot), and are
// refused at run time until the notice and privacy page name them (see fallback.ts).

import Anthropic from '@anthropic-ai/sdk';
import { cleanEnvValue } from '@web/lib/supabase/env';
import type { ChatProvider } from './fallback';
import { langchainProviders } from './providers/langchain';

const DEFAULT_MODEL = 'claude-haiku-5-5';
/** Inside the route's whole-turn budget; a hung upstream yields a calm 502, not a platform 504. */
const UPSTREAM_TIMEOUT_MS = 20_000;

export const anthropicProvider: ChatProvider = {
  id: 'anthropic',
  label: 'Anthropic',
  model: () => cleanEnvValue(process.env.LEDGER_CHAT_MODEL) || DEFAULT_MODEL,
  client: () => {
    const apiKey = cleanEnvValue(process.env.ANTHROPIC_API_KEY);
    return apiKey ? new Anthropic({ apiKey, timeout: UPSTREAM_TIMEOUT_MS, maxRetries: 0 }) : null;
  },
};

export const PROVIDERS: readonly ChatProvider[] = [anthropicProvider, ...langchainProviders];

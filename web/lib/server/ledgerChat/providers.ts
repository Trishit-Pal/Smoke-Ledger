// The ordered list of keys the chat may use, free first and paid last (see
// docs/architecture/ledger-chat-provider-fallback-adr.md). A turn runs on the first key that works;
// ./fallback.ts moves to the next one when a call fails and gives the calm 502 when all have failed.
// An unset key is skipped. Every vendor here must be named in the consent notice (fallback.ts refuses
// the rest), so adding one is a consent event: see src/domain/ledgerChat/notice.ts.
//
// Data terms behind the order (re-check before each notice version):
//   Groq        free tier, no training, Zero Data Retention on in each org's Data Controls.
//               Limits are per org: extra keys add capacity only from separate orgs.
//   Google      Gemini keys from a BILLING-LINKED Cloud project only. Its free tier trains on prompts
//               and is not allowed for EEA/UK/CH users. Limits are per project, not per key.
//   OpenRouter  paid credits; `data_collection: 'deny'` keeps it off hosts that store prompts.

import { createGoogle } from '@ai-sdk/google';
import { createGroq } from '@ai-sdk/groq';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { cleanEnvValue } from '@web/lib/supabase/env';
import type { ChatProvider } from './fallback';
import { aiSdkClient } from './providers/aiSdk';
import type { ChatModelClient } from './turn';

interface Vendor {
  id: 'groq' | 'google' | 'openrouter';
  label: string;
  modelEnv: string;
  /** Must support tool calling; override per deployment with modelEnv. */
  defaultModel: string;
  make(apiKey: string, modelId: string): ChatModelClient;
}

const GROQ: Vendor = {
  id: 'groq',
  label: 'Groq',
  modelEnv: 'GROQ_MODEL',
  defaultModel: 'openai/gpt-oss-120b',
  make: (apiKey, modelId) => aiSdkClient(createGroq({ apiKey })(modelId)),
};

const GOOGLE: Vendor = {
  id: 'google',
  label: 'Google',
  modelEnv: 'GEMINI_MODEL',
  defaultModel: 'gemini-flash-lite-latest',
  make: (apiKey, modelId) => aiSdkClient(createGoogle({ apiKey })(modelId)),
};

const OPENROUTER: Vendor = {
  id: 'openrouter',
  label: 'OpenRouter',
  modelEnv: 'OPENROUTER_MODEL',
  defaultModel: 'openai/gpt-oss-120b',
  make: (apiKey, modelId) =>
    aiSdkClient(createOpenRouter({ apiKey }).chat(modelId, { provider: { data_collection: 'deny' } })),
};

function slot(vendor: Vendor, keyEnv: string): ChatProvider {
  const model = () => cleanEnvValue(process.env[vendor.modelEnv]) || vendor.defaultModel;
  return {
    id: vendor.id,
    label: vendor.label,
    model,
    client: () => {
      const apiKey = cleanEnvValue(process.env[keyEnv]);
      return apiKey ? vendor.make(apiKey, model()) : null;
    },
  };
}

/** The Groq key slots, in order. The safety classifier (./classifier.ts) runs on these too. */
export const GROQ_KEY_ENVS = ['GROQ_API_KEY_1', 'GROQ_API_KEY_2', 'GROQ_API_KEY_3'] as const;

/** The Groq keys that are set, in slot order. */
export function groqApiKeys(): string[] {
  return GROQ_KEY_ENVS.map((env) => cleanEnvValue(process.env[env])).filter((k): k is string => Boolean(k));
}

// ponytail: fixed six-slot table; an env-driven list (vendor:keyEnv pairs) if slots start to churn.
export const PROVIDERS: readonly ChatProvider[] = [
  ...GROQ_KEY_ENVS.map((env) => slot(GROQ, env)),
  slot(GOOGLE, 'GEMINI_API_KEY_1'),
  slot(GOOGLE, 'GEMINI_API_KEY_2'),
  slot(OPENROUTER, 'OPENROUTER_API_KEY'),
];

// YOUR SLOT: other AI vendors, through LangChain (or any SDK), for the free API keys you hold.
// It ships empty on purpose. Nothing here runs until you add an entry to `langchainProviders`.
//
// How it works (see ../fallback.ts)
//   - providers.ts puts Anthropic first, then everything in this array, in order.
//   - A turn runs on the first provider; if its model call throws (rate limit, 5xx, timeout, bad
//     key, network), the WHOLE turn restarts on the next provider. You do not write the retry loop.
//   - A provider whose client() returns null (no key set) is skipped, and does not shrink the time
//     the others get, so unset keys are harmless. A client() that throws is logged and skipped.
//
// One entry per vendor (preferred), each with its own key:
//   { id, label, model(), client() }  ->  see ChatProvider in ../fallback.ts
//
// If you would rather keep several keys of ONE vendor in a single entry, loop over them inside your
// adapter's `create` and throw only when every key has failed (a plain if/else or for loop is fine).
//
// THE ADAPTER CONTRACT: client() returns `{ messages: { create(params, options) } }`, shaped like
// the Anthropic SDK, because the turn engine (../turn.ts) speaks that shape:
//   in : params.system   = [{ type: 'text', text }, ...]          (join into one system string;
//                                                                  ignore cache_control)
//        params.tools    = [{ name, description, input_schema }]  (map to the vendor's tool format;
//                                                                  ignore `strict`)
//        params.messages = [{ role: 'user' | 'assistant', content: string | blocks }]
//                          blocks: text, tool_use { id, name, input }, tool_result { tool_use_id,
//                          content, is_error? }
//        params.max_tokens; ignore params.output_config and params.model (use your own)
//        options.signal   (pass it to the vendor call so a slow model is cut off on time)
//   out: { content: [{ type: 'text', text } | { type: 'tool_use', id, name, input }],
//          stop_reason: 'end_turn' | 'tool_use' | 'max_tokens',
//          usage: { input_tokens, output_tokens } }
//   Do not return thinking blocks. Throw on ANY failure of the model call (never return an error
//   string as an answer); the runner treats a throw as "try the next provider".
//
// KEYS: read them from process.env (Vercel project settings, e.g. GROQ_API_KEY). Never put a key
// in code, in the repo or in chat. A key that is not set must make client() return null.
//
// BEFORE you register a vendor, three things are required, and the app refuses it until they are done:
//   1. Check the vendor's data terms: free tiers often allow training on what you send, and this is
//      health-related data. Do not add a vendor whose terms you have not read.
//   2. Name it in the consent notice (src/domain/ledgerChat/notice.ts: LEDGER_CHAT_NOTICE and
//      LEDGER_CHAT_DISCLOSED_PROVIDERS) and on the privacy page (web/app/privacy/page.tsx).
//   3. Bump LEDGER_CHAT_NOTICE_VERSION and add the new hash in web/__tests__/ledgerChatScope.test.ts
//      (every reader who opted in is asked again, by design). Ship web and mobile together.
// web/__tests__/ledgerChatFallback.test.ts fails if a registered provider is not named in the notice.
//
// SKETCH (commented out; adapt it to the vendor and your LangChain version):
//
//   import { ChatGroq } from '@langchain/groq';   // you install the packages yourself
//   export const langchainProviders: readonly ChatProvider[] = [
//     {
//       id: 'groq',
//       label: 'Groq',
//       model: () => cleanEnvValue(process.env.GROQ_MODEL) || 'llama-3.3-70b-versatile',
//       client: () => {
//         const apiKey = cleanEnvValue(process.env.GROQ_API_KEY);
//         if (!apiKey) return null;
//         const chat = new ChatGroq({ apiKey /* , model, maxRetries: 0 */ });
//         return { messages: { create: async (params, options) => anthropicShaped(await chat.invoke(toLangChain(params), { signal: options?.signal })) } };
//       },
//     },
//   ];
//   // toLangChain / anthropicShaped are yours to write: they map the shapes described above.

import type { ChatProvider } from '../fallback';

export const langchainProviders: readonly ChatProvider[] = [];

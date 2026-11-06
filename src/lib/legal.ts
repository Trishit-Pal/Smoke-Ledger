// A blank value (eas.json ships the key as a placeholder) counts as unset: a relative legal link
// cannot be opened from the app, so it falls back to the default origin.
const baseUrl = process.env.EXPO_PUBLIC_WEB_BASE_URL?.trim() || 'https://smokeledger.fyi';

// 2026-11-06: the Ask the ledger launch (moved from 2026-11-05 when the AI vendors became Groq,
// Google and OpenRouter in place of Anthropic). Terms and privacy move together, so one /consent screen
// asks every live reader to accept the rewritten documents (and answer the chat Yes/No). Owner
// decision: ship before an EU Art 27 representative is signed; the policy says "being appointed".
// If this ships on a later day, change this date, both `Effective date:` lines in docs/legal/, and
// nothing else (the gate tests read the constants).
export const LEGAL_VERSIONS = {
  terms: '2026-11-06',
  privacy: '2026-11-06',
  medicalDisclaimer: '2026-05-19',
} as const;

/**
 * The last privacy version whose text does not describe the chat's full scope. Ask the ledger must
 * stay off in Production until LEGAL_VERSIONS.privacy moves past it (owner-actions section 8 step 1),
 * because an opt-in recorded earlier would rest on the old text.
 */
export const CHAT_UNDISCLOSED_PRIVACY = '2026-11-02';

export function isChatPolicyLive(privacy: string = LEGAL_VERSIONS.privacy): boolean {
  return privacy > CHAT_UNDISCLOSED_PRIVACY;
}

export const LEGAL_URLS = {
  terms: `${baseUrl}/terms`,
  privacy: `${baseUrl}/privacy`,
  support: `${baseUrl}/support`,
} as const;

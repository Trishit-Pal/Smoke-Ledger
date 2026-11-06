const baseUrl = process.env.EXPO_PUBLIC_WEB_BASE_URL ?? 'https://smokeledger.fyi';

export const LEGAL_VERSIONS = {
  terms: '2026-05-19',
  // 2026-11-02: names Anthropic as the processor behind the opt-in Ask the ledger feature.
  privacy: '2026-11-02',
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
